import React, { useEffect, useState } from 'react';
import { StepStatus, WorkflowStep, WorkflowStepIcons, WorkflowStepStatuses } from '../../types';
import { useWorkflowProgress } from './useWorkflowProgress';

// Component for rendering workflow progress steps
export interface WorkflowProgressProps {
    activeStep: WorkflowStep;
    hasAllItemsReadyToUse?: boolean;
    stepStatus?: WorkflowStepStatuses;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
    activeStep,
    hasAllItemsReadyToUse,
    stepStatus
}) => {
    // Internal state for step icons
    const [stepIcon, setStepIcon] = useState<WorkflowStepIcons>({
        [WorkflowStep.CART]: '',
        [WorkflowStep.REQUEST_DOWNLOAD]: '',
        [WorkflowStep.RIGHTS_CHECK]: '',
        [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: '',
        [WorkflowStep.DOWNLOAD]: '',
        [WorkflowStep.CLOSE_DOWNLOAD]: ''
    });

    const { getStepClassName, renderStepIcon } = useWorkflowProgress(stepStatus, stepIcon);

    // Monitor stepStatus changes and handle each status for all steps
    useEffect(() => {
        if (!stepStatus) return;

        Object.entries(stepStatus).forEach(([step, status]) => {
            switch (step as WorkflowStep) {
                case WorkflowStep.CART:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-stepper-icon.svg`} alt="Cart" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-stepper-icon.svg`} alt="Cart Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-icon-success.svg`} alt="Cart Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-icon-failure.svg`} alt="Cart Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.REQUEST_DOWNLOAD:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/download-asset-grey.svg`} alt="Request Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/donwload-cart-step-red.svg`} alt="Request Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/cart-icon-success.svg`} alt="Request Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/cart-icon-failure.svg`} alt="Request Download Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.RIGHTS_CHECK:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/rights-check-grey.svg`} alt="Rights Check" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/rights-check-red.svg`} alt="Rights Check Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/cart-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/cart-icon-failure.svg`} alt="Rights Check Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.REQUEST_RIGHTS_EXTENSION:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/request-rights-red.svg`} alt="Rights Check" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/request-rights-red.svg`} alt="Rights Check Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/cart-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/cart-icon-failure.svg`} alt="Rights Check Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.DOWNLOAD:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/download-icon.svg`} alt="Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/donwload-cart-step-red.svg`} alt="Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            // Could trigger success notification or auto-close
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/cart-icon-success.svg`} alt="Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/cart-icon-failure.svg`} alt="Download Failure" />
                            }));
                            break;
                    }
                    break;
            }
        });
    }, [stepStatus]);

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
