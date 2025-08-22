# AEM Assets Browser

A React-based web application for browsing, searching, and managing Adobe Experience Manager (AEM) assets with integrated Adobe IMS authentication.

## Overview

This application provides a modern interface for interacting with Adobe Dynamic Media assets, featuring intelligent search, collection browsing, cart functionality, and seamless Adobe IMS authentication with automatic token renewal.

## Quick Reference

### 🚀 **Get Started Fast**

```bash
# for the proprietary@identity/imslib package
npm login --registry https://artifactory-uw2.adobeitc.com/artifactory/api/npm/npm-adobe-release

npm install
# Set up environment variables using .env.development or .env.production
npm run dev
```

### 🏗️ **Production Build**

```bash
# Option 1: Static embedded config (recommended)
VITE_ADOBE_CLIENT_ID=your-id VITE_BUCKET=your-bucket npm run build:embed

# Option 2: Use .env files
npm run build:prod

# Option 3: Deployment config
npm run build:deploy
```

### 📁 **Key Files**

- `src/components/MainApp.tsx` - Main application
- `src/components/AdobeSignInButton.tsx` - Authentication
- `src/utils/config.ts` - Configuration utility
- `.env.development`, `.env.production` - Environment-specific variables
- `tools/assets-browser/DEPLOYMENT.md` - Deployment guide

## Features

### 🔍 Asset Management

- **Smart Search**: Natural language and keyword-based asset search powered by Algolia
- **Asset Browsing**: Browse individual assets with optimized delivery and metadata
- **Collection Management**: Explore and navigate asset collections
- **Faceted Filtering**: Filter assets by format, subject, creation date, size, and keywords
- **Shopping Cart**: Add assets to cart for batch operations and approval workflows

### 🔐 Authentication & Security

- **Adobe IMS Integration**: Seamless authentication with Adobe Identity Management System
- **OAuth 2.0 + PKCE**: Secure Authorization Code flow with PKCE for enhanced security
- **Automatic Token Renewal**: Silent background token renewal 5 minutes before expiration
- **Popup Authentication**: Clean OAuth popup flow with automatic closure
- **Token Management**: Secure token storage with automatic expiration handling

### 🚀 Development Experience

- **HTTP Development**: Local development server with hot module replacement
- **Hot Module Replacement**: Fast development with Vite
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Responsive Design**: Modern UI that works on desktop and mobile

## Architecture

### Frontend Structure (`src/`)

```
src/
├── components/           # React components
│   ├── MainApp.tsx      # Primary application component
│   ├── AdobeSignInButton.jsx # Adobe IMS authentication component
│   ├── ImageGallery.jsx # Asset display grid
│   ├── CollectionGallery.jsx # Collection browsing
│   ├── CartPanel.jsx    # Shopping cart functionality
│   ├── Facets.jsx  # Search filtering
│   ├── SearchBar.tsx     # Search input component
│   └── AppRouter.jsx    # Application routing
├── utils/
│   └── formatters.js    # Utility functions for data formatting
├── assets/              # Static assets
├── App.tsx             # Root application component
├── main.tsx            # Application entry point
└── dynamicmedia-client.ts # Adobe Dynamic Media API client
```

### Key Components

#### AdobeSignInButton (`src/components/AdobeSignInButton.jsx`)

- **Adobe IMS Authentication**: Complete OAuth 2.0 + PKCE implementation
- **Automatic Token Renewal**: Silent background renewal with iframe
- **State Management**: Handles authentication state and token expiration
- **Error Handling**: Graceful fallback to manual sign-in on renewal failure

#### MainApp (`src/components/MainApp.tsx`)

- **Primary Interface**: Main application component handling asset browsing
- **Search Integration**: Algolia-powered search with faceted filtering
- **State Management**: Manages application state including assets, collections, and cart
- **Adobe Integration**: Interfaces with Adobe Dynamic Media through DynamicMediaClient

#### DynamicMediaClient (`src/dynamicmedia-client.ts`)

- **API Abstraction**: TypeScript client for Adobe Dynamic Media APIs
- **Asset Operations**: Metadata retrieval, search, and optimized delivery
- **Authentication**: Bearer token-based authentication
- **Error Handling**: Comprehensive error handling with meaningful messages

