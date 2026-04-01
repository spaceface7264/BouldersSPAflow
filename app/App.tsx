import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignupRoutes } from '../features/signup/routes';
import { DashboardRoutes } from '../features/dashboard/routes';
import { LoginPage } from '../features/auth/components/LoginPage';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { Stepper } from '../shared/ui';
import { useSignupStore } from '../features/signup/state';
import { AuthIndicator } from '../features/signup/components/AuthIndicator';
import '../shared/styles/tokens.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Login layout ──────────────────────────────────────────────────────────────
// Minimal branded header — no signup steps

const LoginLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <header className="bg-gray-900 text-white py-5">
      <div className="container mx-auto px-4 flex items-center space-x-3">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
          <span className="text-gray-900 font-bold">B</span>
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">BOULDERS</h1>
          <p className="text-gray-400 text-xs">Your Bouldering Network</p>
        </div>
      </div>
    </header>
    {children}
  </div>
);

// ── Signup layout ─────────────────────────────────────────────────────────────
// Full multi-step header with stepper + dynamic subtitle

const DynamicSubtitle: React.FC = () => {
  const { currentStep } = useSignupStore();

  const subtitleMap: Record<string, string> = {
    personal: 'Tell us about yourself to personalize your experience',
    membership: 'Choose your access type',
    addons: 'Need an add-on?',
    review: 'Your information',
    payment: 'Complete your purchase',
    success: 'Welcome to Boulders!',
  };

  return (
    <p className="text-center text-lg text-gray-600 mb-8">
      {subtitleMap[currentStep] ?? 'Join Your Bouldering Network'}
    </p>
  );
};

const SignupLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { steps, currentStep } = useSignupStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-lg">B</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">BOULDERS</h1>
                <p className="text-gray-300 text-sm">Join Your Bouldering Network</p>
              </div>
            </div>
            <AuthIndicator />
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 py-6">
        <div className="container mx-auto px-4">
          <Stepper steps={steps} currentStep={currentStep} />
        </div>
      </div>

      <div className="bg-white py-4">
        <div className="container mx-auto px-4">
          <DynamicSubtitle />
        </div>
      </div>

      <main className="py-8">
        <div className="container mx-auto px-4">
          {children}
        </div>
      </main>
    </div>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────────

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <Router>
      <Routes>
        {/* Auth */}
        <Route
          path="/login"
          element={
            <LoginLayout>
              <LoginPage />
            </LoginLayout>
          }
        />

        {/* Dashboard — protected */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardRoutes />
            </ProtectedRoute>
          }
        />

        {/* Signup flow */}
        <Route
          path="/signup/*"
          element={
            <SignupLayout>
              <SignupRoutes />
            </SignupLayout>
          }
        />

        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  </QueryClientProvider>
);
