/**
 * Utility function to retry async operations with configurable delay and attempts
 */

export interface RetryOptions {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number, maxRetries: number, error: Error) => void;
    onSuccess?: () => void;
    onFailure?: (finalError: Error) => void;
}

/**
 * Retries an async function with exponential backoff or fixed delay
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects with the final error
 */
export async function retryWithDelay<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        delayMs = 1000,
        onRetry,
        onSuccess,
        onFailure
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            onSuccess?.();
            return result;
        } catch (error) {
            lastError = error as Error;

            if (onRetry) {
                onRetry(attempt, maxRetries, lastError);
            } else {
                console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError);
            }

            if (attempt < maxRetries) {
                console.log(`Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    // All retries exhausted
    const finalError = lastError || new Error('Unknown error during retry attempts');
    onFailure?.(finalError);
    throw finalError;
}

/**
 * Retries an async function with exponential backoff (delay doubles each time)
 * @param fn - The async function to retry
 * @param options - Retry configuration options (delayMs will be used as initial delay)
 * @returns Promise that resolves with the function result or rejects with the final error
 */
export async function retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        delayMs = 1000,
        onRetry,
        onSuccess,
        onFailure
    } = options;

    let lastError: Error | null = null;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            onSuccess?.();
            return result;
        } catch (error) {
            lastError = error as Error;

            if (onRetry) {
                onRetry(attempt, maxRetries, lastError);
            } else {
                console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError);
            }

            if (attempt < maxRetries) {
                console.log(`Retrying in ${currentDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                currentDelay *= 2; // Exponential backoff
            }
        }
    }

    // All retries exhausted
    const finalError = lastError || new Error('Unknown error during retry attempts');
    onFailure?.(finalError);
    throw finalError;
}
