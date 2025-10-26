import puppeteer, { Browser, Page } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Cookie as PuppeteerCookie } from "puppeteer";
import { storage } from "./storage";
import type { BrowserSession } from "@shared/schema";
import { execSync } from "child_process";

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Store active browser instances and pages
const activeBrowsers = new Map<string, { browser: Browser; page: Page }>();

export class BrowserSessionManager {
  /**
   * Start a browser session
   */
  async startSession(sessionId: string): Promise<void> {
    // Check if session is already running
    if (activeBrowsers.has(sessionId)) {
      console.log(`Session ${sessionId} is already running`);
      return;
    }

    const session = await storage.getBrowserSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    try {
      // Find Chromium executable in Nix store
      let executablePath: string | undefined;
      try {
        // Try to find chromium in the Nix store
        const chromiumPath = execSync('which chromium 2>/dev/null || echo ""').toString().trim();
        if (chromiumPath) {
          executablePath = chromiumPath;
          console.log(`Using Chromium from: ${executablePath}`);
        } else {
          throw new Error('Chromium not found in PATH');
        }
      } catch (e) {
        console.error('Failed to find Chromium executable:', e);
        throw new Error('Chromium is not installed. Please ensure Nix dependencies are properly configured.');
      }

      // Launch browser
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-extensions",
        ],
      });

      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({
        width: session.viewportWidth || 1920,
        height: session.viewportHeight || 1080,
      });

      // Set user agent if provided
      if (session.userAgent) {
        await page.setUserAgent(session.userAgent);
      }

      // Load cookies from database
      const cookies = await storage.getSessionCookies(sessionId);
      if (cookies.length > 0) {
        const puppeteerCookies: PuppeteerCookie[] = cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || undefined,
          path: cookie.path || undefined,
          expires: cookie.expires ? new Date(cookie.expires).getTime() / 1000 : undefined,
          httpOnly: cookie.httpOnly || undefined,
          secure: cookie.secure || undefined,
          sameSite: cookie.sameSite as any,
        }));
        await page.setCookie(...puppeteerCookies);
      }

      // Navigate to URL
      await page.goto(session.url, { waitUntil: "networkidle0", timeout: 30000 });

      // Save cookies back to database
      await this.saveCookies(sessionId, page);

      // Store browser and page instance
      activeBrowsers.set(sessionId, { browser, page });

      // Update session status
      await storage.updateBrowserSession(sessionId, {
        status: "running",
        lastActivityAt: new Date(),
      });

      // Set up periodic cookie saving
      this.setupPeriodicCookieSave(sessionId, page);

      console.log(`Session ${sessionId} started successfully`);
    } catch (error) {
      console.error(`Failed to start session ${sessionId}:`, error);
      await storage.updateBrowserSession(sessionId, {
        status: "error",
        lastActivityAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * Pause a browser session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    // Save cookies before pausing
    await this.saveCookies(sessionId, instance.page);

    // Update session status
    await storage.updateBrowserSession(sessionId, {
      status: "paused",
      lastActivityAt: new Date(),
    });

    console.log(`Session ${sessionId} paused`);
  }

  /**
   * Stop a browser session
   */
  async stopSession(sessionId: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      // Just update status if not running
      await storage.updateBrowserSession(sessionId, {
        status: "stopped",
        lastActivityAt: new Date(),
      });
      return;
    }

    // Save cookies before stopping
    await this.saveCookies(sessionId, instance.page);

    // Close browser
    await instance.browser.close();

    // Remove from active sessions
    activeBrowsers.delete(sessionId);

    // Update session status
    await storage.updateBrowserSession(sessionId, {
      status: "stopped",
      lastActivityAt: new Date(),
    });

    console.log(`Session ${sessionId} stopped`);
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (instance) {
      // Already running, just update status
      await storage.updateBrowserSession(sessionId, {
        status: "running",
        lastActivityAt: new Date(),
      });
      return;
    }

    // Restart the session
    await this.startSession(sessionId);
  }

  /**
   * Navigate to a URL in an active session
   */
  async navigateSession(sessionId: string, url: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    
    // Update session URL and save cookies
    await storage.updateBrowserSession(sessionId, {
      url,
      lastActivityAt: new Date(),
    });
    await this.saveCookies(sessionId, instance.page);
  }

  /**
   * Get screenshot of active session
   */
  async getScreenshot(sessionId: string): Promise<Buffer> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    const screenshot = await instance.page.screenshot({
      type: "png",
      fullPage: false,
    });

    return screenshot as Buffer;
  }

  /**
   * Click at coordinates in active session
   */
  async clickAt(sessionId: string, x: number, y: number): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.mouse.click(x, y);
    await this.saveCookies(sessionId, instance.page);
  }

  /**
   * Type text in active session
   */
  async typeText(sessionId: string, text: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.keyboard.type(text);
  }

  /**
   * Press a key in active session
   */
  async pressKey(sessionId: string, key: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.keyboard.press(key as any);
  }

  /**
   * Get current URL of active session
   */
  async getCurrentUrl(sessionId: string): Promise<string> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    return instance.page.url();
  }

  /**
   * Save cookies from page to database
   */
  private async saveCookies(sessionId: string, page: Page): Promise<void> {
    try {
      const puppeteerCookies = await page.cookies();

      // Clear existing cookies for this session
      await storage.clearSessionCookies(sessionId);

      // Save new cookies
      for (const cookie of puppeteerCookies) {
        await storage.createCookie({
          sessionId,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || null,
          path: cookie.path || null,
          expires: cookie.expires ? new Date(cookie.expires * 1000) : null,
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false,
          sameSite: (cookie.sameSite as any) || null,
        });
      }

      console.log(`Saved ${puppeteerCookies.length} cookies for session ${sessionId}`);
    } catch (error) {
      console.error(`Failed to save cookies for session ${sessionId}:`, error);
    }
  }

  /**
   * Set up periodic cookie saving (every 5 minutes)
   */
  private setupPeriodicCookieSave(sessionId: string, page: Page): void {
    const interval = setInterval(async () => {
      const instance = activeBrowsers.get(sessionId);
      if (!instance) {
        clearInterval(interval);
        return;
      }

      const session = await storage.getBrowserSession(sessionId);
      if (!session || session.status !== "running") {
        clearInterval(interval);
        return;
      }

      await this.saveCookies(sessionId, page);
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return activeBrowsers.size;
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId: string): boolean {
    return activeBrowsers.has(sessionId);
  }

  /**
   * Clean up all sessions
   */
  async cleanup(): Promise<void> {
    for (const [sessionId, instance] of activeBrowsers.entries()) {
      try {
        await this.saveCookies(sessionId, instance.page);
        await instance.browser.close();
      } catch (error) {
        console.error(`Failed to cleanup session ${sessionId}:`, error);
      }
    }
    activeBrowsers.clear();
  }
}

export const browserManager = new BrowserSessionManager();

/**
 * Restore running sessions on server startup
 */
export async function restoreRunningSessions(): Promise<void> {
  console.log("Restoring running browser sessions...");
  try {
    // This will be called from server/index.ts after storage is initialized
    const { db } = await import("./db");
    const { browserSessions } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    // Find all sessions that were running before restart
    const runningSessions = await db
      .select()
      .from(browserSessions)
      .where(eq(browserSessions.status, "running"));

    console.log(`Found ${runningSessions.length} sessions to restore`);

    for (const session of runningSessions) {
      try {
        await browserManager.startSession(session.id);
        console.log(`Restored session ${session.id}`);
      } catch (error) {
        console.error(`Failed to restore session ${session.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to restore sessions:", error);
  }
}

// Cleanup on process exit
process.on("SIGINT", async () => {
  console.log("Shutting down browser sessions...");
  await browserManager.cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down browser sessions...");
  await browserManager.cleanup();
  process.exit(0);
});
