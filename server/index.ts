import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebSocketServer } from "ws";
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
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req: any) => {
    let browserSessionId: string | null = null;
    
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      browserSessionId = url.searchParams.get('sessionId');

      log(`WebSocket connection attempt for session: ${browserSessionId}`);

      if (!browserSessionId) {
        log('WebSocket rejected: No session ID provided');
        ws.close(1008, 'Session ID required');
        return;
      }

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
        ws.close(1008, 'Authentication required');
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        log(`WebSocket auth failed: No user ID`);
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify the browser session exists and check ownership
      const browserSession = await storage.getBrowserSession(browserSessionId);
      if (!browserSession) {
        log(`WebSocket auth failed: Browser session not found`);
        ws.close(1008, 'Permission denied');
        return;
      }

      // Verify ownership: the authenticated user must own the browser session
      if (browserSession.userId !== userId) {
        log(`WebSocket auth failed: User ${userId} does not own browser session ${browserSessionId}`);
        ws.close(1008, 'Permission denied');
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
          ws.close(1011, 'Failed to start browser session');
          return;
        }
      }

      log(`Starting screencast for session ${browserSessionId}`);
      await browserManager.startScreencast(browserSessionId, ws);
      log(`Screencast initialized for session ${browserSessionId}`);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'mouseEvent') {
            await browserManager.dispatchMouseEvent(
              browserSessionId!,
              data.eventType,
              data.x,
              data.y,
              data.button
            );
          } else if (data.type === 'keyEvent') {
            await browserManager.dispatchKeyEvent(
              browserSessionId!,
              data.eventType,
              data.key,
              data.text
            );
          } else if (data.type === 'scroll') {
            await browserManager.dispatchScrollEvent(
              browserSessionId!,
              data.deltaX,
              data.deltaY
            );
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
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
      });
    } catch (error) {
      log(`WebSocket connection error: ${error}`);
      // Only try to close if the WebSocket is in a valid state
      try {
        if (ws.readyState === 1) { // OPEN state
          ws.close(1011, 'Internal server error');
        } else if (ws.readyState === 0) { // CONNECTING state
          ws.close(1000, 'Normal closure');
        }
      } catch (closeError) {
        // Ignore errors when closing - connection may already be terminated
      }
    }
  });

  // Handle WebSocket server errors
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
    // Don't crash the server on WebSocket errors
  });

  // Handle server upgrade errors
  server.on('upgrade', (request, socket, head) => {
    socket.on('error', (error) => {
      console.error('WebSocket upgrade error:', error);
      // Don't crash on upgrade errors
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
