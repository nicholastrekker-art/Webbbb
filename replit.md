# Browser Automation Dashboard

## Overview

A persistent browser automation system built as a full-stack web application. This platform enables users to manage browser sessions that run continuously in the background, maintaining cookies and session state for use cases like trading bots, web automation tasks, and persistent web applications. The system provides a Linear-inspired dashboard interface for creating, monitoring, and controlling automated browser instances.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR support
- Single-page application (SPA) with client-side routing via Wouter

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library following the "New York" style variant
- Tailwind CSS for utility-first styling with custom design tokens
- Design system inspired by Linear's minimalist aesthetic with Material Design patterns

**State Management**
- TanStack Query (React Query) for server state management and caching
- Automatic refetching every 5 seconds for real-time session status updates
- React Hook Form with Zod validation for form state and validation
- Local component state using React hooks

**Key Design Decisions**
- Component library uses CSS variables for theming, enabling future dark mode support
- All interactive states (hover, active) use elevation patterns rather than color changes
- Typography system uses Inter for UI text and JetBrains Mono for technical data
- Responsive layout with mobile-first approach using Tailwind breakpoints

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- Node.js runtime with ESM module system
- TypeScript for type safety across backend code

**Browser Automation Engine**
- Puppeteer as the headless browser automation library
- Puppeteer Stealth plugin to avoid bot detection mechanisms
- Browser instance pooling via in-memory Map for active session management
- Each session maintains isolated browser context with cookies and viewport settings

**Session Management Strategy**
- Sessions persist across server restarts via database storage
- Active browser instances stored in memory with session ID mapping
- Cookie serialization/deserialization for session state preservation
- Viewport and user agent customization per session

**Authentication & Authorization**
- Replit OpenID Connect (OIDC) authentication via Passport.js
- Session storage using connect-pg-simple with PostgreSQL backend
- HTTP-only secure cookies for session tokens
- User data stored and synchronized from OIDC provider

**API Architecture**
- RESTful API endpoints under `/api` prefix
- Authentication middleware protecting all session routes
- JSON request/response format with error handling
- Request logging middleware for API observability

### Data Storage

**Database System**
- PostgreSQL as the primary database (Neon serverless)
- Drizzle ORM for type-safe database queries and migrations
- Connection pooling via @neondatabase/serverless with WebSocket support

**Schema Design**
- `users` table: Stores user profiles from OIDC authentication (mandatory for Replit Auth)
- `sessions` table: Express session storage (mandatory for Replit Auth)
- `browser_sessions` table: Browser automation session metadata with foreign key to users
- `cookies` table: Serialized cookie data per browser session

**Key Schema Decisions**
- UUID primary keys for distributed system compatibility
- Cascade deletion: Removing a user deletes all their browser sessions and cookies
- Status enum for session states: running, paused, stopped, error
- Timestamps for created/updated tracking and session activity monitoring
- JSONB for flexible cookie attribute storage

### External Dependencies

**Authentication Service**
- Replit OIDC provider for user authentication
- Required environment variables: `REPL_ID`, `ISSUER_URL`, `SESSION_SECRET`, `REPLIT_DOMAINS`
- User profile data synced including email, name, and profile image

**Database Service**
- Neon PostgreSQL serverless database
- Required environment variable: `DATABASE_URL`
- WebSocket connections for serverless deployment compatibility

**Browser Automation**
- Puppeteer with Chromium bundled
- Stealth plugin for anti-detection capabilities
- Launch arguments configured for containerized environments (--no-sandbox flags)

**Third-Party UI Libraries**
- Google Fonts CDN for Inter and JetBrains Mono typography
- Radix UI component primitives for accessibility
- Lucide React for icon system

**Development Tools**
- Replit-specific Vite plugins for development experience (cartographer, dev-banner, runtime-error-modal)
- ESBuild for production server bundling
- Drizzle Kit for database migrations