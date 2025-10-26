import {
  users,
  browserSessions,
  cookies,
  type User,
  type UpsertUser,
  type BrowserSession,
  type InsertBrowserSession,
  type Cookie,
  type InsertCookie,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Browser session operations
  async getBrowserSession(id: string): Promise<BrowserSession | undefined> {
    const [session] = await db
      .select()
      .from(browserSessions)
      .where(eq(browserSessions.id, id));
    return session;
  }

  async getBrowserSessionsByUserId(userId: string): Promise<BrowserSession[]> {
    return await db
      .select()
      .from(browserSessions)
      .where(eq(browserSessions.userId, userId))
      .orderBy(browserSessions.createdAt);
  }

  async createBrowserSession(sessionData: InsertBrowserSession): Promise<BrowserSession> {
    const [session] = await db
      .insert(browserSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async updateBrowserSession(
    id: string,
    updates: Partial<InsertBrowserSession>
  ): Promise<BrowserSession> {
    const [session] = await db
      .update(browserSessions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(browserSessions.id, id))
      .returning();
    return session;
  }

  async deleteBrowserSession(id: string): Promise<void> {
    await db.delete(browserSessions).where(eq(browserSessions.id, id));
  }

  // Cookie operations
  async getSessionCookies(sessionId: string): Promise<Cookie[]> {
    return await db
      .select()
      .from(cookies)
      .where(eq(cookies.sessionId, sessionId))
      .orderBy(cookies.createdAt);
  }

  async createCookie(cookieData: InsertCookie): Promise<Cookie> {
    const [cookie] = await db
      .insert(cookies)
      .values(cookieData)
      .returning();
    return cookie;
  }

  async clearSessionCookies(sessionId: string): Promise<void> {
    await db.delete(cookies).where(eq(cookies.sessionId, sessionId));
  }
}

export const storage = new DatabaseStorage();
