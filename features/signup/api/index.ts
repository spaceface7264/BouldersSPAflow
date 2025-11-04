import { api } from '../../../shared/lib/http';
import type { SignupDraft, ApiResponse } from '../../../shared/types';

export interface PaymentResult {
  success: boolean;
  redirectUrl?: string;
  message?: string;
}

export const finalizePayment = async (draft: SignupDraft): Promise<PaymentResult> => {
  try {
    const response = await api.post<{ redirectUrl: string }>('/payments/create', {
      personalInfo: draft.personalInfo,
      membership: draft.membership,
      addons: draft.addons,
    });

    if (response.success && response.data.redirectUrl) {
      return {
        success: true,
        redirectUrl: response.data.redirectUrl,
      };
    }

    return {
      success: false,
      message: response.message || 'Payment initialization failed',
    };
  } catch (error) {
    console.error('Payment API error:', error);
    return {
      success: false,
      message: 'An error occurred while processing your payment. Please try again.',
    };
  }
};

export const validatePersonalInfo = async (personalInfo: any): Promise<ApiResponse> => {
  return api.post('/signup/validate/personal', personalInfo);
};

export const validateMembership = async (membership: any): Promise<ApiResponse> => {
  return api.post('/signup/validate/membership', membership);
};

export const createMembership = async (draft: SignupDraft): Promise<ApiResponse> => {
  return api.post('/memberships', {
    personalInfo: draft.personalInfo,
    membership: draft.membership,
    addons: draft.addons,
  });
};

export const getMembershipPlans = async (): Promise<ApiResponse> => {
  return api.get('/memberships/plans');
};

export const getAddonProducts = async (): Promise<ApiResponse> => {
  return api.get('/products/addons');
};
