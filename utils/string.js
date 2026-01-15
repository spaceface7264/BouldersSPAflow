export function stripEmailPlusTag(email) {
  if (typeof email !== 'string') {
    return email;
  }

  const trimmed = email.trim();
  const [localPart, domain] = trimmed.split('@');
  if (!localPart || !domain) {
    return trimmed;
  }

  const plusIndex = localPart.indexOf('+');
  if (plusIndex === -1) {
    return trimmed;
  }

  const cleanedLocal = localPart.substring(0, plusIndex);
  return `${cleanedLocal}@${domain}`;
}
