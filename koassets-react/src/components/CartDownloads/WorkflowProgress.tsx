import React from 'react';
import { WorkflowStep, WorkflowStepIcons, WorkflowStepStatuses } from '../../types';
import { useWorkflowProgress } from './useWorkflowProgress';

// Component for rendering workflow progress steps
export interface WorkflowProgressProps {
    activeStep: WorkflowStep;
    hasAllItemsReadyToUse?: boolean;
    stepStatus?: WorkflowStepStatuses;
    stepIcon?: WorkflowStepIcons;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
    activeStep,
    hasAllItemsReadyToUse,
    stepStatus,
    stepIcon
}) => {
    const { getStepClassName, renderStepIcon } = useWorkflowProgress(stepStatus, stepIcon);

    return (
        <div className="workflow-progress">
            <div className={getStepClassName(WorkflowStep.CART, activeStep === WorkflowStep.CART)}>
                <div className="step-icon">
                    {renderStepIcon(WorkflowStep.CART)}
                </div>
                <span className="step-label">Cart</span>
            </div>
            <div className="horizontal-line"></div>
            {!hasAllItemsReadyToUse && (
                <>
                    <div className={getStepClassName(WorkflowStep.REQUEST_DOWNLOAD, activeStep === WorkflowStep.REQUEST_DOWNLOAD)}>
                        <div className="step-icon">
                            {renderStepIcon(WorkflowStep.REQUEST_DOWNLOAD)}
                        </div>
                        <span className="step-label">Request Download</span>
                    </div>
                    <div className="horizontal-line"></div>
                    <div className={getStepClassName(WorkflowStep.RIGHTS_CHECK, activeStep === WorkflowStep.RIGHTS_CHECK)}>
                        <div className="step-icon">
                            {renderStepIcon(WorkflowStep.RIGHTS_CHECK)}
                        </div>
                        <span className="step-label">Rights Check</span>
                    </div>
                    <div className="horizontal-line"></div>
                    {activeStep === WorkflowStep.REQUEST_RIGHTS_EXTENSION && (
                        <>
                            <div className={getStepClassName(WorkflowStep.REQUEST_RIGHTS_EXTENSION, activeStep === WorkflowStep.REQUEST_RIGHTS_EXTENSION)}>
                                <div className="step-icon">
                                    {renderStepIcon(WorkflowStep.REQUEST_RIGHTS_EXTENSION)}
                                </div>
                                <span className="step-label">Request Rights Extension</span>
                            </div>
                            <div className="horizontal-line"></div>
                        </>
                    )}
                </>
            )}
            <div className={getStepClassName(WorkflowStep.DOWNLOAD, activeStep === WorkflowStep.DOWNLOAD)}>
                <div className="step-icon">
                    {renderStepIcon(WorkflowStep.DOWNLOAD)}
                </div>
                <span className="step-label">Download</span>
            </div>
        </div>
    );
};
