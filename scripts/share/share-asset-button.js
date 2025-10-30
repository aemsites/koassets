import showToast from '../toast/toast.js';

/**
 * Creates a share asset button DOM element
 * @param {Object} options - Button configuration
 * @param {string} options.assetId - The asset ID to share
 * @param {boolean} [options.disabled=false] - Whether the button is disabled
 * @returns {HTMLButtonElement} The button element
 */
// eslint-disable-next-line import/prefer-default-export
export function createShareAssetButton({ assetId, disabled = false }) {
  const button = document.createElement('button');
  button.className = 'share-asset-button';
  button.disabled = disabled;
  button.setAttribute('aria-label', 'Share Asset');
  button.setAttribute('title', 'Share Asset');

  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      // eslint-disable-next-line no-console
      console.debug('Share link copied to clipboard (fallback):', text);
      showToast('Asset link copied to clipboard', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fallback: Could not copy text:', err);
      showToast('Failed to copy link to clipboard', 'error');
    }

    document.body.removeChild(textArea);
  };

  const handleShare = async (e) => {
    // eslint-disable-next-line no-console
    console.debug('[ShareButton] handleShare called with assetId:', assetId);
    e.stopPropagation();

    if (!assetId) {
      // eslint-disable-next-line no-console
      console.warn('No assetId provided for sharing');
      return;
    }

    // Build the share URL
    const shareUrl = `${window.location.protocol}//${window.location.host}/asset-details?assetid=${assetId}`;

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      // eslint-disable-next-line no-console
      console.debug('Share link copied to clipboard:', shareUrl);
      showToast('Asset link copied to clipboard', 'success');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy share link to clipboard:', error);
      // Fallback for older browsers
      fallbackCopyToClipboard(shareUrl);
    }
  };

  button.onclick = handleShare;

  return button;
}
