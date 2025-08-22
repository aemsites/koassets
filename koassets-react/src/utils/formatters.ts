// Helper to convert markdown to HTML
export const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    // Replace code blocks
    let html = markdown.replace(/```(\w*)\n([\s\S]*?)```/g, (_, language: string, code: string) => {
        return `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Replace inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Replace headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Replace bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Replace links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Replace line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
};

// Helper to escape HTML
export const escapeHtml = (text: string): string => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Helper to pretty print JSON
export const prettyPrintJSON = (json: unknown): string => {
    try {
        const jsonString = JSON.stringify(json, null, 2);
        return jsonString.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match: string) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return '<span class="' + cls + '">' + match + '</span>';
            });
    } catch (e) {
        return String(json);
    }
};

// Helper function to format file size
export const formatFileSize = (bytes: number | string | undefined, decimalPoint: number = 2): string => {
    if (bytes === undefined || bytes === null) return 'N/A';

    let numericBytes: number;
    if (typeof bytes === 'string') {
        const cleaned = bytes.trim();
        if (cleaned === '') return 'N/A';
        const parsed = Number(cleaned);
        if (Number.isNaN(parsed)) return 'N/A';
        numericBytes = parsed;
    } else {
        numericBytes = bytes;
    }

    if (!Number.isFinite(numericBytes) || numericBytes < 0) return 'N/A';
    if (numericBytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimalPoint < 0 ? 0 : decimalPoint;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(numericBytes) / Math.log(k));
    return parseFloat((numericBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper function to get file extension
export const getFileExtension = (filename: string | undefined): string => {
    if (!filename) return '';
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
};

// Helper function to format category array
export const formatCategory = (categories: string | string[] | undefined): string => {
    if (!categories) return 'Asset';

    // If it's a string, convert to array (split by comma)
    if (typeof categories === 'string') {
        const categoryArray = categories.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
        return categoryArray.slice(0, 3).join(', ');
    }

    // If it's an array
    if (Array.isArray(categories)) {
        // Check if it's an array with a single comma-separated string
        if (categories.length === 1 && typeof categories[0] === 'string' && categories[0].includes(',')) {
            const categoryArray = categories[0].split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
            return categoryArray.slice(0, 3).join(', ');
        }
        // Otherwise treat as array of individual categories
        return categories.slice(0, 3).join(', ');
    }

    // Fallback
    return 'Asset';
};

// Helper function to format date from epoch time
export const formatDate = (epochTime: string | number | undefined): string => {
    if (!epochTime) return '';
    
    // Convert epoch time to milliseconds if it's in seconds
    const timestamp = typeof epochTime === 'string' ? parseInt(epochTime) : epochTime;
    const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    const months = [
        'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
        'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
    ];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
};

// Helper function to remove hyphens and convert to title case
export const removeHyphenTitleCase = (text: string | undefined): string => {
    if (!text || typeof text !== 'string') return '';
    
    return text
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

// Helper function to format dimensions
export const formatDimensions = (dimensions?: { width: number; height: number }): string => {
    if (!dimensions || dimensions.width === 0 || dimensions.height === 0) return '';
    return `W: ${dimensions.width}  H: ${dimensions.height}`;
};

// Helper function to format format name
export const formatFormatName = (format: string): string => {
    return format.toUpperCase().replace('IMAGE/', '').replace('VND.ADOBE.', '');
}; 