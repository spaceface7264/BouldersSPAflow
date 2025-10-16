import React from 'react';
import { clsx } from 'clsx';
import type { Step } from '../types';

export interface StepperProps {
  steps: Step[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className,
}) => {
  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.isCompleted;
          const isAccessible = step.isAccessible;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div
                className={clsx(
                  'flex flex-col items-center cursor-pointer',
                  !isAccessible && 'cursor-not-allowed opacity-50'
                )}
                onClick={() => isAccessible && onStepClick?.(step.id)}
              >
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    {
                      'bg-purple-600 text-white': isActive,
                      'bg-green-600 text-white': isCompleted,
                      'bg-gray-200 text-gray-600': !isActive && !isCompleted,
                    }
                  )}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={clsx(
                      'text-sm font-medium',
                      {
                        'text-purple-600': isActive,
                        'text-green-600': isCompleted,
                        'text-gray-500': !isActive && !isCompleted,
                      }
                    )}
                  >
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-xs text-gray-400 mt-1">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
              
              {!isLast && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-4 transition-colors',
                    {
                      'bg-purple-600': isCompleted,
                      'bg-gray-200': !isCompleted,
                    }
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
