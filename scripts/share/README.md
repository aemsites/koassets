# Share Assets Modal

This module implements the Share Assets functionality for the KOAssets application.

## Files

- `share-assets-modal.js` - Main JavaScript module for the share modal
- `share-assets-modal.css` - Styles for the share modal

## Features

- Share single or multiple selected assets
- Two-column modal layout:
  - **Left Column**: List of selected assets with thumbnails
  - **Right Column**: Share form with:
    - Email address input (required)
    - Message textarea (optional)
- Form validation for email addresses
- Toast notifications for success/error states
- Responsive design for mobile devices

## Usage

The modal is automatically initialized when the page loads. It listens for the `openShareModal` custom event dispatched from React components.

### From React Components

```javascript
// Share single asset
const event = new CustomEvent('openShareModal', {
  detail: {
    asset: assetObject
  }
});
window.dispatchEvent(event);

// Share multiple assets
const event = new CustomEvent('openShareModal', {
  detail: {
    assets: [asset1, asset2, asset3]
  }
});
window.dispatchEvent(event);
```

## Current Implementation Status

The modal is fully functional for UI demonstration. The Share button currently logs the following to the console:
- Email address
- Message (if provided)
- List of selected assets with IDs and names
- Total asset count

## Next Steps

To complete the implementation:
1. Implement the actual share API endpoint
2. Wire up the share action to call the backend service
3. Add proper error handling for API failures
4. Consider adding additional share options (link sharing, permissions, etc.)

