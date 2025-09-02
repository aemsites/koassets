import { createContext } from 'react';
import type { ExternalParams } from '../types';

export interface AppConfigContextType {
    externalParams: ExternalParams;
    // Add more config parameters here as needed
    // otherConfig?: SomeType[];
}

export const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);
