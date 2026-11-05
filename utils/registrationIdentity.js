/**
 * Identity and age-routing helpers for guardian-dedup signup (pure functions).
 */

export function normalizePhone(countryCode, number) {
  const rawNumber = typeof number === 'string' ? number.replace(/\s/g, '') : '';
  if (!rawNumber) return null;

  const country = String(countryCode ?? '')
    .replace(/\s/g, '')
    .replace(/^\+/, '');

  let digits = rawNumber.replace(/^\+/, '');
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (!digits) return null;

  return { country, number: digits };
}

export function classifyIdentityCheck({ emailMatch, phoneMatch, unavailable }) {
  if (unavailable) return 'unavailable';
  if (emailMatch) return 'email_exists';
  if (phoneMatch) return 'phone_exists';
  return 'create';
}

function productText(product) {
  const parts = [
    product?.name,
    product?.externalDescription,
    product?.description,
    ...(product?.productLabels ?? []).map((label) => label?.name),
  ];
  return parts.filter(Boolean).join(' ');
}

export function productKind(product) {
  const text = productText(product);
  if (Number(product?.id) === 56 || /junior/i.test(text)) {
    return 'junior';
  }
  if (/student|youth|ungdom/i.test(text)) {
    return 'studentYouth';
  }
  return 'adult';
}

export function ageInYears(birthDate, today) {
  if (!birthDate || !today) return null;
  const [birthY, birthM, birthD] = birthDate.split('-').map(Number);
  const [todayY, todayM, todayD] = today.split('-').map(Number);
  if (
    !Number.isFinite(birthY) ||
    !Number.isFinite(birthM) ||
    !Number.isFinite(birthD) ||
    !Number.isFinite(todayY) ||
    !Number.isFinite(todayM) ||
    !Number.isFinite(todayD)
  ) {
    return null;
  }
  let age = todayY - birthY;
  const monthDiff = todayM - birthM;
  const dayDiff = todayD - birthD;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

export function membershipAgeRoute({ buyerAge, productKind: kind }) {
  if (buyerAge == null) return { action: 'block', reason: 'invalid' };
  if (kind === 'junior') {
    if (buyerAge < 18) return { action: 'block', reason: 'buyer_under_18' };
    return { action: 'junior_member_form' };
  }
  if (kind === 'studentYouth') {
    if (buyerAge < 16) return { action: 'block', reason: 'choose_junior' };
    if (buyerAge > 20) return { action: 'block', reason: 'student_youth_age' };
    if (buyerAge < 18) return { action: 'guardian_handoff' };
    return { action: 'continue' };
  }
  if (buyerAge < 16) return { action: 'block', reason: 'choose_junior' };
  if (buyerAge < 18) return { action: 'block', reason: 'choose_student_youth' };
  return { action: 'continue' };
}

/**
 * Pick a customer type from price-list probes when the name catalogue is empty.
 * One priced type is used when it lists the product, lists no products, or the product id is unknown.
 * A known product that is not on that type does not match. The probe has to keep
 * scanning past gaps so the type that actually lists the product can still be found.
 * Several priced types resolve only when the product sits on exactly one of them.
 */
export function choosePricedCustomerType(pricedTypes, productId) {
  const priced = (Array.isArray(pricedTypes) ? pricedTypes : []).filter((type) =>
    Number.isFinite(Number(type?.id)),
  );
  if (priced.length === 1) {
    const ids = Array.isArray(priced[0].productIds) ? priced[0].productIds : [];
    const product = productId == null || productId === '' ? NaN : Number(productId);
    const listed = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (!Number.isFinite(product) || listed.length === 0 || listed.includes(product)) {
      return Number(priced[0].id);
    }
    return null;
  }
  if (priced.length === 0) return null;
  const product = Number(productId);
  if (!Number.isFinite(product)) return null;
  const matches = priced.filter((type) =>
    (Array.isArray(type.productIds) ? type.productIds : []).some((id) => Number(id) === product),
  );
  return matches.length === 1 ? Number(matches[0].id) : null;
}

export function buildOtherUserBody({
  member,
  businessUnit,
  customerType,
  appId,
  otherUserType,
}) {
  const body = {
    customerType,
    businessUnit,
    firstName: member.firstName,
    lastName: member.lastName,
    birthDate: member.birthDate,
    haveParentalConsent: true,
    otherUserType,
    appId,
  };

  const email = typeof member.email === 'string' ? member.email.trim() : '';
  if (email) {
    body.email = email;
  }

  if (member.phone?.number) {
    const country = member.phone.country ?? member.phone.countryCode;
    body.mobilePhone = {
      number: member.phone.number,
      ...(country != null && country !== ''
        ? { countryCode: String(country).replace(/^\+/, '') }
        : {}),
    };
  }

  return body;
}

export function buildOrderIdentity({ payerId, businessUnit, memberId, forOther }) {
  const order = {
    customer: payerId,
    businessUnit,
    source: 'join.boulders.dk',
  };
  if (forOther && memberId != null) {
    order.subscriptionUser = memberId;
    order.buySubscriptionForOtherUser = true;
  }
  return order;
}

export function memberKey({ payerId, memberId, firstName, lastName, birthDate }) {
  if (memberId != null) {
    return `existing:${memberId}`;
  }
  const fn = String(firstName ?? '').trim().toLowerCase();
  const ln = String(lastName ?? '').trim().toLowerCase();
  return `${payerId}|${fn}|${ln}|${birthDate}`;
}