## Technical Stack

- **Framework**: React 19+ with Vite
- **Routing**: React Router DOM
- **Styling**: CSS with responsive design
- **State Management**: React hooks and localStorage
- **Authentication**: Adobe IMS OAuth 2.0 + PKCE
- **Search**: Algolia search integration
- **Build Tool**: Vite with hot module replacement
- **Development**: HTTP development server

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm package manager
- Adobe Developer Console project with Client ID

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd koassets-react
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Adobe Client ID and Bucket**

   **Option 1: Using Environment Variables (Recommended)**

   ```bash
   # Copy the example file to environment-specific file
   cp env.example .env.development

   # Edit .env.development with your Client ID and Bucket
   VITE_ADOBE_CLIENT_ID=your-actual-client-id-here
   VITE_BUCKET=your-adobe-dynamic-media-bucket-id
   ```

   **Option 2: Update the fallback in code**

   ```javascript
   // In src/components/AdobeSignInButton.jsx
   const imsConfig = {
     clientId:
       import.meta.env.VITE_ADOBE_CLIENT_ID || "your-adobe-client-id-here",
     // ...
   };

   // In src/components/MainApp.tsx
   const [bucket] =
     useState <
     string >
     (() => {
       try {
         return import.meta.env.VITE_BUCKET || "";
       } catch {
         return "";
       }
     });
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

### Adobe Developer Console Setup

1. **Create or access your Adobe Developer Console project**
2. **Add OAuth Web App**
3. **Configure Redirect URIs**:
   - `http://localhost:5173` (for development)
4. **Enable Required Scopes**:
   - `aem.assets.author`
   - `AdobeID`
   - `aem.repository`
   - `aem.folders`
   - `openid`

## Usage

### Getting Started

1. **Start the application**: `npm run dev`
2. **Open your browser**: Navigate to `http://localhost:5173/tools/assets-browser/index.html`
3. **Sign in with Adobe**: Click the "Sign in with Adobe" button
4. **Complete authentication**: Follow the Adobe login flow
5. **Start browsing**: Search for assets, browse collections, and manage your cart

### Asset Browsing

- **Search**: Use the search bar to find assets using keywords or natural language
- **Filter**: Apply faceted filters to narrow down results
- **Browse**: Navigate through asset results and collections
- **Cart**: Add assets to cart for batch operations

### Collections

- **Browse Collections**: Switch to collections view to explore organized asset groups
- **Collection Details**: View collection metadata and contained assets
- **Collection Navigation**: Use breadcrumbs to navigate between collections and assets

### Authentication Management

- **Automatic Sign-in**: The app remembers your authentication state
- **Token Renewal**: Tokens are automatically renewed in the background
- **Sign Out**: Click "Sign out" to clear all authentication data
- **Session Persistence**: Authentication survives page reloads

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Configuration

The app uses HTTP for local development and configures Adobe IMS accordingly:

- **Development Mode**: Uses `http://localhost:5173` as redirect URI

### Code Style

- **ESLint**: Configured with React-specific rules
- **Modern React**: Uses hooks and functional components
- **TypeScript**: Used for API client and type safety
- **Responsive CSS**: Mobile-first responsive design

## Architecture Decisions

### Authentication Flow

- **OAuth 2.0 + PKCE**: Most secure flow for single-page applications
- **Popup-based**: Clean user experience with automatic popup closure
- **Token Storage**: Secure storage in localStorage with expiration tracking
- **Silent Renewal**: Background token renewal using hidden iframe

### State Management

- **Local State**: React hooks for component-specific state
- **Persistence**: localStorage for cart items and authentication
- **Token Lifecycle**: Automatic expiration detection and renewal

### Performance Optimizations

- **Code Splitting**: Component-based code splitting with React Router
- **Image Optimization**: Optimized delivery through Adobe Dynamic Media
- **Token Caching**: Efficient token management with automatic renewal
- **Local Storage**: Persistent cart and authentication state

### Security

