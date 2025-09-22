import React, { useEffect, useState } from 'react';
import { WorkflowStep } from '../../types';
import './BasePanel.css';

export interface BasePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    tabs?: Array<{
        id: string;
        label: string;
        count?: number;
    }>;
    children: React.ReactNode;
    panelClassName?: string;
}

const BasePanel: React.FC<BasePanelProps> = ({
    isOpen,
    onClose,
    title,
    tabs = [],
    children,
    panelClassName = 'cart-panel'
}) => {
    const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || '');
    const [activeStep, setActiveStep] = useState<WorkflowStep>(WorkflowStep.CART);

    // Update activeTab when tabs change
    useEffect(() => {
        if (tabs.length > 0 && !activeTab) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('base-panel-open');
            document.documentElement.classList.add('base-panel-open');
        } else {
            document.body.classList.remove('base-panel-open');
            document.documentElement.classList.remove('base-panel-open');
        }

        return () => {
            document.body.classList.remove('base-panel-open');
            document.documentElement.classList.remove('base-panel-open');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="base-panel-overlay portal-modal">
            <div className={`base-panel ${panelClassName || ''}`}>
                {/* Header with close button */}
                <div className="base-panel-header">
                    <h2>{title}</h2>
                    <button className="close-button" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                {/* Tabs - conditionally shown */}
                {tabs.length > 0 && activeStep === WorkflowStep.CART && (
                    <div className="base-panel-tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`base-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label} {tab.count !== undefined && `(${tab.count})`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content area */}
                <div className="base-panel-content">
                    {React.Children.map(children, (child) => {
                        if (React.isValidElement(child)) {
                            return React.cloneElement(child, {
                                activeTab,
                                setActiveTab,
                                activeStep,
                                setActiveStep
                            } as Record<string, unknown>);
                        }
                        return child;
                    })}
                </div>
            </div>
        </div>
    );
};

export default BasePanel;
