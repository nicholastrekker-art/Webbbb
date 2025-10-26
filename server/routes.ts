import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { browserManager } from "./browserManager";
import { insertBrowserSessionSchema } from "@shared/schema";
import type { InsertBrowserSessionInput } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Browser session routes
  app.get("/api/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getBrowserSessionsByUserId(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validationResult = insertBrowserSessionSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validationResult.error.errors,
        });
      }

      const session = await storage.createBrowserSession(validationResult.data);
      
      // Optionally auto-start the session
      if (validationResult.data.status === "running") {
        try {
          await browserManager.startSession(session.id);
        } catch (error) {
          console.error("Failed to start session:", error);
          // Don't fail the request, just log the error
        }
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Handle status changes
      if (status) {
        switch (status) {
          case "running":
            await browserManager.resumeSession(id);
            break;
          case "paused":
            await browserManager.pauseSession(id);
            break;
          case "stopped":
            await browserManager.stopSession(id);
            break;
        }
      }

      const updatedSession = await storage.getBrowserSession(id);
      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Stop session if running
      try {
        await browserManager.stopSession(id);
      } catch (error) {
        console.error("Failed to stop session:", error);
      }

      await storage.deleteBrowserSession(id);
      res.json({ message: "Session deleted" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Cookie routes
  app.get("/api/sessions/:id/cookies", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const cookies = await storage.getSessionCookies(id);
      res.json(cookies);
    } catch (error) {
      console.error("Error fetching cookies:", error);
      res.status(500).json({ message: "Failed to fetch cookies" });
    }
  });

  // Browser interaction routes
  app.get("/api/sessions/:id/screenshot", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!browserManager.isSessionActive(id)) {
        return res.status(400).json({ message: "Session not running" });
      }

      const screenshot = await browserManager.getScreenshot(id);
      res.setHeader("Content-Type", "image/png");
      res.send(screenshot);
    } catch (error) {
      console.error("Error getting screenshot:", error);
      res.status(500).json({ message: "Failed to get screenshot" });
    }
  });

  app.post("/api/sessions/:id/navigate", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!browserManager.isSessionActive(id)) {
        return res.status(400).json({ message: "Session not running" });
      }

      await browserManager.navigateSession(id, url);
      const currentUrl = await browserManager.getCurrentUrl(id);
      res.json({ success: true, currentUrl });
    } catch (error) {
      console.error("Error navigating:", error);
      res.status(500).json({ message: "Failed to navigate" });
    }
  });

  app.post("/api/sessions/:id/click", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { x, y } = req.body;

      if (typeof x !== "number" || typeof y !== "number") {
        return res.status(400).json({ message: "x and y coordinates are required" });
      }

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!browserManager.isSessionActive(id)) {
        return res.status(400).json({ message: "Session not running" });
      }

      await browserManager.clickAt(id, x, y);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clicking:", error);
      res.status(500).json({ message: "Failed to click" });
    }
  });

  app.post("/api/sessions/:id/type", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { text, key } = req.body;

      const session = await storage.getBrowserSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify ownership
      const userId = req.user.claims.sub;
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!browserManager.isSessionActive(id)) {
        return res.status(400).json({ message: "Session not running" });
      }

      if (text) {
        await browserManager.typeText(id, text);
      } else if (key) {
        await browserManager.pressKey(id, key);
      } else {
        return res.status(400).json({ message: "Either text or key is required" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error typing:", error);
      res.status(500).json({ message: "Failed to type" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
