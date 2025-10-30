import './ShareAssetButton.css';
import '../../../scripts/toast/toast.css';
import showToast from '../../../scripts/toast/toast.js';

export default function ShareAssetButton({ assetId, disabled = false }) {
  const handleShare = async (e) => {
    console.debug('[ShareButton] handleShare called with assetId:', assetId); // TEMP: Verify this runs
    e.stopPropagation();
    
    if (!assetId) {
      console.warn('No assetId provided for sharing');
      return;
    }

    // Build the share URL
    const shareUrl = `${window.location.protocol}//${window.location.host}/asset-details?assetid=${assetId}`;
    
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      console.debug('Share link copied to clipboard:', shareUrl);
      showToast('Asset link copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy share link to clipboard:', error);
      // Fallback for older browsers
      fallbackCopyToClipboard(shareUrl);
    }
  };

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
      console.debug('Share link copied to clipboard (fallback):', text);
      showToast('Asset link copied to clipboard', 'success');
    } catch (err) {
      console.error('Fallback: Could not copy text:', err);
      showToast('Failed to copy link to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
  };

  return (
    <button
      className="share-asset-button"
      onClick={handleShare}
      disabled={disabled}
      aria-label="Share Asset"
      title="Share Asset"
    />
  );
}

