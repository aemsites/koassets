import { useCallback } from 'react';
import { StepStatus, WorkflowStep, WorkflowStepIcons, WorkflowStepStatuses } from '../../types';

// Custom hook for workflow progress helper functions
export const useWorkflowProgress = (stepStatus?: WorkflowStepStatuses, stepIcon?: WorkflowStepIcons) => {
    // Helper function to render step icon
    const renderStepIcon = useCallback((step: WorkflowStep, defaultIcon?: string) => {
        return stepIcon?.[step] || defaultIcon || '';
    }, [stepIcon]);

    // Helper function to get step class names
    const getStepClassName = useCallback((step: WorkflowStep, isCurrentStep: boolean): string => {
        const status = stepStatus?.[step];
        const baseClass = 'workflow-step';

        if (isCurrentStep) {
            return `${baseClass} active`;
        } else if (status === StepStatus.SUCCESS) {
            return `${baseClass} completed success`;
        } else if (status === StepStatus.FAILURE) {
            return `${baseClass} completed failure`;
        } else {
            return baseClass;
        }
    }, [stepStatus]);

    return {
        renderStepIcon,
        getStepClassName
    };
};
