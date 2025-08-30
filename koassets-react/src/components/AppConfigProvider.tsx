import React from 'react';
import { AppConfigContext } from '../contexts/AppConfigContext';
import type { ExternalParams } from '../types';

interface AppConfigProviderProps {
    children: React.ReactNode;
    externalParams: ExternalParams;
    // Add more config parameters here as needed
}

export const AppConfigProvider: React.FC<AppConfigProviderProps> = ({
    children,
    externalParams
}) => {
    return (
        <AppConfigContext.Provider value={{
            externalParams
            // Add more config values here as needed
        }}>
            {children}
        </AppConfigContext.Provider>
    );
};
