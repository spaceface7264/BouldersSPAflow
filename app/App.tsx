import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignupRoutes } from '../features/signup/routes';
import { Stepper } from '../shared/ui';
import { useSignupStore } from '../features/signup/state';
import { AuthIndicator } from '../features/signup/components/AuthIndicator';
import { Hero } from '../src/components/Hero';
import '../shared/styles/tokens.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Dynamic subtitle component
const DynamicSubtitle: React.FC = () => {
  const { currentStep } = useSignupStore();

  const getSubtitle = (step: string) => {
    switch (step) {
      case 'personal':
        return 'Tell us about yourself to get started';
      case 'membership':
        return 'Choose your access type';
      case 'addons':
        return 'Need an add-on?';
      case 'review':
        return 'Your information';
      case 'payment':
        return 'Complete your purchase';
      case 'success':
        return 'Welcome to Boulders!';
      default:
        return 'Join Your Bouldering Network';
    }
  };

  return (
    <p className="text-center text-lg text-gray-600 mb-8">
      {getSubtitle(currentStep)}
    </p>
  );
};

// Signup flow layout with header, stepper, and step content
const SignupLayout: React.FC = () => {
  const { steps, currentStep } = useSignupStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center space-x-4 no-underline">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-lg">B</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">BOULDERS</h1>
                <p className="text-gray-300 text-sm">Join Your Bouldering Network</p>
              </div>
            </a>
            <div className="flex items-center">
              <AuthIndicator />
            </div>
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="container mx-auto px-4">
          <Stepper
            steps={steps}
            currentStep={currentStep}
          />
        </div>
      </div>

      {/* Dynamic Subtitle */}
      <div className="bg-white py-4">
        <div className="container mx-auto px-4">
          <DynamicSubtitle />
        </div>
      </div>

      {/* Main Content */}
      <main className="py-8">
        <div className="container mx-auto px-4">
          <SignupRoutes />
        </div>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route path="/signup/*" element={<SignupLayout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
      </Router>
    </QueryClientProvider>
  );
};
