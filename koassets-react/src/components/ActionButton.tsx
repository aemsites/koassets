import React, { useRef, useState } from 'react';
import './ActionButton.css';
import type { ButtonConfig, ButtonState } from './ActionButtonConfigs';

interface ActionButtonProps {
    disabled?: boolean;
    onClick: () => void | Promise<void>;
    config: ButtonConfig;
    hasLoadingState?: boolean;
    style?: React.CSSProperties;
}

const ActionButton: React.FC<ActionButtonProps> = ({ disabled, onClick, config, hasLoadingState = false, style }) => {
    const [loading, setLoading] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLSpanElement>(null);

    // Get current button state based on disabled, loading, or idle status
    const getCurrentState = (): ButtonState => {
        if (disabled && config.disabled) {
            return config.disabled;
        }
        if (loading && config.downloading) {
            return config.downloading;
        }
        return config.idle;
    };

    // Dynamically resolve image path based on current URL context
    const resolveImagePath = (imagePath: string): string => {
        const currentUrl = window.location.href;
        const lastSlashIndex = currentUrl.lastIndexOf('/');

        // If we're in a subdirectory (not at domain root)
        if (lastSlashIndex > currentUrl.indexOf('://') + 2) {
            const basePath = currentUrl.substring(0, lastSlashIndex + 1);
            const cleanImagePath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            return `${basePath}${cleanImagePath}`;
        }

        return imagePath;
    };

    const handleClick = async () => {
        if (hasLoadingState) {
            setLoading(true);
            try {
                await onClick();
            } finally {
                setLoading(false);
            }
        } else {
            onClick();
        }
    };

    const positionTooltip = () => {
        if (containerRef.current && tooltipRef.current) {
            const buttonRect = containerRef.current.getBoundingClientRect();
            const tooltipElement = tooltipRef.current;

            // Position tooltip above button, aligned to right edge
            tooltipElement.style.top = `${buttonRect.top - 35}px`; // 40px gap above button
            tooltipElement.style.right = `${window.innerWidth - buttonRect.right}px`;
        }
    };

    const handleMouseEnter = () => {
        positionTooltip();
    };

    const currentState = getCurrentState();

    return (
        <div
            className="action-button-container"
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            style={style}
        >
            <button
                disabled={disabled}
                className={`action-button ${currentState.className}`}
                onClick={handleClick}
                style={currentState.backgroundImage ? {
                    backgroundImage: `url(${resolveImagePath(currentState.backgroundImage)})`
                } : undefined}
            >
            </button>
            {currentState.tooltip && (
                <span
                    className="action-button-tooltip"
                    ref={tooltipRef}
                >{currentState.tooltip}</span>
            )}
        </div>
    );
};

export type { ActionButtonProps };
export default ActionButton;
