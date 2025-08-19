import React, { useState } from 'react';
import './ActionButton.css';

interface ActionButtonProps {
    onClick: () => void | Promise<void>;
    name?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, name }) => {
    const [loading, setLoading] = useState<boolean>(false);

    // Determine the actual background URL to use
    const getClassName = (): string => {
        if (name === 'download') {
            return loading ? "downloading" : "download";
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


    return (
        <button
            className={`action-button ${getClassName()}`}
            onClick={handleClick}
        >
        </button>
    );
};

export default ActionButton;
