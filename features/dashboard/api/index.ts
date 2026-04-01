import { getAccessToken } from '../../../shared/lib/tokens';
import type {
  CustomerOut,
  SubscriptionOut,
  CustomerValueCardOut,
  GroupActivityBookingOut,
  GroupActivityOut,
} from '../types';

// BRP API3 — proxied at /api/ver3/ in both dev (Vite) and prod (Cloudflare)
async function brpGet<T>(path: string): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(path, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'da-DK',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`BRP API ${response.status}`), {
      status: response.status,
      data: err,
    });
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch the authenticated customer's profile.
 * Includes: name, email, memberJoinDate, businessUnit (home gym), customerType (bloc life tier)
 */
export function getCustomerProfile(customerId: string): Promise<CustomerOut> {
  return brpGet<CustomerOut>(`/api/ver3/customers/${customerId}`);
}

/**
 * Fetch all active subscriptions (memberships + trials) for the customer.
 * Includes product name, start date, boundUntil, price, statuses (FROZEN, etc.)
 */
export function getSubscriptions(customerId: string): Promise<SubscriptionOut[]> {
  return brpGet<SubscriptionOut[]>(`/api/ver3/customers/${customerId}/subscriptions`);
}

/**
 * Fetch all value cards (punch cards) for the customer.
 * Includes: unitsLeft, validUntil, productName
 */
export function getValueCards(customerId: string): Promise<CustomerValueCardOut[]> {
  return brpGet<CustomerValueCardOut[]>(`/api/ver3/customers/${customerId}/valuecards`);
}

/**
 * Fetch the customer's group activity bookings.
 * We filter client-side to only return upcoming (future) bookings.
 */
export async function getUpcomingBookings(
  customerId: string
): Promise<GroupActivityBookingOut[]> {
  const all = await brpGet<GroupActivityBookingOut[]>(
    `/api/ver3/customers/${customerId}/bookings/groupactivities`
  );

  const now = new Date();
  return all.filter((b) => {
    if (!b.duration?.start) return false;
    return new Date(b.duration.start) > now;
  });
}

/**
 * Fetch upcoming group activities at a business unit (for class recommendations).
 * Looks ahead 14 days from today.
 */
export async function getRecommendedActivities(
  businessUnitId: number,
  limit = 3
): Promise<GroupActivityOut[]> {
  const today = new Date();
  const future = new Date();
  future.setDate(future.getDate() + 14);

  const start = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const end = future.toISOString().split('T')[0];

  const params = new URLSearchParams({
    'period.start': start,
    'period.end': end,
  });

  const results = await brpGet<GroupActivityOut[]>(
    `/api/ver3/businessunits/${businessUnitId}/groupactivities?${params}`
  );

  // Return only activities that still have available slots, sorted by start time
  return results
    .filter((a) => {
      if (!a.duration?.start) return true; // Include if no time info
      return new Date(a.duration.start) > new Date();
    })
    .sort((a, b) => {
      const aTime = a.duration?.start ? new Date(a.duration.start).getTime() : 0;
      const bTime = b.duration?.start ? new Date(b.duration.start).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, limit);
}
