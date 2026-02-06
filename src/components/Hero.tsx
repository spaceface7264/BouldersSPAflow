import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MEMBERSHIP_PLANS } from '../../shared/constants';
import { useSignupStore } from '../../features/signup/state';
import type { MembershipSelection } from '../../shared/types';

export const Hero: React.FC = () => {
  const navigate = useNavigate();
  const { updateDraft, markStepCompleted, setCurrentStep } = useSignupStore();

  const handlePlanSelect = (plan: typeof MEMBERSHIP_PLANS[0]) => {
    const selection: MembershipSelection = {
      type: plan.type,
      planId: plan.id,
      totalPrice: plan.price,
      quantity: plan.type === 'punch-card' ? 1 : undefined,
    };

    // Pre-select the plan and mark membership step as done
    updateDraft({ membership: selection });
    markStepCompleted('membership');
    setCurrentStep('personal');
    navigate('/signup/personal');
  };

  const handleGenericStart = () => {
    setCurrentStep('membership');
    navigate('/signup/membership');
  };

  return (
    <div className="min-h-screen bg-boulders-dark relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-boulders-purple/20 via-boulders-dark to-boulders-magenta/20"></div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-boulders-purple/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-boulders-magenta/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-boulders-magenta rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-2xl">B</span>
              </div>
              <span className="text-white font-bold text-3xl tracking-tight">BOULDERS</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-4 leading-tight">
              KLATRING &{' '}
              <span className="bg-gradient-to-r from-boulders-purple to-boulders-magenta bg-clip-text text-transparent">
                BOULDERING
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-300 mb-2 max-w-2xl mx-auto">
              Join Your Bouldering Network. Pick a plan and start climbing today.
            </p>
            <p className="text-sm text-gray-500">
              Free registration &middot; Cancel anytime &middot; Access to all gyms
            </p>
          </div>

          {/* Plan Cards -- the core conversion element */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {MEMBERSHIP_PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handlePlanSelect(plan)}
                className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 text-left
                           hover:border-boulders-purple transition-all duration-300 hover:scale-[1.02]
                           hover:shadow-lg hover:shadow-boulders-purple/20 group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {plan.type === 'membership' ? 'Membership' : 'Punch Card'}
                  </span>
                  {plan.id === 'premium-monthly' && (
                    <span className="text-xs font-bold bg-gradient-to-r from-boulders-purple to-boulders-magenta text-white px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{plan.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm ml-1">
                    kr{plan.type === 'membership' ? '/mo' : ''}
                  </span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.slice(0, 3).map((feature, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-300">
                      <svg className="w-4 h-4 text-green-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="w-full py-3 rounded-lg text-center font-semibold text-sm
                              bg-gradient-to-r from-boulders-purple to-boulders-magenta text-white
                              group-hover:shadow-md group-hover:shadow-boulders-purple/30 transition-all">
                  Select &amp; Continue
                </div>
              </button>
            ))}
          </div>

          {/* Secondary CTA for undecided users */}
          <div className="text-center mb-16">
            <button
              onClick={handleGenericStart}
              className="text-gray-400 hover:text-white text-sm underline underline-offset-4 transition-colors"
            >
              Not sure yet? Compare all plans in detail
            </button>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 text-center">
              <div className="w-10 h-10 bg-gradient-to-r from-boulders-purple to-boulders-magenta rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Moderne Haller</h3>
              <p className="text-sm text-gray-400">State-of-the-art climbing facilities for all levels</p>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 text-center">
              <div className="w-10 h-10 bg-gradient-to-r from-boulders-purple to-boulders-magenta rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Fællesskab</h3>
              <p className="text-sm text-gray-400">Join a supportive community of climbers</p>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 text-center">
              <div className="w-10 h-10 bg-gradient-to-r from-boulders-purple to-boulders-magenta rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Ekspert Coaching</h3>
              <p className="text-sm text-gray-400">Learn from experienced climbing instructors</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
