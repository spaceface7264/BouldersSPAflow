import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login, resetPassword } from '../api';
import { saveTokens } from '../../../shared/lib/tokens';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';

const loginSchema = z.object({
  username: z.string().min(1, 'Email or phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

type ViewState = 'login' | 'forgot-password' | 'reset-sent';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('login');
  const [apiError, setApiError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setApiError(null);
    try {
      const response = await login(data.username, data.password);

      // `expires_in` from BRP is in milliseconds
      const expiresAt = Date.now() + response.expires_in;

      saveTokens(
        response.access_token,
        response.refresh_token,
        expiresAt,
        { email: data.username },
        response.username // This is the BRP customer ID
      );

      // Dispatch event so other components (e.g. AuthIndicator) know auth changed
      window.dispatchEvent(new Event('auth-state-changed'));

      navigate('/dashboard');
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 400) {
        setApiError('Incorrect email or password. Please try again.');
      } else {
        setApiError('Something went wrong. Please try again later.');
      }
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
    } finally {
      setResetLoading(false);
      setView('reset-sent');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">

        {view === 'login' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 mt-1 text-sm">Log in to your Boulders account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <Input
                label="Email or phone number"
                type="text"
                autoComplete="username"
                isRequired
                error={errors.username?.message}
                {...register('username')}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                isRequired
                error={errors.password?.message}
                {...register('password')}
              />

              {apiError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {apiError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full"
              >
                Log in
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button
                type="button"
                onClick={() => { setView('forgot-password'); setApiError(null); }}
                className="text-sm text-purple-600 hover:text-purple-700 hover:underline"
              >
                Forgot your password?
              </button>
              <p className="text-sm text-gray-500">
                Not a member yet?{' '}
                <a href="/signup" className="text-purple-600 hover:underline font-medium">
                  Join Boulders
                </a>
              </p>
            </div>
          </div>
        )}

        {view === 'forgot-password' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
              <p className="text-gray-500 mt-1 text-sm">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            <div className="space-y-5">
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                isRequired
              />

              <Button
                type="button"
                variant="primary"
                size="lg"
                isLoading={resetLoading}
                onClick={handleResetPassword}
                className="w-full"
              >
                Send reset link
              </Button>

              <button
                type="button"
                onClick={() => setView('login')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Back to login
              </button>
            </div>
          </div>
        )}

        {view === 'reset-sent' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-gray-500 text-sm mb-6">
              If <span className="font-medium text-gray-700">{resetEmail}</span> is registered,
              you'll receive a reset link shortly.
            </p>
            <Button
              variant="outline"
              onClick={() => setView('login')}
              className="w-full"
            >
              Back to login
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};
