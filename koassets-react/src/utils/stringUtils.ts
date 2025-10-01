/**
 * Split a string by separator into a specified number of chunks
 * @param string - The string to split
 * @param separator - The separator to split by
 * @param num - The number of chunks to return
 * @returns Array of string chunks
 * @example split('a:b:c', ':', 2) returns ['a', 'b:c']
 */
export function split(string: string, separator: string, num: number): string[] {
    if (num <= 0) return [];
    if (num === 1) return [string];

    const parts = string.split(separator);
    if (parts.length <= num) return parts;

    // Take the first (num-1) parts and join the rest
    const result = parts.slice(0, num - 1);
    const remaining = parts.slice(num - 1).join(separator);
    result.push(remaining);

    return result;
}
