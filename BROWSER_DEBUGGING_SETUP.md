# Cursor AI Browser Debugging Setup

This guide will configure Cursor AI to automatically use browser developer tools for debugging - capturing console logs, network requests, and screenshots without you having to manually provide them.

---

## Setup Prompt

Copy and paste this into Cursor (customize the values in brackets):

```
I want you to proactively use browser debugging tools during development without me needing to provide console logs or screenshots manually.

My Setup:
- Local dev server URL: [YOUR_LOCAL_URL] (e.g., http://localhost:3000)
- Tech stack: [YOUR_STACK] (e.g., React frontend, Node.js backend, etc.)

Development Workflow:
When I report a bug or issue, I want you to automatically:
1. Navigate to the relevant page on my local dev server
2. Capture console messages (errors, warnings, logs)
3. Check network requests for API failures
4. Take page snapshots to understand the current state
5. Use this information to diagnose and fix the issue

When to Use Browser Tools:
- Automatically when I report any bug or error
- When implementing features that could break existing functionality
- When investigating strange behavior or issues
- Before marking work as complete

Rules:
- Always remove debug statements and console.logs before committing code
- Make debugging faster by being self-sufficient instead of asking me for logs
- Use browser tools proactively, not reactively

Please:
1. Save this workflow as a memory/rule for this project
2. Confirm you can access browser tools
3. Test by navigating to my local dev server (when I tell you it's running)

This will make our development workflow much faster!
```

---

## Test the Setup

After pasting the prompt above, start your dev server and test with:

```
I've started my development server. Please test the browser debugging workflow:

1. Navigate to [YOUR_LOCAL_URL]
2. Capture the current page state
3. Get all console messages
4. Check network requests
5. Summarize what you found (errors, warnings, successful loads, etc.)

This will confirm everything is working.
```

---

## Example Usage

Once set up, you can simply say things like:

**Instead of this (old way):**
```
"The search feature isn't working. Let me check the console... 
[opens DevTools, takes screenshot, pastes to Cursor]
Here's the error I'm seeing..."
```

**Do this (new way):**
```
"The search feature isn't working"
```

Cursor will automatically:
- Navigate to the search page
- Capture console errors
- Check API calls
- Diagnose: "I see a 403 error on /api/search - authentication issue. Let me fix..."

---

## What Cursor Can Do Automatically

### Console Debugging
- Capture all console.log, console.error, console.warn
- See JavaScript errors with stack traces
- Monitor warnings and info messages

### Network Analysis
- View all HTTP requests (GET, POST, etc.)
- Check response status codes (200, 404, 500, etc.)
- Identify failed API calls
- See what resources loaded successfully

### Page State
- Take screenshots of current page
- Capture page structure (accessibility tree)
- See what elements are visible/clickable
- Understand current UI state

### Interactive Debugging
- Click buttons to trigger errors
- Fill forms to test validation
- Navigate between pages
- Simulate user interactions

---

## Real-World Examples

### Example 1: Button Not Working
**You:** "The submit button doesn't do anything"

**Cursor automatically:**
1. Navigates to the page
2. Clicks the submit button
3. Checks console: "Uncaught TypeError: validateForm is not defined"
4. Fixes the missing import
5. Verifies the fix works

### Example 2: API Call Failing
**You:** "User data isn't loading"

**Cursor automatically:**
1. Loads the user profile page
2. Checks network: "GET /api/user returned 401 Unauthorized"
3. Sees: Missing Authorization header
4. Fixes auth token handling
5. Confirms data loads

### Example 3: Style Issues
**You:** "The header looks weird on mobile"

**Cursor automatically:**
1. Takes screenshot of current state
2. Resizes browser to mobile viewport
3. Takes another screenshot
4. Identifies: "Header height is fixed, causing overflow"
5. Fixes CSS responsiveness

---

## Tips for Best Results

### Be Specific About Where
❌ "Something's broken"
✅ "The login button on /auth/login isn't working"

### Mention When It Happens
❌ "There's an error"
✅ "Error appears when I click submit after filling the form"

### Describe Expected Behavior
❌ "It's wrong"
✅ "Should show success message but shows error instead"

### Let Cursor Do the Rest
You don't need to:
- Open DevTools yourself
- Take screenshots
- Copy/paste error messages
- Describe what you see in console
- List network requests

Cursor will do all of that automatically!

---

## Troubleshooting

### Browser tools not working?
1. **Check dev server is running:** Cursor can't access localhost if it's not running
2. **Verify URL is correct:** Make sure you gave the right localhost URL and port
3. **Check Cursor settings:** Ensure browser integration is enabled

### Can't access local server?
- Make sure your dev server is actually running (`npm start`, etc.)
- Verify the port matches what you configured (3000, 8080, 8787, etc.)
- Check for firewall/security software blocking local connections

### Getting connection errors?
- Restart your dev server
- Restart Cursor
- Check browser extension is installed/enabled

---

## Advanced: Custom Dev Workflows

You can customize the workflow further:

```
Also, for this project:
- Before checking in code, always verify no console errors exist
- When implementing new features, test in both desktop and mobile viewports
- For API changes, verify all endpoints return expected status codes
- Take screenshots before/after when fixing visual bugs for documentation
```

---

## Summary

**One-time setup:** ~2 minutes to paste the prompt and test

**Benefit:** Cursor automatically debugs issues without you having to:
- Open DevTools manually
- Copy/paste errors
- Take screenshots
- Describe what you're seeing

**Result:** Faster debugging, faster development, less context switching!

---

Created by: @sharmon
Last updated: November 2025





