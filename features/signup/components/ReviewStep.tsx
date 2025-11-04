import React from 'react';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Card, CardContent, CardHeader } from '../../../shared/ui';
import { MEMBERSHIP_PLANS, ADDON_PRODUCTS } from '../../../shared/constants';

export const ReviewStep: React.FC = () => {
  const { draft, nextStep } = useSignupStore();

  const selectedPlan = draft.membership ? 
    MEMBERSHIP_PLANS.find(plan => plan.id === draft.membership!.planId) : null;
  
  const selectedAddons = draft.addons?.map(addon => ({
    ...addon,
    product: ADDON_PRODUCTS.find(p => p.id === addon.id)!
  })) || [];

  const membershipTotal = draft.membership?.totalPrice || 0;
  const addonsTotal = selectedAddons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
  const grandTotal = membershipTotal + addonsTotal;

  const handleNext = () => {
    nextStep();
  };

  return (
    <BaseStep
      stepId="review"
      title="Review Your Order"
      description="Please review your selections before proceeding to payment"
      canProceed={true}
      onNext={handleNext}
      nextButtonText="Proceed to Payment"
    >
      <div className="space-y-6">
        {/* Personal Information */}
        {draft.personalInfo && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Name</span>
                  <p className="font-medium">
                    {draft.personalInfo.firstName} {draft.personalInfo.lastName}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Email</span>
                  <p className="font-medium">{draft.personalInfo.email}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Phone</span>
                  <p className="font-medium">{draft.personalInfo.phone || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Location</span>
                  <p className="font-medium">
                    {draft.personalInfo.city}, {draft.personalInfo.zipCode}, {draft.personalInfo.country}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Membership Selection */}
        {selectedPlan && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Membership</h3>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedPlan.name}</h4>
                  <p className="text-sm text-gray-600">{selectedPlan.description}</p>
                  {draft.membership?.quantity && draft.membership.quantity > 1 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Quantity: {draft.membership.quantity}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {membershipTotal}kr
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add-ons */}
        {selectedAddons.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Add-ons</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedAddons.map((addon) => (
                  <div key={addon.id} className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-gray-900">{addon.name}</h4>
                      <p className="text-sm text-gray-600">
                        {addon.product.description}
                      </p>
                      <p className="text-sm text-gray-500">
                        Quantity: {addon.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {addon.price * addon.quantity}kr
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Membership</span>
                <span className="font-medium">{membershipTotal}kr</span>
              </div>
              {addonsTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Add-ons</span>
                  <span className="font-medium">{addonsTotal}kr</span>
                </div>
              )}
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{grandTotal}kr</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms and Conditions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Terms and Conditions</p>
              <p>
                By proceeding to payment, you agree to our{' '}
                <a
                  href="https://boulders.dk/en/regelst-for-medlemmer-af-boulders"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-900"
                >
                  Terms and Conditions
                </a>
                . Your membership will be activated upon successful payment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </BaseStep>
  );
};
