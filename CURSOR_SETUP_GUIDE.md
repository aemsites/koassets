# Cursor AI Setup Guide - MCP Servers & Browser Debugging

This guide will help you set up Cursor with MCP (Model Context Protocol) servers for JIRA and Confluence/Wiki, plus browser debugging capabilities.

## Part 1: Setup MCP Servers for JIRA and Wiki

### Prerequisites
- Self-hosted JIRA instance (e.g., `jira.yourcompany.com`)
- Self-hosted Confluence/Wiki instance (e.g., `wiki.yourcompany.com`)
- Personal Access Tokens (PATs) for both systems

### Prompt 1: Generate JIRA Personal Access Token

Paste this into Cursor:

```
I need to set up MCP integration with my company's self-hosted JIRA instance.

My JIRA URL is: [YOUR_JIRA_URL] (e.g., jira.yourcompany.com)

Please help me:
1. Explain how to generate a Personal Access Token (PAT) for JIRA
2. What permissions the token needs
3. Where to find the token generation page in my JIRA instance

After I generate the token, I'll provide it to you for the setup.
```

### Prompt 2: Generate Confluence/Wiki Personal Access Token

Paste this into Cursor:

```
I need to set up MCP integration with my company's self-hosted Confluence/Wiki instance.

My Wiki URL is: [YOUR_WIKI_URL] (e.g., wiki.yourcompany.com)

Please help me:
1. Explain how to generate a Personal Access Token (PAT) for Confluence
2. What permissions the token needs
3. Where to find the token generation page in Confluence

After I generate the token, I'll provide it to you for the setup.
```

### Prompt 3: Setup JIRA MCP Server

After you have your JIRA PAT, paste this:

```
I want to set up an MCP server for my company's self-hosted JIRA instance that uses Personal Access Token (PAT) authentication.

Configuration details:
- JIRA Host: [YOUR_JIRA_HOST] (e.g., jira.yourcompany.com - without https://)
- My Email: [YOUR_EMAIL]
- Personal Access Token: [YOUR_JIRA_PAT]
- Project Key: [YOUR_PROJECT_KEY] (e.g., PROJ, DEV, etc.)

Requirements:
1. The server must use Bearer token authentication (not Basic Auth)
2. Use JIRA REST API v2 (our instance doesn't support v3)
3. Install in: ~/Documents/Cursor/mcp-servers/ (or adjust for my OS)
4. Configure in ~/.cursor/mcp.json

Please:
1. Find or create an MCP server that works with self-hosted JIRA using PAT authentication
2. If needed, modify an existing community server to support Bearer tokens and API v2
3. Build and install it
4. Configure it in my mcp.json
5. Test the connection by fetching a JIRA issue

I'll provide the issue key after setup for testing.
```

### Prompt 4: Setup Confluence/Wiki MCP Server

After you have your Wiki PAT, paste this:

```
I want to set up an MCP server for my company's self-hosted Confluence/Wiki instance that uses Personal Access Token (PAT) authentication.

Configuration details:
- Confluence Host: [YOUR_WIKI_HOST] (e.g., wiki.yourcompany.com - without https://)
- Personal Access Token: [YOUR_WIKI_PAT]

Requirements:
1. The server must use Bearer token authentication
2. Support self-hosted Confluence (not Atlassian Cloud)
3. Install in: ~/Documents/Cursor/mcp-servers/ (same location as JIRA server)
4. Add to ~/.cursor/mcp.json alongside the JIRA server

MCP Tools needed:
- search-pages: Search using CQL (Confluence Query Language)
- get-page: Get page by ID
- get-page-by-title: Get page by space key and title
- list-spaces: List available spaces

Please:
1. Create a custom Confluence MCP server with these capabilities
2. Use TypeScript/Node.js
3. Build and install it
4. Configure it in my mcp.json
5. Test the connection by fetching a Wiki page

I'll provide a Wiki page URL after setup for testing.
```

### Prompt 5: Test and Verify MCP Servers

After setup is complete:

```
Please verify both MCP servers are working:

1. Test JIRA: Fetch issue [YOUR_ISSUE_KEY] (e.g., PROJ-123)
2. Test Wiki: Access page [YOUR_WIKI_PAGE_URL]

If there are any errors:
- Check console logs
- Verify authentication is using Bearer tokens
- Confirm API versions (v2 for JIRA)
- Test the URLs and tokens directly with curl if needed
```

