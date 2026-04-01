// BRP API3 response types for the dashboard
// Based on brp-api3-openapi.yaml schema definitions

// ── Primitives ────────────────────────────────────────────────────────────────

/** ISO date string "YYYY-MM-DD" */
export type Day = string;

/** ISO datetime string */
export type TimePoint = string;

export interface CurrencyOut {
  amount: number;
  currency: string; // e.g. "DKK"
}

// ── References ────────────────────────────────────────────────────────────────

export interface BusinessUnitOutRef {
  id: number;
  name: string;
  location?: string;
}

export interface ProductOutRef {
  id: number;
  name: string;
}

export interface CustomerOutRef {
  id: number;
  firstName: string;
  lastName: string;
}

export interface CustomerTypeOutRef {
  id: number;
  name: string; // e.g. "Almindelig/Voksen", "O.G", "Legend", "Studerende", "Young G"
}

export interface BenefitStatusOutRef {
  id: number;
  name: string;
}

export interface AddressOut {
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
}

// ── Customer Profile ──────────────────────────────────────────────────────────

export interface CustomerOut {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  mobilePhone?: { number?: string };
  birthDate?: Day;
  shippingAddress?: AddressOut;
  businessUnit?: BusinessUnitOutRef; // Home gym
  customerType?: CustomerTypeOutRef; // "Bloc Life" status: O.G, Legend, Young G, etc.
  memberJoinDate?: Day; // "Member since"
  hasMembership?: boolean;
  benefitStatus?: BenefitStatusOutRef;
  suspended?: boolean;
  profileImage?: { id: number; url?: string };
}

// ── Subscriptions (Memberships) ───────────────────────────────────────────────

export type SubscriptionStatusCode =
  | 'FROZEN'
  | 'TERMINATED'
  | 'CONTRACT_NOT_SIGNED'
  | 'FUTURE_FREEZE'
  | 'MISSING_CARDCONSENT'
  | 'MISSING_VALID_CARDCONSENT'
  | string;

export interface SubscriptionStatus {
  code: SubscriptionStatusCode;
  level: 'INFO' | 'WARNING' | 'ERROR';
}

export interface SubscriptionOut {
  id: number;
  start?: Day; // First valid day of subscription
  boundUntil?: Day; // Last day customer is bound to pay
  debitedUntil?: Day;
  expirationDay?: Day;
  subscriptionProduct?: ProductOutRef; // Membership plan name
  businessUnit?: BusinessUnitOutRef;
  payer?: CustomerOutRef;
  users?: CustomerOutRef[];
  statuses?: SubscriptionStatus[];
  freeze?: {
    period?: { start: Day; end: Day };
    reason?: number;
  };
  price?: CurrencyOut; // Current monthly price
  paymentOption?: { id: number; name: string };
}

/** Derived access type for display logic */
export type AccessType = 'membership' | 'trial' | 'punch-card' | 'none';

// ── Value Cards (Punch Cards) ─────────────────────────────────────────────────

export interface CustomerValueCardOut {
  id: number;
  number?: number;
  validCardProduct?: ProductOutRef;
  businessUnit?: BusinessUnitOutRef;
  type?: 'AMOUT' | 'UNIT'; // Note: BRP has a typo "AMOUT" instead of "AMOUNT"
  unitsLeft?: number;
  amountLeft?: number;
  validUntil?: Day;
  isValid?: boolean;
}

// ── Group Activity Bookings ───────────────────────────────────────────────────

export interface GroupActivityBookingOut {
  type?: string;
  groupActivity?: {
    id: number;
    name: string;
  };
  businessUnit?: BusinessUnitOutRef;
  customer?: CustomerOutRef;
  duration?: {
    start: TimePoint;
    end: TimePoint;
  };
  groupActivityBooking?: {
    id: number;
  };
  checkedIn?: TimePoint | null;
  isDebited?: boolean;
}

// ── Group Activities (for recommendations) ────────────────────────────────────

export interface GroupActivityOut {
  id: number;
  name: string;
  description?: string;
  duration?: {
    start: TimePoint;
    end: TimePoint;
  };
  slots?: {
    total?: number;
    available?: number;
    waitingList?: number;
  };
  instructor?: {
    firstName?: string;
    lastName?: string;
  };
  businessUnit?: BusinessUnitOutRef;
}

// ── Trial product name identifiers ───────────────────────────────────────────

export const TRIAL_PRODUCT_NAMES = [
  '15-Dages Prøveperiode',
  '15-Day Trial Pass',
  'prøveperiode',
  'trial pass',
] as const;

export function isTrial(subscriptionProductName?: string): boolean {
  if (!subscriptionProductName) return false;
  const lower = subscriptionProductName.toLowerCase();
  return TRIAL_PRODUCT_NAMES.some((n) => lower.includes(n.toLowerCase()));
}
