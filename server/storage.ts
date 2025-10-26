import type {
  User,
  BrowserSession,
  InsertBrowserSession,
  Cookie,
  InsertCookie,
} from "@shared/schema";
import { randomUUID } from "crypto";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  
  // Browser session operations
  getBrowserSession(id: string): Promise<BrowserSession | undefined>;
  getBrowserSessionsByUserId(userId: string): Promise<BrowserSession[]>;
  createBrowserSession(session: InsertBrowserSession): Promise<BrowserSession>;
  updateBrowserSession(id: string, updates: Partial<InsertBrowserSession>): Promise<BrowserSession>;
  deleteBrowserSession(id: string): Promise<void>;
  
  // Cookie operations
  getSessionCookies(sessionId: string): Promise<Cookie[]>;
  createCookie(cookie: InsertCookie): Promise<Cookie>;
  clearSessionCookies(sessionId: string): Promise<void>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private browserSessions: Map<string, BrowserSession> = new Map();
  private cookies: Map<string, Cookie> = new Map();

  constructor() {
    // Initialize admin user
    this.users.set("admin", {
      id: "admin",
      username: process.env.ADMIN_USERNAME || "admin",
    });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  // Browser session operations
  async getBrowserSession(id: string): Promise<BrowserSession | undefined> {
    return this.browserSessions.get(id);
  }

  async getBrowserSessionsByUserId(userId: string): Promise<BrowserSession[]> {
    return Array.from(this.browserSessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createBrowserSession(sessionData: InsertBrowserSession): Promise<BrowserSession> {
    const id = randomUUID();
    const now = new Date();
    const session: BrowserSession = {
      id,
      userId: sessionData.userId,
      url: sessionData.url,
      status: sessionData.status || "stopped",
      userAgent: sessionData.userAgent,
      viewportWidth: sessionData.viewportWidth || 1920,
      viewportHeight: sessionData.viewportHeight || 1080,
      sessionData: sessionData.sessionData,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.browserSessions.set(id, session);
    return session;
  }

  async updateBrowserSession(
    id: string,
    updates: Partial<InsertBrowserSession>
  ): Promise<BrowserSession> {
    const session = this.browserSessions.get(id);
    if (!session) {
      throw new Error("Session not found");
    }
    
    const updatedSession: BrowserSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.browserSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteBrowserSession(id: string): Promise<void> {
    this.browserSessions.delete(id);
    // Also delete associated cookies
    const entries = Array.from(this.cookies.entries());
    for (const [cookieId, cookie] of entries) {
      if (cookie.sessionId === id) {
        this.cookies.delete(cookieId);
      }
    }
  }

  // Cookie operations
  async getSessionCookies(sessionId: string): Promise<Cookie[]> {
    const allCookies = Array.from(this.cookies.values());
    return allCookies.filter(cookie => cookie.sessionId === sessionId);
  }

  async createCookie(cookieData: InsertCookie): Promise<Cookie> {
    const id = randomUUID();
    const now = new Date();
    const cookie: Cookie = {
      id,
      sessionId: cookieData.sessionId,
      name: cookieData.name,
      value: cookieData.value,
      domain: cookieData.domain || null,
      path: cookieData.path || null,
      expires: cookieData.expires || null,
      httpOnly: cookieData.httpOnly || false,
      secure: cookieData.secure || false,
      sameSite: cookieData.sameSite || null,
      createdAt: now,
      updatedAt: now,
    };
    this.cookies.set(id, cookie);
    return cookie;
  }

  async clearSessionCookies(sessionId: string): Promise<void> {
    const entries = Array.from(this.cookies.entries());
    for (const [cookieId, cookie] of entries) {
      if (cookie.sessionId === sessionId) {
        this.cookies.delete(cookieId);
      }
    }
  }
}

export const storage = new MemStorage();
