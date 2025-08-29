import React, { createContext, useContext } from 'react';
import type { ExternalParams } from '../types';

interface AppConfigContextType {
    externalParams: ExternalParams;
    // Add more config parameters here as needed
    // otherConfig?: SomeType[];
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

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

export const useAppConfig = (): AppConfigContextType => {
    const context = useContext(AppConfigContext);
    if (context === undefined) {
        throw new Error('useAppConfig must be used within an AppConfigProvider');
    }
    return context;
};