---

## Part 2: Setup Browser Debugging Workflow

### Prompt 6: Enable Automatic Browser Debugging

Paste this into Cursor:

```
I want you to proactively use browser debugging tools during development without me having to provide console logs or screenshots manually.

Setup requirements:
- My local dev server runs at: [YOUR_LOCAL_URL] (e.g., http://localhost:3000)
- Stack components: [DESCRIBE YOUR STACK] (e.g., React frontend, Express backend, etc.)

Workflow I want:
1. When I report a bug, automatically navigate to the page and capture:
   - Console errors, warnings, and logs
   - Network requests and API failures
   - Page snapshots to understand state
2. When implementing risky features, check the browser to verify functionality
3. When investigating issues, use browser tools to self-diagnose

Rules:
- Always remove debug statements and console.logs before production
- Use this automatically when: bugs reported, implementing features, investigating issues
- Make debugging faster by being self-sufficient instead of asking me for logs

Please:
1. Create a memory/rule for this debugging workflow
2. Test the browser connection to my local dev environment
3. Show me an example of automatic debugging in action

Note: My dev server needs to be running for testing. I'll let you know when it's ready.
```

### Prompt 7: Test Browser Debugging

After your dev server is running:

```
My development server is now running at [YOUR_LOCAL_URL].

Please test the browser debugging workflow:
1. Navigate to the local server
2. Capture the page snapshot
3. Get console messages
4. Check network requests
5. Summarize what you found (any errors, warnings, successful loads, etc.)

This will confirm the browser tools are working correctly.
```

---

## Expected File Structure After Setup

```
~/Documents/Cursor/mcp-servers/
├── jira-mcp/                    # Modified community server
│   ├── build/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
└── confluence-mcp/              # Custom server
    ├── build/
    ├── src/
    ├── package.json
    └── tsconfig.json

~/.cursor/mcp.json               # Configuration file
```

## Your mcp.json Should Look Like:

```json
{
  "mcpServers": {
    "company-jira": {
      "command": "node",
      "args": ["/full/path/to/mcp-servers/jira-mcp/build/index.js"],
      "env": {
        "JIRA_HOST": "jira.yourcompany.com",
        "JIRA_USERNAME": "your.email@company.com",
        "JIRA_API_TOKEN": "your_jira_pat_token",
        "JIRA_PROJECT_KEY": "PROJ"
      }
    },
    "company-wiki": {
      "command": "node",
      "args": ["/full/path/to/mcp-servers/confluence-mcp/build/index.js"],
      "env": {
        "CONFLUENCE_HOST": "wiki.yourcompany.com",
        "CONFLUENCE_API_TOKEN": "your_wiki_pat_token"
      }
    }
  }
}
```

---

## Troubleshooting Tips

### If MCP servers don't connect:
1. Restart Cursor completely (quit and reopen)
2. Check paths in mcp.json are absolute paths
3. Verify tokens haven't expired
4. Check if VPN is required for company systems

### If authentication fails:
1. Verify Bearer token format (not Basic Auth)
2. Test tokens with curl commands first
3. Check API version (v2 vs v3 for JIRA)

### If browser tools don't work:
1. Ensure local dev server is running
2. Check the correct port/URL
3. Verify Cursor has browser extension enabled

---

## What You'll Be Able To Do

### With JIRA MCP:
- "Get details for issue PROJ-123"
- "Search for all open bugs in my project"
- "Create a new story for implementing X"
- "Update issue PROJ-456 with sprint info"

### With Wiki MCP:
- "Search for pages about authentication"
- "Get the DevOps documentation page"
- "List all available Wiki spaces"
- "Show me content from the API guide"

### With Browser Debugging:
- Report a bug → AI automatically checks console/network
- Implement a feature → AI verifies it works in browser
- Investigate issues → AI captures full debug context

---

## Notes

- Replace all `[YOUR_*]` placeholders with your actual values
- Cursor AI will guide you through each step
- The setup takes ~15-20 minutes total
- You only need to do this once per machine
- After setup, restart Cursor to load the MCP servers

## Credits

This setup was created by @sharmon for the KO Assets project and adapted for general use.





