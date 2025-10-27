import puppeteer from "puppeteer-extra";
import type { Browser, Page, CDPSession } from "puppeteer";
import type { Protocol } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { storage } from "./storage";
import type { BrowserSession } from "@shared/schema";
import { execSync } from "child_process";
import type { WebSocket } from "ws";

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Store active browser instances and pages
const activeBrowsers = new Map<string, { 
  browser: Browser; 
  page: Page; 
  cdpSession?: CDPSession;
  streamClients: Set<WebSocket>;
}>();

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

      // Load cookies from storage
      const cookies = await storage.getSessionCookies(sessionId);
      if (cookies.length > 0) {
        const puppeteerCookies = cookies.map((cookie) => ({
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

      // Navigate to URL if provided
      if (session.url && session.url.trim() !== "" && session.url !== "about:blank") {
        await page.goto(session.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      } else {
        // Navigate to blank page if no URL specified
        await page.goto("about:blank", { waitUntil: "load", timeout: 5000 });
      }

      // Save cookies back to storage
      await this.saveCookies(sessionId, page);

      // Store browser and page instance
      activeBrowsers.set(sessionId, { browser, page, streamClients: new Set() });

      // Update session status
      await storage.updateBrowserSession(sessionId, {
        status: "running",
      });

      // Set up periodic cookie saving
      this.setupPeriodicCookieSave(sessionId, page);

      console.log(`Session ${sessionId} started successfully`);
    } catch (error) {
      console.error(`Failed to start session ${sessionId}:`, error);
      await storage.updateBrowserSession(sessionId, {
        status: "error",
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

    await instance.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    // Update session URL and save cookies
    await storage.updateBrowserSession(sessionId, {
      url,
    });
    await this.saveCookies(sessionId, instance.page);
  }

  /**
   * Go back in browser history
   */
  async goBack(sessionId: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
    await this.saveCookies(sessionId, instance.page);
  }

  /**
   * Go forward in browser history
   */
  async goForward(sessionId: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.goForward({ waitUntil: "domcontentloaded", timeout: 30000 });
    await this.saveCookies(sessionId, instance.page);
  }

  /**
   * Reload current page
   */
  async refresh(sessionId: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    await instance.page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
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
   * Upload file to active session
   */
  async uploadFile(sessionId: string, filePath: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      throw new Error("Session not running");
    }

    try {
      // Wait for file input to be available on the page
      await instance.page.waitForSelector('input[type="file"]', { 
        timeout: 5000,
        visible: false // Don't require it to be visible since some inputs are hidden
      });
    } catch (error) {
      throw new Error("No file input found on page. Please navigate to a page with a file upload field.");
    }

    // Find all file input elements on the page
    const fileInputs = await instance.page.$$('input[type="file"]');
    
    if (fileInputs.length === 0) {
      throw new Error("No file input found on page");
    }

    console.log(`Found ${fileInputs.length} file input(s) on page`);

    // Find the first visible and enabled file input, or just use the first one
    let targetInput = fileInputs[0]; // Default to first input
    
    for (const input of fileInputs) {
      try {
        const isVisible = await input.isVisible();
        const isEnabled = await input.evaluate((el: HTMLInputElement) => !el.disabled);
        
        if (isVisible && isEnabled) {
          targetInput = input;
          console.log('Found visible and enabled file input');
          break;
        }
      } catch (err) {
        console.log('Error checking input visibility:', err);
        // Continue to next input
      }
    }

    // Upload the file
    console.log(`Uploading file: ${filePath}`);
    await targetInput.uploadFile(filePath);
    console.log('File uploaded to input element');

    // Trigger change and input events to ensure the page recognizes the upload
    await targetInput.evaluate((el: HTMLInputElement) => {
      // Trigger both change and input events for compatibility
      const changeEvent = new Event('change', { bubbles: true });
      const inputEvent = new Event('input', { bubbles: true });
      el.dispatchEvent(inputEvent);
      el.dispatchEvent(changeEvent);
    });
    console.log('Triggered change events');

    // Try to click any associated labels to better simulate user interaction
    try {
      await targetInput.evaluate((el: HTMLInputElement) => {
        const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
        if (label) {
          (label as HTMLElement).click();
        }
      });
    } catch (err) {
      // Ignore errors here
    }

    // Small delay to let the page process the file
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('File upload completed successfully');
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
   * Save cookies from page to storage
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
    const entries = Array.from(activeBrowsers.entries());
    for (const [sessionId, instance] of entries) {
      try {
        await this.saveCookies(sessionId, instance.page);
        await instance.browser.close();
      } catch (error) {
        console.error(`Failed to cleanup session ${sessionId}:`, error);
      }
    }
    activeBrowsers.clear();
  }

  /**
   * Start screencast for a session
   */
  async startScreencast(sessionId: string, ws: WebSocket): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) {
      console.error(`Cannot start screencast: Session ${sessionId} not running`);
      throw new Error("Session not running");
    }

    console.log(`Adding WebSocket client to session ${sessionId}`);
    instance.streamClients.add(ws);

    if (!instance.cdpSession) {
      console.log(`Creating CDP session for ${sessionId}`);
      try {
        const cdpSession = await instance.page.createCDPSession();
        instance.cdpSession = cdpSession;

        cdpSession.on('Page.screencastFrame', async (params: any) => {
          try {
            await cdpSession.send('Page.screencastFrameAck', { 
              sessionId: params.sessionId 
            });

            const frameData = {
              type: 'frame',
              data: params.data,
              metadata: params.metadata,
            };

            instance.streamClients.forEach((client) => {
              if (client.readyState === 1) {
                try {
                  client.send(JSON.stringify(frameData));
                } catch (error) {
                  console.error('Error sending frame to client:', error);
                }
              }
            });
          } catch (error) {
            console.error('Error handling screencast frame:', error);
          }
        });

        const viewport = instance.page.viewport();
        console.log(`Starting screencast with viewport ${viewport?.width}x${viewport?.height}`);
        
        await cdpSession.send('Page.startScreencast', {
          format: 'jpeg',
          quality: 80,
          maxWidth: viewport?.width || 1920,
          maxHeight: viewport?.height || 1080,
          everyNthFrame: 1,
        });

        console.log(`Screencast started successfully for session ${sessionId}`);
      } catch (error) {
        console.error(`Failed to start screencast for session ${sessionId}:`, error);
        instance.cdpSession = undefined;
        throw error;
      }
    } else {
      console.log(`CDP session already exists for ${sessionId}, reusing it`);
    }
  }

  /**
   * Stop screencast for a session
   */
  async stopScreencast(sessionId: string, ws: WebSocket): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance) return;

    instance.streamClients.delete(ws);

    if (instance.streamClients.size === 0 && instance.cdpSession) {
      try {
        await instance.cdpSession.send('Page.stopScreencast');
        await instance.cdpSession.detach();
        instance.cdpSession = undefined;
        console.log(`Stopped screencast for session ${sessionId}`);
      } catch (error) {
        console.error('Error stopping screencast:', error);
      }
    }
  }

  /**
   * Dispatch mouse event via CDP
   */
  async dispatchMouseEvent(sessionId: string, type: string, x: number, y: number, button?: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance?.page) {
      throw new Error("Session not running");
    }

    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    const mouseButton = button || 'left';

    console.log(`Dispatching mouse event: ${type} at (${roundedX}, ${roundedY}), button: ${mouseButton}`);

    try {
      // Check if page is still alive
      if (instance.page.isClosed()) {
        console.log(`Page is closed, ignoring mouse event`);
        return;
      }

      if (type === 'mouseMoved') {
        await instance.page.mouse.move(roundedX, roundedY);
      } else if (type === 'mousePressed') {
        await instance.page.mouse.move(roundedX, roundedY);
        await instance.page.mouse.down({ button: mouseButton as any });
      } else if (type === 'mouseReleased') {
        await instance.page.mouse.up({ button: mouseButton as any });
      }

      await this.saveCookies(sessionId, instance.page);
    } catch (error: any) {
      // Silently ignore errors from closed pages
      if (error.message && error.message.includes('Session closed')) {
        console.log(`Page session closed, ignoring mouse event`);
        return;
      }
      console.error(`Error dispatching mouse event: ${error}`);
      throw error;
    }
  }

  /**
   * Dispatch keyboard event via CDP
   */
  async dispatchKeyEvent(sessionId: string, type: string, key: string, text?: string): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance?.page) {
      throw new Error("Session not running");
    }

    console.log(`Dispatching key event: ${type}, key: ${key}, text: ${text || 'none'}`);

    try {
      // Check if page is still alive
      if (instance.page.isClosed()) {
        console.log(`Page is closed, ignoring key event`);
        return;
      }

      if (type === 'keyDown') {
        await instance.page.keyboard.down(key as any);
        if (text) {
          await instance.page.keyboard.sendCharacter(text);
        }
      } else if (type === 'keyUp') {
        await instance.page.keyboard.up(key as any);
      }
    } catch (error: any) {
      // Silently ignore errors from closed pages
      if (error.message && error.message.includes('Session closed')) {
        console.log(`Page session closed, ignoring key event`);
        return;
      }
      console.error(`Error dispatching key event: ${error}`);
      throw error;
    }
  }

  /**
   * Dispatch scroll event via CDP
   */
  async dispatchScrollEvent(sessionId: string, deltaX: number, deltaY: number): Promise<void> {
    const instance = activeBrowsers.get(sessionId);
    if (!instance?.page) {
      throw new Error("Session not running");
    }

    try {
      // Check if page is still alive
      if (instance.page.isClosed()) {
        console.log(`Page is closed, ignoring scroll event`);
        return;
      }

      await instance.page.evaluate((dx, dy) => {
        window.scrollBy(dx, dy);
      }, deltaX, deltaY);
    } catch (error: any) {
      // Silently ignore errors from closed pages
      if (error.message && error.message.includes('Session closed')) {
        console.log(`Page session closed, ignoring scroll event`);
        return;
      }
      console.error(`Error dispatching scroll event: ${error}`);
      throw error;
    }
  }
}

export const browserManager = new BrowserSessionManager();

/**
 * Restore running sessions on server startup
 */
export async function restoreRunningSessions(): Promise<void> {
  console.log("Restoring running browser sessions...");
  try {
    // Get all sessions from storage
    const allSessions = await storage.getBrowserSessionsByUserId("admin");
    const runningSessions = allSessions.filter(s => s.status === "running");

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
