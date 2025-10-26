# Browser Automation Dashboard

A powerful persistent browser automation system built with React, Express, and Puppeteer. Manage browser sessions that run continuously in the background with full interactive capabilities.

## Features

- **Persistent Browser Sessions** - Sessions continue running even when you close the interface
- **Full Browser Interaction** - Click, type, scroll, select text, and upload files just like a real browser
- **Cookie Management** - View and manage cookies for each session
- **Live Browser View** - See and interact with your browser sessions in real-time
- **Session Control** - Pause, resume, and stop sessions at any time
- **Multiple Sessions** - Run multiple browser instances simultaneously

## Quick Start

### 1. Access the Application

Open your browser and navigate to the application URL. You'll see the landing page.

### 2. Log In

Click the "Log In" button on the landing page. This will authenticate you using your Replit account.

### 3. Create a Browser Session

Once logged in, you have several options to create a session:

#### Quick Start (Recommended)
- Click **"Google"** button to instantly start a Google session
- Click **"Deriv"** button to instantly start a Deriv session

#### Custom Session
- Click **"New Session"** button
- Enter your desired URL (e.g., https://google.com, https://deriv.com)
- Configure viewport size (default: 1920x1080)
- Optionally set a custom User Agent
- Click **"Create Session"**

### 4. Interact with Your Browser Session

Once a session is running:

1. **View Session**: Click the eye icon on any session card
2. **Interactive Features**:
   - **Click**: Click anywhere on the browser view
   - **Type**: Just start typing to send keyboard input
   - **Scroll**: Use your mouse wheel to scroll
   - **Select Text**: Click and drag to select text
   - **Upload Files**: Click the upload button and select a file
   - **Navigate**: Use the address bar to visit different pages
   - **Refresh**: Click the refresh button to reload the page

3. **Control Session**:
   - **Pause**: Temporarily pause the session
   - **Resume**: Resume a paused session
   - **Stop**: Stop the session completely
   - **View Cookies**: See all cookies for the session

## Interactive Features

### Clicking
Simply click on the browser view to interact with buttons, links, and other elements.

### Typing
Start typing while the browser view is focused - your keystrokes will be sent to the browser session.

### Scrolling
Use your mouse wheel while hovering over the browser view to scroll the page.

### Text Selection
Click and drag to select text, just like in a regular browser.

### File Uploads
1. Click the "Upload" button in the browser viewer
2. Select a file from your computer
3. The file will be uploaded to the browser session

### Navigation
- Enter a URL in the address bar and press Enter
- Use the back/forward buttons to navigate history
- Click the home button to return to the session's original URL
- Click refresh to reload the current page

## Session Management

### Metrics Dashboard
View real-time metrics:
- **Active Sessions**: Number of currently running sessions
- **Total Sessions**: Total number of sessions created
- **Stored Cookies**: Cookie storage information

### Session Cards
Each session shows:
- Domain/URL
- Current status (running, paused, stopped, error)
- Last activity time
- Viewport dimensions

### Session Controls
- 🎬 **Play/Pause**: Start or pause the session
- ⏹️ **Stop**: Stop the session
- 👁️ **View**: Open the interactive browser viewer
- 🍪 **Cookies**: View session cookies
- ⚙️ **Settings**: Configure session settings

## Tips for Best Results

1. **Start with Quick Start buttons** for fastest setup with Google or Deriv
2. **Use standard viewport sizes** (1920x1080) for best compatibility
3. **Keep sessions running** to maintain state and cookies
4. **View cookies** to debug login or session issues
5. **Monitor the status** - sessions will show error state if something goes wrong

## Troubleshooting

### Session won't start
- Check that Chromium is installed (should be automatic)
- Verify the URL is valid and accessible
- Check the browser logs for error messages

### Can't interact with session
- Ensure the session status shows "running"
- Try refreshing the browser viewer
- Check that WebSocket connection is established

### Cookies not persisting
- Make sure the session remains "running"
- Cookies are automatically saved while the session is active
- View cookies to verify they're being stored

## Technical Details

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Browser Engine**: Puppeteer with Stealth plugin
- **UI Components**: shadcn/ui + Tailwind CSS
- **Real-time Updates**: WebSocket for live browser streaming
- **Storage**: In-memory with session persistence

## Security

- Authentication required for all sessions
- Sessions are isolated per user
- Secure WebSocket connections for browser viewing
- Cookie data encrypted and stored securely

---

**Ready to automate?** Log in and click "Google" or "Deriv" to get started in seconds!
