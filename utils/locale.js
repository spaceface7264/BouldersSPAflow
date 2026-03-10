// Helper function to get flag emoji from ISO 3166-1 alpha-2 country code
export function getFlagEmoji(alpha2) {
  if (!alpha2 || alpha2.length !== 2) return '🌍'; // Default globe emoji

  // Convert alpha2 to flag emoji using regional indicator symbols
  // Each letter is converted to its regional indicator symbol (U+1F1E6 to U+1F1FF)
  const codePoints = alpha2
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}
