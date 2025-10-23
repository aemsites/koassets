export default async function decorate() {
  // Get asset ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const assetId = urlParams.get('assetid');

  if (!assetId) {
    return;
  }

  // Retry mechanism - wait up to 5 seconds (50 * 100ms) for window.openDetailsView
  const maxAttempts = 50;
  let attempts = 0;

  const tryOpenDetailsView = () => {
    if (window.openDetailsView && typeof window.openDetailsView === 'function') {
      window.openDetailsView({ assetId });
    } else {
      attempts += 1;
      if (attempts < maxAttempts) {
        setTimeout(tryOpenDetailsView, 100);
      }
    }
  };

  tryOpenDetailsView();
}
