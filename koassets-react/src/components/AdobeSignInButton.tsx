import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdobeSignInButtonProps } from '../types';
import { getAdobeClientId } from '../utils/config';

interface IMSConfig {
    clientId: string;
    redirectUri: string;
    scope: string;
    responseType: string;
}

/**
 * AdobeSignInButton
 * Renders a "Sign in with Adobe" button and handles IMS authentication flow.
 * Uses implicit flow with silent refresh for token renewal.
 * Props:
 *   - onAuthenticated: function(token) => void (called with Bearer token on success)
 *   - onSignOut: function() => void (called when user signs out)
 */
const AdobeSignInButton: React.FC<AdobeSignInButtonProps> = ({ onAuthenticated, onSignOut }) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    // IMS config for implicit flow - memoized to prevent unnecessary re-renders
    const imsConfig: IMSConfig = useMemo(() => ({
        clientId: getAdobeClientId(),
        redirectUri: window.location.href,
        scope: 'AdobeID,openid,read_organizations,additional_info.projectedProductContext',
        responseType: 'token', // Implicit flow - returns token directly
    }), []);

    // Silent refresh using hidden iframe
    const performSilentRefresh = useCallback(async (): Promise<string | null> => {
        return new Promise((resolve) => {
            // Create hidden iframe for silent refresh
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `https://ims-na1.adobelogin.com/ims/authorize/v2?${new URLSearchParams({
                client_id: imsConfig.clientId,
                redirect_uri: imsConfig.redirectUri,
                scope: imsConfig.scope,
                response_type: imsConfig.responseType,
                prompt: 'none', // Silent refresh
            }).toString()}`;

            // Set up timeout
            const timeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 10000); // 10 second timeout

            const cleanup = () => {
                clearTimeout(timeout);
                document.body.removeChild(iframe);
                window.removeEventListener('message', handleMessage);
            };

            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== 'https://ims-na1.adobelogin.com') return;

                try {
                    const url = new URL(event.data);
                    const params = new URLSearchParams(url.hash.substring(1));
                    const accessToken = params.get('access_token');
                    const error = params.get('error');

                    cleanup();

                    if (error) {
                        resolve(null);
                        return;
                    }

                    if (accessToken) {
                        const token = `Bearer ${accessToken}`;
                        const expiresIn = params.get('expires_in');

                        // Update stored tokens
                        localStorage.setItem('accessToken', token);
                        const expiresAt = Date.now() + ((expiresIn ? parseInt(expiresIn) : 3600) * 1000);
                        localStorage.setItem('tokenExpiresAt', expiresAt.toString());

                        setIsAuthenticated(true);
                        if (onAuthenticated) {
                            onAuthenticated(token);
                        }

                        resolve(token);
                        return;
                    }
                } catch (err) {
                    console.error('Error parsing silent refresh response:', err);
                }

                resolve(null);
            };

            window.addEventListener('message', handleMessage);
            document.body.appendChild(iframe);
        });
    }, [imsConfig, onAuthenticated]);

    // Check if token is expired or about to expire (within 5 minutes)
    const isTokenExpired = useCallback((): boolean => {
        const expiresAt = localStorage.getItem('tokenExpiresAt');
        if (!expiresAt) return true;

        const expirationTime = parseInt(expiresAt);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

        return now >= (expirationTime - fiveMinutes);
    }, []);

    // Auto-refresh token when it's about to expire
    const setupTokenRefresh = useCallback(() => {
        const expiresAt = localStorage.getItem('tokenExpiresAt');
        if (!expiresAt) return;

        const expirationTime = parseInt(expiresAt);
        const now = Date.now();
        const refreshTime = expirationTime - (5 * 60 * 1000); // Refresh 5 minutes before expiry
        const timeUntilRefresh = refreshTime - now;

        if (timeUntilRefresh > 0) {
            setTimeout(async () => {
                await performSilentRefresh();
            }, timeUntilRefresh);
        }
    }, [performSilentRefresh]);

    // Handle sign in with implicit flow
    const handleSignIn = (): void => {
        setError(null);
        setLoading(true);

        try {
            if (!imsConfig.clientId) {
                throw new Error('Adobe Client ID not configured. Please set VITE_ADOBE_CLIENT_ID environment variable.');
            }

            const params = new URLSearchParams({
                client_id: imsConfig.clientId,
                redirect_uri: imsConfig.redirectUri,
                scope: imsConfig.scope,
                response_type: imsConfig.responseType,
            });

            const authUrl = `https://ims-na1.adobelogin.com/ims/authorize/v2?${params.toString()}`;



            // Direct redirect to Adobe IMS
            window.location.href = authUrl;

        } catch (error) {
            console.error('Sign in error:', error);
            setError(`Sign in failed: ${error instanceof Error ? error.message : String(error)}`);
            setLoading(false);
        }
    };

    // Handle sign out  
    const handleSignOut = (): void => {
        // Clear all tokens and state
        setIsAuthenticated(false);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('tokenExpiresAt');
        setError(null);

        if (onSignOut) {
            onSignOut();
        }
    };

    // On mount, check for token in URL hash or localStorage
    useEffect(() => {


        // Check for access token in URL hash (from Adobe IMS redirect)
        if (window.location.hash) {

            try {
                const params = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = params.get('access_token');
                const expiresIn = params.get('expires_in');
                const error = params.get('error');
                const errorDescription = params.get('error_description');



                if (error) {
                    setError(`OAuth error: ${error} - ${errorDescription || 'No description'}`);
                    setLoading(false);
                    return;
                }

                if (accessToken) {
                    const token = `Bearer ${accessToken}`;

                    setIsAuthenticated(true);
                    localStorage.setItem('accessToken', token);

                    // Handle token expiration
                    if (expiresIn) {
                        const expiresAt = Date.now() + (parseInt(expiresIn) * 1000);
                        localStorage.setItem('tokenExpiresAt', expiresAt.toString());
                    } else {
                        // Default 1 hour expiration if not provided
                        const expiresAt = Date.now() + (60 * 60 * 1000);
                        localStorage.setItem('tokenExpiresAt', expiresAt.toString());
                    }

                    if (onAuthenticated) {
                        onAuthenticated(token);
                    }

                    // Clean up URL hash
                    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

                    // Setup auto-refresh
                    setupTokenRefresh();
                    setLoading(false);
                    return;
                }
            } catch (error) {
                console.error('Error parsing hash:', error);
                setError('Error parsing authentication response');
                setLoading(false);
            }
        }

        // WORKAROUND: Check if access_token appears in pathname instead of hash
        // This handles cases where the OAuth redirect incorrectly puts tokens in the path
        if (window.location.pathname.includes('access_token')) {
            try {
                // Extract the token part from the pathname (everything after the first 'access_token=')
                const pathString = window.location.pathname;
                const tokenStartIndex = pathString.indexOf('access_token=');

                if (tokenStartIndex !== -1) {
                    // Get everything from 'access_token=' onwards
                    const tokenString = pathString.substring(tokenStartIndex);


                    const params = new URLSearchParams(tokenString);
                    const accessToken = params.get('access_token');
                    const expiresIn = params.get('expires_in');
                    const error = params.get('error');
                    const errorDescription = params.get('error_description');



                    if (error) {
                        setError(`OAuth error: ${error} - ${errorDescription || 'No description'}`);
                        setLoading(false);
                        return;
                    }

                    if (accessToken) {
                        const token = `Bearer ${accessToken}`;

                        setIsAuthenticated(true);
                        localStorage.setItem('accessToken', token);

                        // Handle token expiration
                        if (expiresIn) {
                            const expiresAt = Date.now() + (parseInt(expiresIn) * 1000);
                            localStorage.setItem('tokenExpiresAt', expiresAt.toString());
                        } else {
                            // Default 1 hour expiration if not provided
                            const expiresAt = Date.now() + (60 * 60 * 1000);
                            localStorage.setItem('tokenExpiresAt', expiresAt.toString());
                        }

                        if (onAuthenticated) {
                            onAuthenticated(token);
                        }

                        // Clean up URL by redirecting to clean path
                        // Since pathname is '/access_token=...', we want to remove everything from '/access_token' onwards
                        const cleanPath = tokenStartIndex === 1 ? '/' : window.location.pathname.substring(0, tokenStartIndex - 1);
                        const cleanUrl = `${window.location.origin}${cleanPath}${window.location.search}`;
                        window.history.replaceState({}, document.title, cleanUrl);

                        // Setup auto-refresh
                        setupTokenRefresh();
                        setLoading(false);
                        return;
                    }
                }
            } catch (error) {
                console.error('Error parsing access_token from pathname:', error);
                setError('Error parsing authentication response from URL');
                setLoading(false);
            }
        }

        // Check for existing token in localStorage
        const checkExistingToken = async () => {
            const storedToken = localStorage.getItem('accessToken');
            const storedExpiresAt = localStorage.getItem('tokenExpiresAt');

            if (storedToken && storedExpiresAt) {
                if (isTokenExpired()) {
                    const refreshedToken = await performSilentRefresh();

                    if (refreshedToken) {
                        setupTokenRefresh();
                    } else {
                        // Silent refresh failed, clear expired token
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('tokenExpiresAt');
                        setIsAuthenticated(false);
                    }
                } else {
                    // Token is not expired, use it directly
                    setIsAuthenticated(true);
                    if (onAuthenticated) {
                        onAuthenticated(storedToken);
                    }
                    setupTokenRefresh();
                }
            }

            setLoading(false);
        };

        checkExistingToken();
    }, [onAuthenticated, isTokenExpired, performSilentRefresh, setupTokenRefresh]);

    return (
        <>
            <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                style={{
                    backgroundColor: 'var(--primary-color)',
                    color: '#fff',
                    opacity: loading ? 0.7 : 1
                }}
                onClick={isAuthenticated ? handleSignOut : handleSignIn}
                disabled={loading}
            >
                {loading
                    ? (isAuthenticated ? 'Signing out...' : 'Signing in...')
                    : (isAuthenticated ? 'Sign out' : 'Sign in with Adobe')
                }
            </button>
            {error && (
                <div className="mt-2 text-sm text-red-600">{error}</div>
            )}
        </>
    );
};

export default AdobeSignInButton; 