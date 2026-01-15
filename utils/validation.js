export function isValidCardNumber(value) {
  const digits = value.replace(/\s+/g, '');
  return /^\d{13,19}$/.test(digits);
}

export function isValidExpiryDate(value) {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(value);
}
