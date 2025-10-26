# Design Guidelines: Persistent Browser Automation Dashboard

## Design Approach
**Selected System**: Linear-inspired modern dashboard aesthetic with Material Design component patterns
**Justification**: This technical dashboard requires clarity, efficiency, and information density. Linear's refined minimalism paired with Material's structured component system provides the perfect balance for a browser automation control panel.

## Typography
- **Primary Font**: 'Inter' via Google Fonts CDN
- **Headings**: font-semibold (600 weight)
  - Page titles: text-2xl
  - Section headers: text-lg
  - Card headers: text-base
- **Body Text**: font-normal (400 weight), text-sm for primary content, text-xs for metadata/timestamps
- **Monospace**: 'JetBrains Mono' for URLs, session IDs, technical data

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, and 12
- Consistent padding: p-6 for cards, p-8 for main content areas
- Gap spacing: gap-4 for grids, gap-6 for major section separation
- Margins: mb-6 for section breaks, mb-2 for label-to-input

**Dashboard Structure**:
- Fixed sidebar navigation (w-64) with collapsible option
- Main content area with max-w-7xl container
- Two-column layout for session cards (grid-cols-1 lg:grid-cols-2)
- Three-column layout for status metrics (grid-cols-3)

## Component Library

### Navigation
- **Sidebar**: Fixed left panel with logo at top, navigation items with icons (24x24), active state with subtle accent indicator
- **Top Bar**: Full-width header with breadcrumbs, admin profile dropdown, notification bell

### Session Cards
Each browser session displays as a card with:
- Session thumbnail/favicon (48x48)
- Website URL in monospace font
- Status indicator (running/paused/stopped) with colored dot
- Runtime duration timestamp
- Action buttons: View, Pause/Resume, Stop, Settings (icon-only, 32x32 touch targets)
- Progress indicator if applicable
- Card layout: p-6, rounded-lg, border, hover:shadow-md transition

### Status Dashboard
- **Metrics Row**: Three cards showing Active Sessions, Total Runtime, Stored Cookies
- Each metric card: Large number (text-3xl font-bold), label below (text-sm), icon accent (32x32)

### Session Management Table
For detailed view:
- Sortable columns: Session ID, Website, Status, Start Time, Actions
- Row height: h-16 for comfortable touch targets
- Alternating row treatment for scannability
- Inline action buttons (icon-only) aligned right

### Authentication
- **Login Screen**: Centered card (max-w-md) on full viewport
- Admin logo/branding at top
- Input fields with labels, h-12 inputs with pl-4
- Primary action button: w-full, h-12
- "Remember me" checkbox below

### Modals & Overlays
- **Session Details Modal**: Fixed center, max-w-2xl width
- Cookie viewer with scrollable list (max-h-96)
- Settings panel with tabbed navigation
- Close button (top-right, 40x40 touch target)

### Forms & Inputs
- Label above input pattern, mb-2 spacing
- Input fields: h-12, px-4, rounded-md, border
- Consistent focus states across all inputs
- Helper text: text-xs, mt-1
- Error states with red accent and icon

### Buttons
- **Primary**: h-12, px-6, rounded-md, font-medium
- **Secondary**: Same size, border variant
- **Icon buttons**: 40x40 for toolbar, 32x32 for inline actions
- Disabled state: opacity-50, cursor-not-allowed

### Status Indicators
- **Running**: Green dot (w-2 h-2), pulsing animation
- **Paused**: Yellow dot, static
- **Stopped**: Gray dot, static
- **Error**: Red dot with warning icon

## Data Visualization
- Simple progress bars for session activity (h-2, rounded-full)
- Runtime charts using minimal line graphs (if showing session history)
- Toast notifications for events (top-right, slide-in animation)

## Icons
**Library**: Heroicons via CDN (outline for navigation, solid for status indicators)
- Navigation: 24x24
- Action buttons: 20x20
- Status dots: 8x8
- Large feature icons: 48x48

## Responsive Behavior
- **Mobile (base)**: Hamburger menu, stacked single column, bottom navigation bar for key actions
- **Tablet (md:)**: Collapsible sidebar, two-column session grid
- **Desktop (lg:)**: Full sidebar, multi-column layouts active

## Images
**Admin Dashboard** - No hero image needed. Focus on functional interface.
- Session thumbnails: Website favicons or screenshots (automated captures)
- Empty state illustrations: Simple icon-based graphics for "No active sessions"
- Admin avatar: Profile photo in top-right (40x40, rounded-full)

## Animations
**Minimal & Purposeful**:
- Status dot pulse for active sessions (animate-pulse)
- Card hover lift (transition-shadow duration-200)
- Modal fade-in (transition-opacity)
- Toast slide-in from top-right
- No scroll animations, no elaborate transitions

## Key Design Principles
1. **Information Hierarchy**: Most critical data (active sessions, status) always visible
2. **Scanability**: Clear visual separation between sessions, consistent card patterns
3. **Efficiency**: One-click access to common actions, keyboard shortcuts support
4. **Trust**: Clear status indicators, confirmation for destructive actions
5. **Technical Clarity**: Monospace for technical data, clear labeling, no ambiguity