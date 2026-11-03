const MAX_MEMBER_AGE = 120;

export function memberAgeStatus(age, mode) {
  if (age == null || !Number.isFinite(age)) return 'empty';
  if (age < 0 || age > MAX_MEMBER_AGE) return 'invalid';
  if (mode === 'guardian') {
    return age === 16 || age === 17 ? 'youth-ok' : 'youth-bad';
  }
  return age < 16 ? 'junior-ok' : 'junior-bad';
}

export function possessive(name, language) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return '';
  const last = trimmed.slice(-1);
  if (String(language || '').toLowerCase().startsWith('en')) {
    return /s/i.test(last) ? `${trimmed}'` : `${trimmed}'s`;
  }
  return /[sxz]/i.test(last) ? `${trimmed}'` : `${trimmed}s`;
}
