import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  classifyIdentityCheck,
  productKind,
  ageInYears,
  membershipAgeRoute,
  buildOtherUserBody,
  buildOrderIdentity,
  memberKey,
} from './registrationIdentity.js';

test('normalizePhone strips spaces, a leading zero, and plus', () => {
  assert.deepEqual(normalizePhone('+45', ' 12 34 56 78 '), { country: '45', number: '12345678' });
  assert.equal(normalizePhone('+45', ''), null);
});

test('classifyIdentityCheck lets an email hit win over a phone hit', () => {
  assert.equal(classifyIdentityCheck({ emailMatch: false, phoneMatch: false }), 'create');
  assert.equal(classifyIdentityCheck({ emailMatch: true, phoneMatch: true }), 'email_exists');
  assert.equal(classifyIdentityCheck({ emailMatch: false, phoneMatch: true }), 'phone_exists');
  assert.equal(classifyIdentityCheck({ unavailable: true }), 'unavailable');
});

test('productKind treats youth and ungdom as student/youth, not junior', () => {
  assert.equal(productKind({ id: 56, name: 'Medlemskab' }), 'junior');
  assert.equal(productKind({ id: 10, productLabels: [{ name: 'Junior' }] }), 'junior');
  assert.equal(productKind({ id: 135, name: 'Student Youth' }), 'studentYouth');
  assert.equal(productKind({ id: 10, productLabels: [{ name: 'Ungdom' }] }), 'studentYouth');
  assert.equal(productKind({ id: 134, name: 'Medlemskab' }), 'adult');
});

test('membership age routes', () => {
  assert.equal(ageInYears('2010-10-28', '2026-10-27'), 15);
  assert.deepEqual(membershipAgeRoute({ buyerAge: 40, productKind: 'junior' }), { action: 'junior_member_form' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 17, productKind: 'junior' }), { action: 'block', reason: 'buyer_under_18' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 17, productKind: 'studentYouth' }), { action: 'guardian_handoff' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 19, productKind: 'studentYouth' }), { action: 'continue' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 15, productKind: 'studentYouth' }), { action: 'block', reason: 'choose_junior' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 21, productKind: 'studentYouth' }), { action: 'block', reason: 'student_youth_age' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 17, productKind: 'adult' }), { action: 'block', reason: 'choose_student_youth' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 15, productKind: 'adult' }), { action: 'block', reason: 'choose_junior' });
  assert.deepEqual(membershipAgeRoute({ buyerAge: 30, productKind: 'adult' }), { action: 'continue' });
});

test('otheruser body omits an empty junior email and never includes a password', () => {
  const body = buildOtherUserBody({
    member: { firstName: 'Aya', lastName: 'Nielsen', birthDate: '2014-04-02', email: '', phone: null },
    businessUnit: 1,
    customerType: 9,
    appId: 416,
    otherUserType: 'CHILD',
  });
  assert.equal(body.otherUserType, 'CHILD');
  assert.equal(body.customerType, 9);
  assert.equal(body.haveParentalConsent, true);
  assert.equal('password' in body, false);
  assert.equal('email' in body, false);
});

test('a 16-year-old member body includes their own email', () => {
  const body = buildOtherUserBody({
    member: { firstName: 'Noa', lastName: 'Nielsen', birthDate: '2010-01-02', email: 'noa@example.com', phone: null },
    businessUnit: 1,
    customerType: 4,
    appId: 416,
    otherUserType: 'CHILD',
  });
  assert.equal(body.email, 'noa@example.com');
});

test('order identity and member key', () => {
  assert.deepEqual(buildOrderIdentity({ payerId: 10, businessUnit: 1, memberId: 77, forOther: true }), {
    customer: 10,
    businessUnit: 1,
    source: 'join.boulders.dk',
    subscriptionUser: 77,
    buySubscriptionForOtherUser: true,
  });
  assert.equal(
    buildOrderIdentity({ payerId: 10, businessUnit: 1, memberId: null, forOther: false }).subscriptionUser,
    undefined,
  );
  assert.equal(memberKey({ payerId: 10, firstName: 'Aya', lastName: 'Nielsen', birthDate: '2014-04-02' }), '10|aya|nielsen|2014-04-02');
  assert.equal(memberKey({ payerId: 10, memberId: 77 }), 'existing:77');
});
