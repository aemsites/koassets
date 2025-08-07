import React, { useState } from 'react';
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
 * Uses implicit flow with direct redirect (no popup, no PKCE needed).
 * Props:
 *   - onAuthenticated: function(token) => void (called with Bearer token on success)
 *   - onSignOut: function() => void (called when user signs out)
 */
const AdobeSignInButton: React.FC<AdobeSignInButtonProps> = ({ onAuthenticated, onSignOut }) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    // IMS config for implicit flow
    const imsConfig: IMSConfig = {
        clientId: getAdobeClientId(),
        redirectUri: window.location.href,
        scope: 'AdobeID,openid,read_organizations,additional_info.projectedProductContext',
        responseType: 'token', // Implicit flow - returns token directly
    };

    // Handle sign in with direct redirect
    const handleSignIn = (): void => {
        console.log('🔑 Starting Adobe IMS sign in...');
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
            console.log('🔗 Redirecting to Adobe authentication:', authUrl);

            // Direct redirect to Adobe IMS
            window.location.href = authUrl;

        } catch (error) {
            console.error('❌ Sign in error:', error);
            setError(`Sign in failed: ${error instanceof Error ? error.message : String(error)}`);
            setLoading(false);
        }
    };

    // Handle sign out  
    const handleSignOut = (): void => {
        console.log('🚪 Starting sign out...');

        // Clear all tokens and state
        setIsAuthenticated(false);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('tokenExpiresAt');
        setError(null);

        if (onSignOut) {
            console.log('📢 Calling onSignOut callback');
            onSignOut();
        }

        console.log('✅ Sign out complete');
    };

    // On mount, check for token in URL hash or localStorage
    React.useEffect(() => {
        // Check for access token in URL hash (from Adobe IMS redirect)
        if (window.location.hash) {
            console.log('Hash detected, parsing...');
            try {
                const params = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = params.get('access_token');
                const expiresIn = params.get('expires_in');
                const error = params.get('error');
                const errorDescription = params.get('error_description');

                if (error) {
                    console.log('OAuth error found:', error);
                    setError(`OAuth error: ${error} - ${errorDescription || 'No description'}`);
                    setLoading(false);
                    return;
                }

                if (accessToken) {
                    console.log('✅ Access token found in hash');
                    const token = `Bearer ${accessToken}`;

                    setIsAuthenticated(true);
                    localStorage.setItem('accessToken', token);

                    // Handle token expiration
                    if (expiresIn) {
                        const expiresAt = Date.now() + (parseInt(expiresIn) * 1000);
                        localStorage.setItem('tokenExpiresAt', expiresAt.toString());
                        console.log('⏰ Token expires at:', new Date(expiresAt).toLocaleString());
                    } else {
                        // Default 1 hour expiration if not provided
                        const expiresAt = Date.now() + (60 * 60 * 1000);
                        localStorage.setItem('tokenExpiresAt', expiresAt.toString());
                        console.log('⏰ Token expires at (estimated):', new Date(expiresAt).toLocaleString());
                    }

                    if (onAuthenticated) {
                        console.log('🎯 Calling onAuthenticated with token');
                        onAuthenticated(token);
                    }

                    // Clean up URL hash
                    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                    setLoading(false);
                    return;
                }
            } catch (error) {
                console.error('Error parsing hash:', error);
                setError('Error parsing authentication response');
                setLoading(false);
            }
        }

        // Check for existing valid token in localStorage
        const storedToken = localStorage.getItem('accessToken');
        const storedExpiresAt = localStorage.getItem('tokenExpiresAt');

        if (storedToken && storedExpiresAt) {
            const expiresAt = parseInt(storedExpiresAt);
            if (Date.now() < expiresAt) {
                setIsAuthenticated(true);
                if (onAuthenticated) {
                    onAuthenticated(storedToken);
                }
            } else {
                console.log('⚠️ Stored token expired, removing');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('tokenExpiresAt');
            }
        }

        setLoading(false);
    }, [onAuthenticated]);

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