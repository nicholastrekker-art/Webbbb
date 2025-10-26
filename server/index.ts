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
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const browserSessionId = url.searchParams.get('sessionId');

    if (!browserSessionId) {
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

    try {
      // Run session middleware to populate req.session
      await runMiddleware(req, res, sessionMiddleware);
      
      // Run passport middleware to populate req.user
      await runMiddleware(req, res, passportInitMiddleware);
      await runMiddleware(req, res, passportSessionMiddleware);

      // Verify user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        log(`WebSocket auth failed: User not authenticated`);
        ws.close(4403, 'Authentication required');
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        log(`WebSocket auth failed: No user ID`);
        ws.close(4403, 'Authentication required');
        return;
      }

      // Verify the browser session exists and check ownership
      const browserSession = await storage.getBrowserSession(browserSessionId);
      if (!browserSession) {
        log(`WebSocket auth failed: Browser session not found`);
        ws.close(4403, 'Permission denied');
        return;
      }

      // Verify ownership: the authenticated user must own the browser session
      if (browserSession.userId !== userId) {
        log(`WebSocket auth failed: User ${userId} does not own browser session ${browserSessionId}`);
        ws.close(4403, 'Permission denied');
        return;
      }

      log(`WebSocket authenticated and connected for browser session ${browserSessionId} (user: ${userId})`);

      await browserManager.startScreencast(browserSessionId, ws);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'mouseEvent') {
            await browserManager.dispatchMouseEvent(
              browserSessionId,
              data.eventType,
              data.x,
              data.y,
              data.button
            );
          } else if (data.type === 'keyEvent') {
            await browserManager.dispatchKeyEvent(
              browserSessionId,
              data.eventType,
              data.key,
              data.text
            );
          } else if (data.type === 'scroll') {
            await browserManager.dispatchScrollEvent(
              browserSessionId,
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
        await browserManager.stopScreencast(browserSessionId, ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      log(`WebSocket auth error: ${error}`);
      ws.close(4403, 'Authentication required');
    }
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
