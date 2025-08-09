// Type declarations for formatters.js

export declare function markdownToHtml(markdown: string): string;
export declare function escapeHtml(text: string): string;
export declare function prettyPrintJSON(json: unknown): string;
export declare function formatFileSize(bytes?: number, decimalPoint?: number): string;
export declare function getFileExtension(filename?: string): string;
export declare function formatCategory(categories?: string | string[]): string;
export declare function formatDate(epochTime?: string | number): string;
export declare function removeHyphenTitleCase(text?: string): string; 