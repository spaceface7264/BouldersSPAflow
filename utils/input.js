export function formatCardNumber(event) {
  const digits = event.target.value.replace(/\s+/g, '').replace(/[^\d]/g, '');
  event.target.value = digits.replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
}

export function formatExpiryDate(event) {
  const digits = event.target.value.replace(/[^\d]/g, '');
  const formatted = digits.length >= 2 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}` : digits;
  event.target.value = formatted.slice(0, 5);
}

export function stripNonDigits(event) {
  event.target.value = event.target.value.replace(/[^\d]/g, '');
}
