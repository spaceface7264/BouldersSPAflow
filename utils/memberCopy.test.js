import test from 'node:test';
import assert from 'node:assert/strict';
import { memberAgeStatus, possessive } from './memberCopy.js';

test('memberAgeStatus distinguishes junior, youth, and unusable dates', () => {
  assert.equal(memberAgeStatus(null, 'junior'), 'empty');
  assert.equal(memberAgeStatus(undefined, 'guardian'), 'empty');
  assert.equal(memberAgeStatus(-1, 'junior'), 'invalid');
  assert.equal(memberAgeStatus(0, 'junior'), 'junior-ok');
  assert.equal(memberAgeStatus(15, 'junior'), 'junior-ok');
  assert.equal(memberAgeStatus(16, 'junior'), 'junior-bad');
  assert.equal(memberAgeStatus(16, 'guardian'), 'youth-ok');
  assert.equal(memberAgeStatus(17, 'guardian'), 'youth-ok');
  assert.equal(memberAgeStatus(15, 'guardian'), 'youth-bad');
  assert.equal(memberAgeStatus(18, 'guardian'), 'youth-bad');
  assert.equal(memberAgeStatus(120, 'junior'), 'junior-bad');
  assert.equal(memberAgeStatus(121, 'junior'), 'invalid');
  assert.equal(memberAgeStatus(1025, 'guardian'), 'invalid');
});

test('possessive follows Danish, English, and German name endings', () => {
  assert.equal(possessive('', 'da-DK'), '');
  assert.equal(possessive('  ', 'en-GB'), '');
  assert.equal(possessive('Emma', 'da-DK'), 'Emmas');
  assert.equal(possessive('Jonas', 'da-DK'), "Jonas'");
  assert.equal(possessive('Max', 'de'), "Max'");
  assert.equal(possessive('Emma', 'en-GB'), "Emma's");
  assert.equal(possessive('Jonas', 'en-GB'), "Jonas'");
});
