import { z } from "zod";

// Simple user type for admin authentication
export interface User {
  id: string;
  username: string;
}

// Browser session type
export interface BrowserSession {
  id: string;
  userId: string;
  url: string;
  status: "running" | "paused" | "stopped" | "error";
  userAgent?: string;
  viewportWidth: number;
  viewportHeight: number;
  sessionData?: any;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const insertBrowserSessionSchema = z.object({
  userId: z.string(),
  url: z.string().url(),
  status: z.enum(["running", "paused", "stopped", "error"]).default("stopped"),
  userAgent: z.string().optional(),
  viewportWidth: z.number().default(1920),
  viewportHeight: z.number().default(1080),
  sessionData: z.any().optional(),
});

export type InsertBrowserSession = z.infer<typeof insertBrowserSessionSchema>;
export type InsertBrowserSessionInput = InsertBrowserSession;

// Cookie type
export interface Cookie {
  id: string;
  sessionId: string;
  name: string;
  value: string;
  domain?: string | null;
  path?: string | null;
  expires?: Date | null;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None" | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertCookie = Omit<Cookie, "id" | "createdAt" | "updatedAt">;

export const insertCookieSchema = z.object({
  sessionId: z.string(),
  name: z.string(),
  value: z.string(),
  domain: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  expires: z.date().nullable().optional(),
  httpOnly: z.boolean().default(false),
  secure: z.boolean().default(false),
  sameSite: z.enum(["Strict", "Lax", "None"]).nullable().optional(),
});

export type InsertCookieInput = z.infer<typeof insertCookieSchema>;
