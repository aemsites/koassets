import React, { useRef, useState } from 'react';
import './ActionButton.css';

interface ActionButtonProps {
    onClick: () => void | Promise<void>;
    name?: string;
    tooltip?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, name, tooltip = '' }) => {
    const [loading, setLoading] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLSpanElement>(null);

    // Determine the actual background URL to use
    const getClassName = (): string => {
        if (name === 'download') {
            return loading ? "downloading" : "download";
        }
        return "";
    };

    const getTooltip = (): string => {
        if (tooltip) {
            return tooltip;
        }
        if (name === 'download') {
            return 'Download original';
        }
        return "";
    };

    const handleClick = async () => {
        if (name === 'download') {
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


    return (
        <div
            className="action-button-container"
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
        >
            <button
                className={`action-button ${getClassName()}`}
                onClick={handleClick}
            >
            </button>
            {getTooltip() && (
                <span
                    className="action-button-tooltip"
                    ref={tooltipRef}
                >{getTooltip()}</span>
            )}
        </div>
    );
};

export default ActionButton;
