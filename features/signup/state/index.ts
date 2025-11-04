import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StepId, SignupDraft, Step } from '../../../shared/types';
import { STEPS } from '../../../shared/constants';

interface SignupState {
  // Current step
  currentStep: StepId;
  
  // Draft data
  draft: SignupDraft;
  
  // Step management
  steps: Step[];
  
  // Actions
  setCurrentStep: (step: StepId) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateDraft: (updates: Partial<SignupDraft>) => void;
  resetDraft: () => void;
  markStepCompleted: (step: StepId) => void;
  isStepAccessible: (step: StepId) => boolean;
  canProceedToNext: () => boolean;
}

const initialSteps: Step[] = STEPS.map((step, index) => ({
  id: step.id as StepId,
  title: step.title,
  description: step.description,
  isActive: index === 0,
  isCompleted: false,
  isAccessible: index === 0,
}));

export const useSignupStore = create<SignupState>()(
  devtools(
    (set, get) => ({
      currentStep: 'personal',
      draft: {},
      steps: initialSteps,

      setCurrentStep: (step: StepId) => {
        const state = get();
        const stepIndex = STEPS.findIndex(s => s.id === step);
        
        if (stepIndex === -1 || !state.isStepAccessible(step)) {
          return;
        }

        set((state) => ({
          currentStep: step,
          steps: state.steps.map((s, index) => ({
            ...s,
            isActive: s.id === step,
            isCompleted: index < stepIndex ? true : s.isCompleted,
          })),
        }));
      },

      nextStep: () => {
        const state = get();
        const currentIndex = STEPS.findIndex(s => s.id === state.currentStep);
        
        if (currentIndex < STEPS.length - 1) {
          const nextStep = STEPS[currentIndex + 1].id as StepId;
          state.setCurrentStep(nextStep);
        }
      },

      prevStep: () => {
        const state = get();
        const currentIndex = STEPS.findIndex(s => s.id === state.currentStep);
        
        if (currentIndex > 0) {
          const prevStep = STEPS[currentIndex - 1].id as StepId;
          state.setCurrentStep(prevStep);
        }
      },

      updateDraft: (updates: Partial<SignupDraft>) => {
        set((state) => ({
          draft: { ...state.draft, ...updates },
        }));
      },

      resetDraft: () => {
        set({
          draft: {},
          currentStep: 'personal',
          steps: initialSteps,
        });
      },

      markStepCompleted: (step: StepId) => {
        set((state) => ({
          steps: state.steps.map((s) =>
            s.id === step ? { ...s, isCompleted: true } : s
          ),
        }));
      },

      isStepAccessible: (step: StepId) => {
        const state = get();
        const stepIndex = STEPS.findIndex(s => s.id === step);
        const currentIndex = STEPS.findIndex(s => s.id === state.currentStep);
        
        // Can access current step or any previous step
        return stepIndex <= currentIndex;
      },

      canProceedToNext: () => {
        const state = get();
        const currentIndex = STEPS.findIndex(s => s.id === state.currentStep);
        
        if (currentIndex >= STEPS.length - 1) {
          return false; // Already at last step
        }

        // Basic validation based on current step
        switch (state.currentStep) {
          case 'personal':
            return !!state.draft.personalInfo;
          case 'membership':
            return !!state.draft.membership;
          case 'addons':
            return true; // Addons are optional
          case 'review':
            return true; // Can always proceed from review
          case 'payment':
            return !!state.draft.payment;
          default:
            return false;
        }
      },
    }),
    {
      name: 'signup-store',
    }
  )
);
