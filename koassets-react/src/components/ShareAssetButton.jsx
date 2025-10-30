import { useRef, useEffect } from 'react';
import '../../../scripts/share/share-asset-button.css';
import '../../../scripts/toast/toast.css';
import { createShareAssetButton } from '../../../scripts/share/share-asset-button.js';

/**
 * React wrapper for the pure JS ShareAssetButton
 */
export default function ShareAssetButton({ assetId, disabled = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Create the pure JS button
    const button = createShareAssetButton({ assetId, disabled });

    // Append it to the container
    container.appendChild(button);

    // Cleanup: remove the button when component unmounts or props change
    return () => {
      if (button.parentNode === container) {
        container.removeChild(button);
      }
    };
  }, [assetId, disabled]);

  return <div ref={containerRef} style={{ display: 'contents' }} />;
}

