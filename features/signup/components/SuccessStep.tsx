import React from 'react';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Card, CardContent, Button } from '../../../shared/ui';

export const SuccessStep: React.FC = () => {
  const { draft, resetDraft } = useSignupStore();

  const handleStartNew = () => {
    resetDraft();
  };

  const handleGoToGym = () => {
    // Redirect to gym website or app
    window.open('https://boulders.dk', '_blank');
  };

  return (
    <BaseStep
      stepId="success"
      title="Welcome to Boulders!"
      description="Your membership has been successfully activated"
      canProceed={false}
      showNavigation={false}
    >
      <div className="text-center space-y-6">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Congratulations!
          </h2>
          <p className="text-lg text-gray-600">
            Your membership has been successfully activated and you're now part of the Boulders community.
          </p>
        </div>

        {/* Membership Details */}
        {draft.membership && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Membership</h3>
              <div className="text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium">
                    {draft.membership.type === 'membership' ? 'Membership' : 'Punch Card'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid</span>
                  <span className="font-medium">{draft.membership.totalPrice}kr</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-xs font-medium text-purple-600">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Check your email</p>
                  <p className="text-sm text-gray-600">
                    We've sent you a confirmation email with your membership details and next steps.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-xs font-medium text-purple-600">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Download the app</p>
                  <p className="text-sm text-gray-600">
                    Get the Boulders app to manage your membership, book sessions, and track your progress.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-xs font-medium text-purple-600">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Visit your first gym</p>
                  <p className="text-sm text-gray-600">
                    Head to any Boulders location and start your climbing journey!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={handleGoToGym}
            className="px-8 py-3"
          >
            Visit Boulders Website
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={handleStartNew}
            className="px-8 py-3"
          >
            Start New Registration
          </Button>
        </div>

        {/* Contact Information */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Need help? Contact us at{' '}
            <a
              href="mailto:support@boulders.dk"
              className="text-purple-600 hover:text-purple-500 underline"
            >
              support@boulders.dk
            </a>
          </p>
        </div>
      </div>
    </BaseStep>
  );
};
