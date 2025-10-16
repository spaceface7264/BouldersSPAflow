export interface Step {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  isCompleted: boolean;
  isAccessible: boolean;
}

export interface SignupDraft {
  personalInfo?: PersonalInfo;
  membership?: MembershipSelection;
  addons?: AddonSelection[];
  payment?: PaymentInfo;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate: string;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  address: string;
  city: string;
  zipCode: string;
  country: string;
  experience?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  termsAccepted: boolean;
  newsletter?: boolean;
}

export interface MembershipSelection {
  type: 'membership' | 'punch-card';
  planId: string;
  quantity?: number;
  totalPrice: number;
}

export interface AddonSelection {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentInfo {
  method: 'hosted-checkout' | 'card' | 'mobilepay';
  redirectUrl?: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  features: string[];
  type: 'membership' | 'punch-card';
  maxQuantity?: number;
  minQuantity?: number;
}

export interface AddonProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  features: string[];
  imageUrl?: string;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export type StepId = 'personal' | 'membership' | 'addons' | 'review' | 'payment' | 'success';
