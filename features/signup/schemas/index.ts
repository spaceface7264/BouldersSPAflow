import { z } from 'zod';

export const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  birthDate: z.string().min(1, 'Birth date is required'),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  address: z.string().min(1, 'Address is required').max(200, 'Address too long'),
  city: z.string().min(1, 'City is required').max(100, 'City name too long'),
  zipCode: z.string().min(1, 'ZIP code is required').max(20, 'ZIP code too long'),
  country: z.string().min(1, 'Country is required'),
  experience: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  newsletter: z.boolean().optional(),
});

export const membershipSelectionSchema = z.object({
  type: z.enum(['membership', 'punch-card']),
  planId: z.string().min(1, 'Plan selection is required'),
  quantity: z.number().min(1).max(10).optional(),
  totalPrice: z.number().min(0, 'Price must be positive'),
});

export const addonSelectionSchema = z.object({
  id: z.string().min(1, 'Addon ID is required'),
  name: z.string().min(1, 'Addon name is required'),
  price: z.number().min(0, 'Price must be positive'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(10, 'Maximum 10 items'),
});

export const paymentInfoSchema = z.object({
  method: z.enum(['hosted-checkout', 'card', 'mobilepay']),
  redirectUrl: z.string().url().optional(),
});

export const signupDraftSchema = z.object({
  personalInfo: personalInfoSchema.optional(),
  membership: membershipSelectionSchema.optional(),
  addons: z.array(addonSelectionSchema).optional(),
  payment: paymentInfoSchema.optional(),
});

// Step-specific validation schemas
export const stepSchemas = {
  personal: personalInfoSchema,
  membership: membershipSelectionSchema,
  addons: z.array(addonSelectionSchema),
  review: signupDraftSchema,
  payment: paymentInfoSchema,
  success: z.object({}), // No validation needed for success step
} as const;

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;
export type MembershipSelectionFormData = z.infer<typeof membershipSelectionSchema>;
export type AddonSelectionFormData = z.infer<typeof addonSelectionSchema>;
export type PaymentInfoFormData = z.infer<typeof paymentInfoSchema>;
export type SignupDraftFormData = z.infer<typeof signupDraftSchema>;
