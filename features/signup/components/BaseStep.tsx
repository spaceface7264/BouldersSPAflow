import React from 'react';
import { useSignupStore } from '../state';
import { Button } from '../../../shared/ui';
import type { StepId } from '../../../shared/types';

export interface BaseStepProps {
  children: React.ReactNode;
  stepId: StepId;
  title: string;
  description?: string;
  canProceed?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  showNavigation?: boolean;
  nextButtonText?: string;
  prevButtonText?: string;
}

export const BaseStep: React.FC<BaseStepProps> = ({
  children,
  stepId,
  title,
  description,
  canProceed = true,
  onNext,
  onPrev,
  showNavigation = true,
  nextButtonText = 'Continue',
  prevButtonText = 'Back',
}) => {
  const { nextStep, prevStep, canProceedToNext } = useSignupStore();

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      nextStep();
    }
  };

  const handlePrev = () => {
    if (onPrev) {
      onPrev();
    } else {
      prevStep();
    }
  };

  const isFirstStep = stepId === 'personal';
  const isLastStep = stepId === 'success';
  const canGoNext = canProceed && (canProceedToNext() || onNext);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        {children}
      </div>

      {showNavigation && !isLastStep && (
        <div className="flex justify-between items-center">
          <div>
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={handlePrev}
              >
                {prevButtonText}
              </Button>
            )}
          </div>
          
          <div>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canGoNext}
            >
              {nextButtonText}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
