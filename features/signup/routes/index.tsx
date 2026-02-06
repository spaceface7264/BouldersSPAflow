import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSignupStore } from '../state';
import { PersonalInfoStep } from '../components/PersonalInfoStep';
import { MembershipStep } from '../components/MembershipStep';
import { AddonsStep } from '../components/AddonsStep';
import { ReviewStep } from '../components/ReviewStep';
import { PaymentStep } from '../components/PaymentStep';
import { SuccessStep } from '../components/SuccessStep';

export const SignupRoutes: React.FC = () => {
  const { currentStep, draft } = useSignupStore();

  // If the user already pre-selected a plan on the hero page, the default
  // entry step is "personal". Otherwise it's "membership".
  const entryStep = draft.membership ? 'personal' : 'membership';
  const resolvedStep = currentStep || entryStep;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/signup/${resolvedStep}`} replace />} />
      <Route path="/membership" element={<MembershipStep />} />
      <Route path="/personal" element={<PersonalInfoStep />} />
      <Route path="/addons" element={<AddonsStep />} />
      <Route path="/review" element={<ReviewStep />} />
      <Route path="/payment" element={<PaymentStep />} />
      <Route path="/success" element={<SuccessStep />} />
      <Route path="*" element={<Navigate to={`/signup/${resolvedStep}`} replace />} />
    </Routes>
  );
};
