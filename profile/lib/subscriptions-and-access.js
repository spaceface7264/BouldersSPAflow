import { collectValueCardsArray } from './value-cards.js';

export function subscriptionSearchText(sub) {
  if (!sub || typeof sub !== 'object') return '';
  const parts = [
    sub.name,
    sub.productName,
    sub.subscriptionProduct?.name,
    sub.type,
    sub.subscriptionType,
    sub.planName,
    sub.membershipType,
    sub.description,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return parts.join(' ');
}

export function subscriptionIsTerminated(sub) {
  if (!sub?.statuses || !Array.isArray(sub.statuses)) return false;
  return sub.statuses.some((st) => st && st.code === 'TERMINATED');
}

export function collectSubscriptionsArray(customer) {
  if (!customer) return [];
  const list = [];
  const push = (x) => {
    if (x && typeof x === 'object' && !list.includes(x)) list.push(x);
  };
  push(customer.activeSubscription);
  if (Array.isArray(customer.subscriptions)) customer.subscriptions.forEach(push);
  if (Array.isArray(customer.memberships)) customer.memberships.forEach(push);
  push(customer.membership);
  return list;
}

export function pickDisplaySubscription(customer) {
  const all = collectSubscriptionsArray(customer);
  const active = all.filter((s) => !subscriptionIsTerminated(s));
  return active[0] || all[0] || null;
}

export function isTrialLikeSub(sub) {
  if (!sub) return false;
  if (sub.trial === true || sub.isTrial === true || sub.accessType === 'trial') return true;
  const t = subscriptionSearchText(sub);
  return (
    /\bintro\b/i.test(t) ||
    /15\s*day|15\s*dage|fifteen|prøve|trial|guest pass|gæst|prøveperiode|15-dags|15 dages/i.test(t)
  );
}

export function extractPunchCardFromCustomer(customer, subs) {
  const cards = collectValueCardsArray(customer || {});

  const fromCard = cards.find(Boolean);
  if (fromCard) {
    const entriesLeft =
      fromCard.remainingEntries ??
      fromCard.entriesLeft ??
      fromCard.clipsLeft ??
      fromCard.balance ??
      fromCard.visitsRemaining ??
      fromCard.remainingVisits;
    const exp =
      fromCard.validTo ??
      fromCard.expiryDate ??
      fromCard.expires ??
      fromCard.expiry ??
      fromCard.validUntil ??
      fromCard.validToDate;
    if (entriesLeft != null || exp) {
      return {
        entriesLeft: entriesLeft != null ? entriesLeft : null,
        expiryRaw: exp || null,
      };
    }
  }

  const subPunch = subs.find((s) => {
    const text = subscriptionSearchText(s);
    const hasCount =
      s?.remainingEntries != null ||
      s?.entriesRemaining != null ||
      s?.clipsRemaining != null ||
      s?.punchesRemaining != null;
    if (hasCount) return true;
    return /punch|klip|klippekort|value\s*card|clip|times?\s*card|gange/i.test(text);
  });
  if (!subPunch) return null;
  const entriesLeft =
    subPunch.remainingEntries ??
    subPunch.entriesRemaining ??
    subPunch.clipsRemaining ??
    subPunch.punchesRemaining ??
    subPunch.balance;
  const exp =
    subPunch.validTo ??
    subPunch.expiryDate ??
    subPunch.endDate ??
    subPunch.expires ??
    subPunch.validUntil ??
    subPunch.boundUntil;
  if (entriesLeft == null && !exp) return null;
  return { entriesLeft: entriesLeft != null ? entriesLeft : null, expiryRaw: exp || null };
}

export function getMembershipData(customer) {
  const sub =
    pickDisplaySubscription(customer) ||
    customer?.activeSubscription ||
    customer?.membership ||
    null;

  let planName =
    sub?.name ||
    sub?.productName ||
    sub?.subscriptionProduct?.name ||
    sub?.type ||
    customer?.membershipType ||
    '-';
  if (planName === '-' && customer?.hasMembership === true) {
    planName = 'Membership';
  }

  const activeSince =
    sub?.startDate ||
    sub?.start ||
    sub?.activeSince ||
    customer?.memberJoinDate ||
    customer?.memberSince ||
    '-';

  const priceRaw = sub?.price;
  let price = '-';
  /** ISO 4217 for Intl when price is a major-units number */
  let priceCurrency = 'DKK';
  if (priceRaw != null && typeof priceRaw === 'object' && priceRaw.amount != null) {
    const amt = Number(priceRaw.amount);
    if (Number.isFinite(amt)) {
      // BRP amounts are minor units (e.g. øre for DKK); same /100 pattern as app.js checkout flow
      price = amt / 100;
      priceCurrency = String(priceRaw.currency || 'DKK')
        .trim()
        .toUpperCase() || 'DKK';
    }
  } else if (priceRaw != null && priceRaw !== '') {
    price = priceRaw;
  } else if (sub?.monthlyPrice != null) {
    price = sub.monthlyPrice;
  }

  const gym =
    sub?.gymName ||
    sub?.businessUnitName ||
    sub?.businessUnit?.name ||
    customer?.primaryGym ||
    customer?.gymName ||
    '-';

  return {
    type: planName,
    activeSince,
    price,
    priceCurrency,
    gym,
    memberId: sub?.memberId || sub?.id || customer?.membershipNumber || customer?.memberId || customer?.id || '-',
    contractStatus: sub?.contractStatus || customer?.contractStatus || '-',
    boundUntil: sub?.boundUntil || sub?.end || customer?.boundUntil || null,
    cardConsentStatus: sub?.cardConsentStatus || customer?.cardConsentStatus || null,
  };
}

export function hasActiveMembership(customer) {
  if (!customer) return false;
  if (customer.hasMembership === true) return true;
  const subs = collectSubscriptionsArray(customer);
  if (subs.some((s) => !subscriptionIsTerminated(s))) return true;
  const membership = getMembershipData(customer || {});
  const hasDirectSub = Boolean(
    customer?.activeSubscription ||
      customer?.membership ||
      (Array.isArray(customer?.subscriptions) && customer.subscriptions.length > 0) ||
      (Array.isArray(customer?.memberships) && customer.memberships.length > 0)
  );
  return hasDirectSub || (membership.type && membership.type !== '-');
}

export function detectPrimaryAccess(customer) {
  if (!customer) return { kind: 'unknown' };
  const subs = collectSubscriptionsArray(customer);
  if (subs.some((s) => isTrialLikeSub(s))) {
    const trialSub = subs.find((s) => isTrialLikeSub(s));
    return { kind: 'trial', trialSub };
  }
  if (hasActiveMembership(customer)) return { kind: 'membership' };
  const punch = extractPunchCardFromCustomer(customer, subs);
  if (punch) return { kind: 'punch_card', punch };
  return { kind: 'unknown' };
}
