import React, { useState } from 'react';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Card, CardContent, Button } from '../../../shared/ui';
import { finalizePayment } from '../api';

export const PaymentStep: React.FC = () => {
  const { draft, updateDraft, nextStep } = useSignupStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleHostedCheckout = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await finalizePayment(draft);
      
      if (result.success && result.redirectUrl) {
        updateDraft({ 
          payment: { 
            method: 'hosted-checkout', 
            redirectUrl: result.redirectUrl 
          } 
        });
        
        // Redirect to hosted checkout
        window.location.href = result.redirectUrl;
      } else {
        setError(result.message || 'Payment initialization failed');
      }
    } catch (err) {
      setError('An error occurred while processing your payment. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    nextStep();
  };

  const membershipTotal = draft.membership?.totalPrice || 0;
  const addonsTotal = draft.addons?.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0) || 0;
  const grandTotal = membershipTotal + addonsTotal;

  return (
    <BaseStep
      stepId="payment"
      title="Payment"
      description="Complete your purchase by selecting a payment method"
      canProceed={false}
      onNext={handleNext}
      showNavigation={false}
    >
      <div className="space-y-6">
        {/* Order Summary */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
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

        {/* Payment Methods */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Payment Method</h3>
          
          <Card isClickable>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center mr-4">
                    <span className="text-xs font-medium text-gray-600">CARD</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Credit/Debit Card</h4>
                    <p className="text-sm text-gray-600">Secure payment via Stripe</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Recommended</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card isClickable>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-8 bg-green-100 rounded flex items-center justify-center mr-4">
                    <span className="text-xs font-medium text-green-600">MP</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">MobilePay</h4>
                    <p className="text-sm text-gray-600">Quick payment with MobilePay</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Popular in Denmark</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-red-800">
                <p className="font-medium">Payment Error</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Button */}
        <div className="text-center">
          <Button
            variant="primary"
            size="lg"
            onClick={handleHostedCheckout}
            isLoading={isProcessing}
            disabled={isProcessing}
            className="px-8 py-3"
          >
            {isProcessing ? 'Processing...' : `Pay ${grandTotal}kr`}
          </Button>
          
          <p className="text-sm text-gray-500 mt-4">
            You will be redirected to our secure payment processor to complete your purchase.
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Secure Payment</p>
              <p>
                Your payment information is encrypted and processed securely. 
                We never store your card details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </BaseStep>
  );
};
