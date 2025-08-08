// Helper to convert markdown to HTML
export const markdownToHtml = (markdown) => {
    if (!markdown) return '';

    // Replace code blocks
    let html = markdown.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
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
export const escapeHtml = (text) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Helper to pretty print JSON
export const prettyPrintJSON = (json) => {
    try {
        const jsonString = JSON.stringify(json, null, 2);
        return jsonString.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
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
        return json;
    }
};

// Helper function to format file size
export const formatFileSize = (bytes, decimalPoint = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimalPoint < 0 ? 0 : decimalPoint;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper function to get file extension
export const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
};

// Helper function to format category array
export const formatCategory = (categories) => {
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