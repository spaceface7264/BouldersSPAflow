import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { personalInfoSchema, type PersonalInfoFormData } from '../schemas';
import { useSignupStore } from '../state';
import { BaseStep } from './BaseStep';
import { Input, Select, Button } from '../../../shared/ui';
import { COUNTRIES, GENDERS, EXPERIENCE_LEVELS } from '../../../shared/constants';

export const PersonalInfoStep: React.FC = () => {
  const { updateDraft, nextStep } = useSignupStore();
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

  return (
    <BaseStep
      stepId="personal"
      title="Personal Information"
      description="Please provide your personal details to continue"
      canProceed={isValid}
      onNext={handleSubmit(onSubmit)}
      nextButtonText={isSubmitting ? 'Saving...' : 'Continue'}
      showNavigation={false}
    >
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
