import { useContext } from 'react';
import { AppConfigContext, type AppConfigContextType } from '../contexts/AppConfigContext';

export const useAppConfig = (): AppConfigContextType => {
    const context = useContext(AppConfigContext);
    if (context === undefined) {
        throw new Error('useAppConfig must be used within an AppConfigProvider');
    }
    return context;
};
