export function formatDisplayDate(value) {
  if (!value) return '-';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return value;
  }
  return String(value);
}

export function formatCountryLabel(country) {
  if (country == null || country === '') return '-';
  if (typeof country === 'string') {
    const t = country.trim();
    return t || '-';
  }
  if (typeof country === 'object') {
    const n = country.name || country.countryName;
    if (n) return String(n);
    const a2 = country.alpha2 || country.code;
    if (a2) return String(a2);
    return '-';
  }
  return '-';
}

/**
 * @param {unknown} price — major-units number, pre-formatted string, or "-"
 * @param {string} [currencyCode='DKK'] — when price is a finite number
 */
export function formatPriceDisplay(price, currencyCode = 'DKK') {
  if (price == null || price === '' || price === '-') return '—';
  if (typeof price === 'number') {
    if (!Number.isFinite(price)) return '—';
    const code = String(currencyCode || 'DKK').trim().toUpperCase() || 'DKK';
    try {
      return new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      return `${price.toFixed(2).replace('.', ',')} kr.`;
    }
  }
  const s = String(price);
  if (/kr|€|\$|[\d.,]+\s*[^\s]+$/i.test(s)) return s;
  if (/^\d+([.,]\d+)?$/.test(s)) {
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n)) {
      return formatPriceDisplay(n, currencyCode);
    }
  }
  return s;
}

/** BRP CustomerOut AddressOut (and similar) → display rows */
export function buildAddressFromBrpAddressOut(addr) {
  if (!addr || typeof addr !== 'object') return null;
  const street = (addr.street || addr.streetAddress || addr.line1 || '').trim();
  const cityName = (addr.city || '').trim();
  const pc =
    addr.postalCode != null && addr.postalCode !== ''
      ? String(addr.postalCode).trim()
      : (addr.zip || addr.postCode || '').toString().trim();
  const cityLine = [pc, cityName].filter(Boolean).join(' ').trim();
  let country = formatCountryLabel(addr.country);
  if (country === '-') {
    country = formatCountryLabel(addr.countryCode);
  }
  const has = Boolean(street || cityLine || (country && country !== '-'));
  if (!has) return null;
  return {
    street: street || '-',
    city: cityLine || '-',
    country: country && country !== '-' ? country : '-',
  };
}