- **PKCE Implementation**: Prevents authorization code interception
- **Token Expiration**: Automatic token lifecycle management
- **Secure Storage**: Proper handling of sensitive authentication data
- **CORS**: Proper cross-origin resource sharing configuration

**Environment File Structure:**

Vite supports multiple environment files with the following loading priority:

1. Runtime environment variables (highest priority)
2. `.env.[mode]` - Mode-specific files (e.g., `.env.production`, `.env.development`)
3. `.env` - Base environment file
4. Default values in code (lowest priority)

**Environment Files Setup:**

```bash
# For Development
cp .env.development.template .env.development
# Edit .env.development with your real development values

# For Staging
cp .env.staging.template .env.staging
# Edit .env.staging with your real staging values

# For Production
cp .env.production.template .env.production
# Edit .env.production with your real production values
```

**Available Environment Files:**

- `env.example` - Template with placeholder values (copy this to create new env files)
- `.env.development.template` - Development template (copy to `.env.development`)
- `.env.staging.template` - Staging template (copy to `.env.staging`)
- `.env.production.template` - Production template (copy to `.env.production`)

**Security Note:** Only template files with placeholder values are committed to git. The actual `.env.development`, `.env.staging`, and `.env.production` files containing real secrets are gitignored.

**OAuth Client ID Security Model:**

- In OAuth 2.0 for public clients (SPAs), the **Client ID is not a secret**
- Security comes from **PKCE** (which we implement) and **redirect URI validation**
- No client secret is used in public client flows

**Best Practices:**

- Use environment variables for different environments (dev, staging, production)
- Keep environment-specific files (`.env.development`, `.env.production`) out of version control (already in `.gitignore`)
- Configure different Client IDs and Bucket IDs for different environments
- Ensure redirect URIs are properly configured in Adobe Developer Console

**Environment Variable Setup:**

```bash
# .env.development (for development)
VITE_ADOBE_CLIENT_ID=your-dev-client-id
VITE_BUCKET=your-dev-bucket-id

# .env.production (for production builds)
VITE_ADOBE_CLIENT_ID=your-prod-client-id
VITE_BUCKET=your-prod-bucket-id
```

### Building for Different Environments

#### Development Build

```bash
npm run build:dev
```

#### Staging Build

```bash
npm run build:staging
```

#### Production Build Options

**Option 1: Static Embedded Config (Recommended for Production)**

Build with values embedded directly at build time:

```bash
# PowerShell
$env:VITE_ADOBE_CLIENT_ID="your-client-id"; $env:VITE_BUCKET="your-bucket-name"; npm run build:embed

# Bash/Zsh
VITE_ADOBE_CLIENT_ID=your-client-id VITE_BUCKET=your-bucket-name npm run build:embed
```

**Result:** Creates `tools/assets-browser/index.html` with values embedded directly in the JavaScript.

**Option 2: Deployment Config**

Build with deployment-specific configuration:

```bash
npm run build:deploy
```

**Result:** Creates optimized build for deployment environments.

**Option 3: Legacy Build (Uses .env files)**

Uses your local `.env.production` file:

```bash
npm run build:prod
```

#### Which Production Build Should You Use?

- **Use Option 1** if you want static values embedded at build time (most straightforward)
- **Use Option 2** for deployment environments with specific configuration needs
- **Use Option 3** for local development/testing with your `.env` files

#### Environment-Specific Preview

```bash
npm run preview:staging  # Preview staging build
npm run preview:prod     # Preview production build
```

## Troubleshooting

### Common Issues

**Adobe Authentication Failures**

- Verify Client ID in `AdobeSignInButton.jsx`
- Check redirect URIs in Adobe Developer Console
- Ensure popup blockers are disabled

**Token Expiration**

- Tokens automatically renew in the background
- If renewal fails, you'll be automatically signed out
- Re-authentication will be required

**Environment Variable Issues**

- Ensure environment files (`.env.development`, `.env.production`) are in the project root (same level as `package.json`)
- Environment variables must start with `VITE_` to be accessible in frontend
- Restart the development server after changing environment variables
- Check browser console for "Adobe IMS Configuration" logs to verify Client ID

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is private and proprietary.
