import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Browser sessions table - stores persistent browser automation sessions
export const browserSessions = pgTable("browser_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  status: varchar("status", { enum: ["running", "paused", "stopped", "error"] }).notNull().default("stopped"),
  userAgent: text("user_agent"),
  viewportWidth: integer("viewport_width").default(1920),
  viewportHeight: integer("viewport_height").default(1080),
  sessionData: jsonb("session_data"), // Store any additional session configuration
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const browserSessionsRelations = relations(browserSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [browserSessions.userId],
    references: [users.id],
  }),
  cookies: many(cookies),
}));

export type BrowserSession = typeof browserSessions.$inferSelect;
export type InsertBrowserSession = typeof browserSessions.$inferInsert;

export const insertBrowserSessionSchema = createInsertSchema(browserSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActivityAt: true,
});

export type InsertBrowserSessionInput = z.infer<typeof insertBrowserSessionSchema>;

// Cookies table - stores cookies for each browser session
export const cookies = pgTable("cookies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => browserSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: text("value").notNull(),
  domain: text("domain"),
  path: text("path"),
  expires: timestamp("expires"),
  httpOnly: boolean("http_only").default(false),
  secure: boolean("secure").default(false),
  sameSite: varchar("same_site", { enum: ["Strict", "Lax", "None"] }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cookiesRelations = relations(cookies, ({ one }) => ({
  browserSession: one(browserSessions, {
    fields: [cookies.sessionId],
    references: [browserSessions.id],
  }),
}));

export type Cookie = typeof cookies.$inferSelect;
export type InsertCookie = typeof cookies.$inferInsert;

export const insertCookieSchema = createInsertSchema(cookies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCookieInput = z.infer<typeof insertCookieSchema>;
