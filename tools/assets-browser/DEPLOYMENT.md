# Static Deployment Guide

## Overview

This directory contains the built React application for static deployment (no server-side building).

## Files

- `index.html` - Main HTML file with embedded config
- `assets/` - Built JavaScript and CSS files

## Deployment Options

### Option 1: Server-Side Template (Recommended for Dynamic Environments)


**Build command:**

```bash
cd koassets-react && npm run build:template
```

**Result:** Template in `index.html`:

```html
<script>
  window.APP_CONFIG = {
  };
</script>
```

**Target server processing:**

```bash
# Using envsubst (Linux/Unix)
envsubst < index.html > index.html.tmp && mv index.html.tmp index.html

# Using Node.js/PHP/Python server-side templating
# Process the template with your preferred templating engine
```

### Option 2: Embedded Config (Static Values)

**✅ No separate config.js file needed!** Config is embedded directly in HTML.

**Zsh/Bash:**

```bash
cd koassets-react && npm run build:embed
```

**PowerShell:**

```powershell
cd koassets-react; npm run build:embed
```

**Result:** Config embedded in `index.html`:

```html
<script>
  window.APP_CONFIG = {
  };
</script>
```



## Deployment Workflow

### Option 1: Server-Side Template (Best for Production)

1. **Build locally**: `cd koassets-react && npm run build:template`
2. **Upload files**: Copy `tools/assets-browser/` to your server
4. **Test**: Verify the app loads and authenticates correctly

### Option 2: Static Embedded Config (Currently Used)

1. **Build locally** using the embedded config command above
2. **Upload** the entire `tools/assets-browser/` directory to your static host
3. **Test** that the app loads and authenticates correctly

## Security

- ✅ No sensitive data in git repository
- ✅ Config values only exist locally and on deployment server
- ✅ Values are client-side identifiers (safe to be visible to users)

## Troubleshooting

- **404 on config.js**: Use Option 1 (embedded config) instead
- **Build fails**: Run `npm install` first, then try the build command again
