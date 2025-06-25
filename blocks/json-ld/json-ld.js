export default async function decorate(block) {
    const rows = block.querySelectorAll(':scope > div');

    const jsonLds = [];
    rows.forEach((row, idx) => {
        row.querySelectorAll(':scope > div').forEach((column, colIdx) => {
            try {
                // Get text content to automatically decode HTML entities
                const textContent = column.textContent || column.innerText || '';
                const cleanedContent = textContent.trim();
                
                if (cleanedContent) {
                    const parsedJson = JSON.parse(cleanedContent);
                    jsonLds.push(parsedJson);
                }
            } catch (error) {
                console.error('Failed to parse JSON-LD content in row', idx, 'column', colIdx, ':', error);
                console.error('Content was:', column.innerHTML);
                // Fallback to innerHTML cleaning if textContent fails
                try {
                    const fallbackContent = column.innerHTML
                        .replaceAll('<pre>', '')
                        .replaceAll('</pre>', '')
                        .replaceAll('<code>', '')
                        .replaceAll('</code>', '')
                        .trim();
                    
                    if (fallbackContent) {
                        const parsedJson = JSON.parse(fallbackContent);
                        jsonLds.push(parsedJson);
                        console.log('Fallback parsing succeeded for row', idx, 'column', colIdx);
                    }
                } catch (fallbackError) {
                    console.error('Fallback parsing also failed:', fallbackError);
                }
            }
        });
    });

    if (jsonLds.length === 0) {
        console.warn('No valid JSON-LD content found');
        return;
    }

    try {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.innerHTML = JSON.stringify(jsonLds);
        
        if (!document.head) {
            console.error('document.head not available');
            return;
        }
        
        document.head.append(script);
        console.log('Successfully appended JSON-LD script with', jsonLds.length, 'items');
    } catch (error) {
        console.error('Failed to append JSON-LD script:', error);
    }

    // Remove the json-ld-wrapper element from the document
    const wrapper = document.querySelector('.json-ld-wrapper');
    if (wrapper) {
        wrapper.remove();
        console.log('Removed json-ld-wrapper element from document');
    }
}