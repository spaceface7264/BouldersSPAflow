import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { personalInfoSchema, type PersonalInfoFormData } from '../schemas';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Input, Select, Button } from '../../../shared/ui';
import { COUNTRIES, GENDERS, EXPERIENCE_LEVELS } from '../../../shared/constants';

export const PersonalInfoStep: React.FC = () => {
  const { updateDraft, nextStep, draft } = useSignupStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: PersonalInfoFormData) => {
    setIsSubmitting(true);
    try {
      updateDraft({ personalInfo: data });
      nextStep();
    } catch (error) {
      console.error('Error saving personal info:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (draft.membership) {
      // User came from hero with a pre-selected plan -- go back to hero
      navigate('/');
    } else {
      // User came from the membership step
      navigate('/signup/membership');
    }
  };

  return (
    <BaseStep
      stepId="personal"
      title="Personal Information"
      description="Please provide your personal details to continue"
      canProceed={isValid}
      onNext={handleSubmit(onSubmit)}
      onPrev={handleBack}
      nextButtonText={isSubmitting ? 'Saving...' : 'Continue'}
      prevButtonText="Change Plan"
      showNavigation={false}
    >
      {/* Selected plan summary banner */}
      {draft.membership && (
        <div className="mb-6 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-purple-900">
              Selected: {draft.membership.planId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} &mdash; {draft.membership.totalPrice}kr
            </span>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium underline"
          >
            Change
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="First Name"
            isRequired
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          
          <Input
            label="Last Name"
            isRequired
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Email Address"
            type="email"
            isRequired
            error={errors.email?.message}
            {...register('email')}
          />
          
          <Input
            label="Phone Number"
            type="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Date of Birth"
            type="date"
            isRequired
            error={errors.birthDate?.message}
            {...register('birthDate')}
          />
          
          <Select
            label="Gender"
            options={GENDERS as any}
            placeholder="Select gender"
            error={errors.gender?.message}
            {...register('gender')}
          />
        </div>

        <Input
          label="Address"
          isRequired
          error={errors.address?.message}
          {...register('address')}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input
            label="City"
            isRequired
            error={errors.city?.message}
            {...register('city')}
          />
          
          <Input
            label="ZIP Code"
            isRequired
            error={errors.zipCode?.message}
            {...register('zipCode')}
          />
          
          <Select
            label="Country"
            options={COUNTRIES as any}
            placeholder="Select country"
            isRequired
            error={errors.country?.message}
            {...register('country')}
          />
        </div>

        <Select
          label="Bouldering Experience"
            options={EXPERIENCE_LEVELS as any}
          placeholder="Select your experience level"
          error={errors.experience?.message}
          {...register('experience')}
        />

        <div className="space-y-4">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="terms"
              className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              {...register('termsAccepted')}
            />
            <label htmlFor="terms" className="ml-2 text-sm text-gray-700">
              I agree to the{' '}
              <a
                href="https://boulders.dk/en/regelst-for-medlemmer-af-boulders"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-500 underline"
              >
                Terms and Conditions
              </a>
              {' '}*
            </label>
          </div>
          {errors.termsAccepted && (
            <p className="text-sm text-red-600">{errors.termsAccepted.message}</p>
          )}

          <div className="flex items-start">
            <input
              type="checkbox"
              id="newsletter"
              className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              {...register('newsletter')}
            />
            <label htmlFor="newsletter" className="ml-2 text-sm text-gray-700">
              Subscribe to our newsletter for updates and special offers
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!isValid}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </form>
    </BaseStep>
  );
};
