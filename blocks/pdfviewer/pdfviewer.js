export default async function decorate(block) {
  const pdfLinks = [];
  [...block.children].forEach((row) => {
    const divs = row.children;
    if (divs.length >= 2) {
      pdfLinks.push({
        title: divs[0].textContent.trim(),
        pdfLink: divs[1].textContent.trim(),
      });
    }
  });

  block.textContent = '';

  await pdfLinks.reduce(async (promise, { title, pdfLink }) => {
    await promise;

    const pdfViewer = document.createElement('div');
    pdfViewer.className = 'pdf-viewer';

    // Create h3 title
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    pdfViewer.appendChild(titleElement);

    try {
      // Check if server forces download with Content-Disposition header
      const headResponse = await fetch(pdfLink, { method: 'HEAD' });
      const contentDisposition = headResponse.headers.get('Content-Disposition');
      const forceDownload = contentDisposition && contentDisposition.includes('attachment');

      let iframeUrl = pdfLink;

      // If server forces download, fetch as blob and create blob URL
      if (forceDownload) {
        const response = await fetch(pdfLink);
        const blob = await response.blob();
        iframeUrl = URL.createObjectURL(blob);
      }

      // Create iframe with appropriate URL
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.setAttribute('aria-label', pdfLink);
      iframe.style.border = 'none';
      pdfViewer.appendChild(iframe);
    } catch (error) {
      // Fallback: show error message
      const errorMsg = document.createElement('p');
      errorMsg.textContent = `Failed to load PDF: ${error.message}`;
      errorMsg.style.color = 'red';
      pdfViewer.appendChild(errorMsg);
    }

    block.appendChild(pdfViewer);
  }, Promise.resolve());
}
