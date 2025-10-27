import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebSocketServer, WebSocket } from "ws";
import { browserManager } from "./browserManager";
import { getSession } from "./auth";
import { storage } from "./storage";
import passport from "passport";
import type { IncomingMessage } from "http";

const app = express();
const sessionMiddleware = getSession();
const passportInitMiddleware = passport.initialize();
const passportSessionMiddleware = passport.session();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: string;
    };
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Helper function to run Express middleware on WebSocket upgrade requests
  const runMiddleware = (req: any, res: any, fn: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      fn(req, res, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  };

  // Set up WebSocket server for browser streaming with authentication
  // Use a specific path to avoid conflicts with Vite HMR WebSocket
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws, req: any) => {
    let browserSessionId: string | null = null;
    
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      browserSessionId = url.searchParams.get('sessionId');

      // Silently ignore WebSocket connections without sessionId (e.g., Vite HMR)
      // This prevents Vite HMR from causing repeated connection/rejection logs
      if (!browserSessionId) {
        ws.close(1000, 'No session ID'); // Use close instead of terminate for cleaner shutdown
        return;
      }

      log(`WebSocket connection attempt for browser session: ${browserSessionId}`);

      // Create a mock response object for middleware
      const res: any = {
        getHeader: () => null,
        setHeader: () => null,
        writeHead: () => null,
        end: () => null,
      };

      // Run session middleware to populate req.session
      await runMiddleware(req, res, sessionMiddleware);
      
      // Run passport middleware to populate req.user
      await runMiddleware(req, res, passportInitMiddleware);
      await runMiddleware(req, res, passportSessionMiddleware);

      // Verify user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        log(`WebSocket auth failed: User not authenticated`);
        ws.terminate();
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        log(`WebSocket auth failed: No user ID`);
        ws.terminate();
        return;
      }

      // Verify the browser session exists and check ownership
      let browserSession = await storage.getBrowserSession(browserSessionId);
      
      // If not found, try fetching all sessions and find it (workaround for timing issues)
      if (!browserSession) {
        const allSessions = await storage.getBrowserSessionsByUserId(userId);
        browserSession = allSessions.find(s => s.id === browserSessionId);
      }
      
      if (!browserSession) {
        log(`WebSocket auth failed: Browser session not found for ID ${browserSessionId}`);
        ws.terminate();
        return;
      }

      // Verify ownership: the authenticated user must own the browser session
      if (browserSession.userId !== userId) {
        log(`WebSocket auth failed: User ${userId} does not own browser session ${browserSessionId}`);
        ws.terminate();
        return;
      }

      log(`WebSocket authenticated for session ${browserSessionId} (user: ${userId})`);

      // Check if browser session is actually running
      if (!browserManager.isSessionActive(browserSessionId)) {
        log(`WebSocket warning: Browser session ${browserSessionId} is not active, attempting to start...`);
        try {
          await browserManager.startSession(browserSessionId);
          log(`Browser session ${browserSessionId} started successfully`);
        } catch (error) {
          log(`Failed to start browser session ${browserSessionId}: ${error}`);
          ws.terminate();
          return;
        }
      }

      log(`Starting screencast for session ${browserSessionId}`);
      await browserManager.startScreencast(browserSessionId, ws);
      log(`Screencast initialized for session ${browserSessionId}`);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          log(`WS message: type=${data.type}, eventType=${data.eventType}`);

          if (data.type === 'mouseEvent') {
            log(`Mouse: ${data.eventType} at (${Math.round(data.x)}, ${Math.round(data.y)})`);
            await browserManager.dispatchMouseEvent(
              browserSessionId!,
              data.eventType,
              data.x,
              data.y,
              data.button
            );
          } else if (data.type === 'keyEvent') {
            log(`Key: ${data.eventType}, key=${data.key}`);
            await browserManager.dispatchKeyEvent(
              browserSessionId!,
              data.eventType,
              data.key,
              data.text
            );
          } else if (data.type === 'scroll') {
            log(`Scroll: dx=${data.deltaX}, dy=${data.deltaY}`);
            await browserManager.dispatchScrollEvent(
              browserSessionId!,
              data.deltaX,
              data.deltaY
            );
          }
        } catch (error) {
          log(`WebSocket message error: ${error}`);
        }
      });

      ws.on('close', async () => {
        log(`WebSocket disconnected for browser session ${browserSessionId}`);
        if (browserSessionId) {
          await browserManager.stopScreencast(browserSessionId, ws);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        // Don't let client errors crash the server
      });
    } catch (error) {
      log(`WebSocket connection error: ${error}`);
      // Safely terminate the connection without throwing
      try {
        // Only close if socket is open or connecting
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.terminate(); // Force close without waiting for close frame
        }
      } catch (closeError) {
        // Ignore all close errors
        log(`Error during WebSocket termination: ${closeError}`);
      }
    }
  });

  // Handle WebSocket server errors
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
    // Don't crash the server on WebSocket errors
  });

  // Handle server upgrade errors - only handle browser session WebSocket connections
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    
    // Only handle WebSocket upgrades that have a sessionId (browser sessions)
    // Let Vite handle its own HMR WebSocket connections
    if (!sessionId) {
      // Don't interfere with Vite HMR or other WebSocket connections
      return;
    }

    socket.on('error', (error) => {
      console.error('WebSocket upgrade error:', error);
      // Don't crash on upgrade errors
    });

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.on('error', (error) => {
        console.error('WebSocket client error during upgrade:', error);
        // Prevent crash on client errors
      });
      wss.emit('connection', ws, request);
    });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
