// Button configuration types and predefined configurations
export interface ButtonState {
    className: string;
    backgroundImage?: string;
    tooltip: string;
}

export interface ButtonConfig {
    idle: ButtonState;
    downloading?: ButtonState;
    disabled?: ButtonState;
}

// Predefined button configurations
export const BUTTON_CONFIGS = {
    download: {
        idle: {
            className: 'download',
            backgroundImage: '/icons/download-asset.svg',
            tooltip: 'Download preview'
        },
        downloading: {
            className: 'downloading',
            backgroundImage: '/icons/downloading-asset.svg',
            tooltip: 'Downloading...'
        },
        disabled: {
            className: 'download',
            backgroundImage: '/icons/download-asset.svg',
            tooltip: 'Preview not available'
        }
    } as ButtonConfig
};
