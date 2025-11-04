import React, { useState } from 'react';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Card, CardContent, Button } from '../../../shared/ui';
import { MEMBERSHIP_PLANS } from '../../../shared/constants';
import type { MembershipSelection } from '../../../shared/types';

export const MembershipStep: React.FC = () => {
  const { draft, updateDraft, nextStep } = useSignupStore();
  const [selectedPlan, setSelectedPlan] = useState<MembershipSelection | null>(
    draft.membership || null
  );
  const [selectedType, setSelectedType] = useState<'membership' | 'punch-card'>('membership');

  const membershipPlans = MEMBERSHIP_PLANS.filter(plan => plan.type === 'membership');
  const punchCardPlans = MEMBERSHIP_PLANS.filter(plan => plan.type === 'punch-card');

  const handlePlanSelect = (plan: typeof MEMBERSHIP_PLANS[0]) => {
    const selection: MembershipSelection = {
      type: plan.type,
      planId: plan.id,
      totalPrice: plan.price,
      quantity: plan.type === 'punch-card' ? 1 : undefined,
    };
    
    setSelectedPlan(selection);
    updateDraft({ membership: selection });
  };

  const handleQuantityChange = (planId: string, quantity: number) => {
    const plan = MEMBERSHIP_PLANS.find(p => p.id === planId);
    if (!plan) return;

    const selection: MembershipSelection = {
      type: plan.type,
      planId: plan.id,
      totalPrice: plan.price * quantity,
      quantity,
    };
    
    setSelectedPlan(selection);
    updateDraft({ membership: selection });
  };

  const handleNext = () => {
    if (selectedPlan) {
      nextStep();
    }
  };

  return (
    <BaseStep
      stepId="membership"
      title="Choose Your Membership"
      description="Select the membership plan or punch card that best fits your needs"
      canProceed={!!selectedPlan}
      onNext={handleNext}
    >
      <div className="space-y-8">
        {/* Type Toggle */}
        <div className="flex justify-center">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                selectedType === 'membership'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setSelectedType('membership')}
            >
              Membership
            </button>
            <button
              type="button"
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                selectedType === 'punch-card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setSelectedType('punch-card')}
            >
              Punch Card
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(selectedType === 'membership' ? membershipPlans : punchCardPlans).map((plan) => (
            <Card
              key={plan.id}
              isClickable
              isSelected={selectedPlan?.planId === plan.id}
              onClick={() => handlePlanSelect(plan)}
              className="h-full"
            >
              <CardContent className="h-full flex flex-col">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-purple-600">
                      {plan.price}kr
                    </span>
                    {plan.originalPrice && (
                      <span className="text-lg text-gray-400 line-through ml-2">
                        {plan.originalPrice}kr
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.type === 'punch-card' && selectedPlan?.planId === plan.id && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentQty = selectedPlan?.quantity || 1;
                          if (currentQty > (plan.minQuantity || 1)) {
                            handleQuantityChange(plan.id, currentQty - 1);
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-medium">
                        {selectedPlan?.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentQty = selectedPlan?.quantity || 1;
                          if (currentQty < (plan.maxQuantity || 5)) {
                            handleQuantityChange(plan.id, currentQty + 1);
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Total: {selectedPlan?.totalPrice || plan.price}kr
                    </div>
                  </div>
                )}

                <Button
                  variant={selectedPlan?.planId === plan.id ? 'primary' : 'outline'}
                  className="w-full"
                >
                  {selectedPlan?.planId === plan.id ? 'Selected' : 'Select'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </BaseStep>
  );
};
