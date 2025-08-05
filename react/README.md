# AEM Assets Browser

A React-based web application for browsing, searching, and managing Adobe Experience Manager (AEM) assets with integrated Adobe IMS authentication.

## Overview

This application provides a modern interface for interacting with Adobe Dynamic Media assets, featuring intelligent search, collection browsing, cart functionality, and seamless Adobe IMS authentication with automatic token renewal.

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

- **HTTP/HTTPS Support**: Flexible development with automatic protocol detection
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
│   ├── FacetFilter.jsx  # Search filtering
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
- **Development**: HTTP/HTTPS support with automatic certificate detection

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm package manager
- Adobe Developer Console project with Client ID

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ko-assets-search
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Adobe Client ID**

   **Option 1: Using Environment Variables (Recommended)**

   ```bash
   # Copy the example file
   cp env.example .env.local

   # Edit .env.local with your Client ID
   VITE_ADOBE_CLIENT_ID=your-actual-client-id-here
   ```

   **Option 2: Update the fallback in code**

   ```javascript
   // In src/components/AdobeSignInButton.jsx
   const imsConfig = {
     clientId:
       import.meta.env.VITE_ADOBE_CLIENT_ID || "your-adobe-client-id-here",
     // ...
   };
   ```

4. **Start the development server**

   ```bash
   npm run dev          # HTTPS mode (if certificates exist)
   npm run dev:http     # HTTP mode
   npm run dev:https    # Force HTTPS mode
   ```

### Local HTTPS Development (Optional)

For HTTPS development with trusted certificates:

1. **Install mkcert**

   ```bash
   # macOS
   brew install mkcert

   # Windows (using Chocolatey)
   choco install mkcert

   # Linux
   # See https://github.com/FiloSottile/mkcert#installation
   ```

2. **Create local Certificate Authority**

   ```bash
   mkcert -install
   ```

3. **Generate certificates for localhost**

   ```bash
   mkcert localhost
   ```

4. **Run with HTTPS**

   ```bash
   npm run dev    # Auto-detects certificates and uses HTTPS
   ```

5. **Access your app**
   - **HTTPS**: `https://localhost:5173/tools/assets-browser/`
   - **HTTP**: `http://localhost:5173/tools/assets-browser/`

### Adobe Developer Console Setup

1. **Create or access your Adobe Developer Console project**
2. **Add OAuth Web App**
3. **Configure Redirect URIs**:
   - `https://localhost:5173` (for HTTPS development)
   - `http://localhost:5173` (for HTTP development)
4. **Enable Required Scopes**:
   - `aem.assets.author`
   - `AdobeID`
   - `aem.repository`
   - `aem.folders`
   - `openid`

## Usage

### Getting Started

1. **Start the application**: `npm run dev`
2. **Open your browser**: Navigate to `https://localhost:5173/tools/assets-browser/`
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

- `npm run dev` - Start development server (auto-detects HTTPS/HTTP)
- `npm run dev:http` - Force HTTP development mode
- `npm run dev:https` - Force HTTPS development mode
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Configuration

The app automatically detects the protocol and configures Adobe IMS accordingly:

- **HTTPS Mode**: Uses `https://localhost:5173` as redirect URI (recommended)
- **HTTP Mode**: Uses `http://localhost:5173` as redirect URI

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

### Environment Variables & Security

**OAuth Client ID Security Model:**

- In OAuth 2.0 for public clients (SPAs), the **Client ID is not a secret**
- Security comes from **PKCE** (which we implement) and **redirect URI validation**
- No client secret is used in public client flows

**Best Practices:**

- Use environment variables for different environments (dev, staging, production)
- Keep `.env.local` files out of version control (already in `.gitignore`)
- Configure different Client IDs for different environments
- Ensure redirect URIs are properly configured in Adobe Developer Console

**Environment Variable Setup:**

```bash
# .env.local (for local development)
VITE_ADOBE_CLIENT_ID=your-dev-client-id

# .env.production (for production builds)
VITE_ADOBE_CLIENT_ID=your-prod-client-id
```

## Troubleshooting

### Common Issues

**HTTPS Certificate Issues**

- Ensure mkcert is properly installed and certificates are generated
- Try HTTP mode: `npm run dev:http`

**Adobe Authentication Failures**

- Verify Client ID in `AdobeSignInButton.jsx`
- Check redirect URIs in Adobe Developer Console
- Ensure popup blockers are disabled

**Token Expiration**

- Tokens automatically renew in the background
- If renewal fails, you'll be automatically signed out
- Re-authentication will be required

**Environment Variable Issues**

- Ensure `.env.local` file is in the project root (same level as `package.json`)
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
