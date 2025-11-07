// Production backend URL - hard-coded as per implementation guide Step 1
export const API_BASE_URL = 'https://api-join.boulders.dk';

// API Authentication Token
// Get this from the Postman documentation: https://documenter.getpostman.com/view/6552350/2sB3QNq9Fv
// Set via environment variable or update directly here for development
export const API_AUTH_TOKEN = (import.meta as any).env?.VITE_API_AUTH_TOKEN || '';

export const STEPS = [
  { id: 'personal', title: 'Personal Info', description: 'Tell us about yourself' },
  { id: 'membership', title: 'Choose Plan', description: 'Select your membership' },
  { id: 'addons', title: 'Add-ons', description: 'Enhance your experience' },
  { id: 'review', title: 'Review', description: 'Confirm your selection' },
  { id: 'payment', title: 'Payment', description: 'Complete your purchase' },
  { id: 'success', title: 'Success', description: 'Welcome to Boulders!' },
] as const;

export const MEMBERSHIP_PLANS = [
  {
    id: 'basic-monthly',
    name: 'Basic Monthly',
    description: 'Perfect for beginners',
    price: 299,
    originalPrice: undefined,
    features: [
      'Access to all gyms',
      'Free registration and cancellation',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes'
    ],
    type: 'membership' as const
  },
  {
    id: 'premium-monthly',
    name: 'Premium Monthly',
    description: 'Advanced features included',
    price: 399,
    originalPrice: undefined,
    features: [
      'Access to all gyms',
      'Free registration and cancellation',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes'
    ],
    type: 'membership' as const
  },
  {
    id: 'individual-punch',
    name: 'Individual Punch Card',
    description: 'Pay as you climb',
    price: 1200,
    originalPrice: undefined,
    features: [
      '10 climbing sessions',
      'Valid for 6 months',
      'Transferable between gyms',
      'No monthly commitment'
    ],
    type: 'punch-card' as const,
    maxQuantity: 5,
    minQuantity: 1
  }
];

export const ADDON_PRODUCTS = [
  {
    id: 'climbing-shoes',
    name: 'Climbing Shoes',
    description: 'Essential climbing shoes for beginners',
    price: 399,
    originalPrice: 599,
    features: [
      'High-quality rubber sole',
      'Comfortable fit',
      'Perfect for bouldering',
      'Available in multiple sizes'
    ]
  },
  {
    id: 'chalk-bag-set',
    name: 'Chalk Bag Set',
    description: 'Complete chalk bag with magnesium chalk',
    price: 199,
    originalPrice: 299,
    features: [
      'Premium magnesium chalk',
      'Durable chalk bag',
      'Brush included',
      'Multiple color options'
    ]
  }
];

export const COUNTRIES = [
  { value: 'DK', label: 'Denmark' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DE', label: 'Germany' },
  { value: 'other', label: 'Other' }
] as const;

export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' }
] as const;

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner (0-6 months)' },
  { value: 'intermediate', label: 'Intermediate (6 months - 2 years)' },
  { value: 'advanced', label: 'Advanced (2+ years)' },
  { value: 'expert', label: 'Expert (5+ years)' }
] as const;
