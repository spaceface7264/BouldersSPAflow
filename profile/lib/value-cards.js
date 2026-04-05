export function collectValueCardsArray(customer) {
  if (!customer) return [];
  const raw = []
    .concat(customer.valueCards || [])
    .concat(customer.activeValueCards || [])
    .concat(customer.punchCards || [])
    .concat(customer.clipCards || [])
    .concat(customer.valueCardBalances || []);
  const seen = new Set();
  const out = [];
  raw.forEach((c) => {
    if (!c || typeof c !== 'object') return;
    const key = c.id != null ? `id:${c.id}` : `k:${out.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  });
  return out;
}

export function formatAddonExpiryDisplay(value) {
  if (!value) return '—';
  const str = typeof value === 'string' ? value : String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return str;
}

export function valueCardIsExpiredOrInvalid(card) {
  if (card?.isValid === false) return true;
  const v = card?.validUntil;
  if (!v || typeof v !== 'string') return false;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59`);
  return d < new Date();
}

export function formatValueCardRemainingLabel(card) {
  if (!card || typeof card !== 'object') return '—';
  const currency = 'DKK';
  if (card.allowNegativeUnits) {
    return 'Active (unlimited)';
  }
  if (valueCardIsExpiredOrInvalid(card)) {
    return 'Expired or inactive';
  }
  const t = String(card.type || '').toUpperCase();
  const isAmountType = t === 'AMOUT' || t === 'AMOUNT';
  if (isAmountType && card.amountLeft != null) {
    const n = Number(card.amountLeft);
    const formatted = Number.isFinite(n)
      ? new Intl.NumberFormat('da-DK', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(n)
      : String(card.amountLeft);
    return `${formatted} ${currency}`;
  }
  const units = card.unitsLeft;
  if (units != null) {
    let label = `${units} stk`;
    if (card.amountLeft != null && Number(card.amountLeft) > 0) {
      const n = Number(card.amountLeft);
      const formatted = Number.isFinite(n)
        ? new Intl.NumberFormat('da-DK', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(n)
        : String(card.amountLeft);
      label += ` (${formatted} ${currency})`;
    }
    return label;
  }
  if (card.isValid === true) return 'Active';
  return '—';
}

export function valueCardProductRef(card) {
  if (!card) return null;
  return card.validCardProduct || card.valueCardProduct || card.product || null;
}

export function valueCardProductId(card) {
  const p = valueCardProductRef(card);
  const raw =
    p?.id ??
    card?.validCardProductId ??
    card?.valueCardProductId ??
    card?.productId;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function valueCardProductDisplayName(card) {
  const p = valueCardProductRef(card);
  const tryName = (v) => (v != null && String(v).trim() ? String(v).trim() : '');
  let raw = tryName(p?.name) || tryName(p?.Name) || tryName(card?.name) || tryName(card?.Name);
  if (!raw && Array.isArray(card?.validForProducts)) {
    const names = card.validForProducts
      .map((x) => tryName(x?.name) || tryName(x?.Name))
      .filter(Boolean);
    if (names.length) raw = names.join(', ');
  }
  if (raw) return raw;
  const desc = tryName(p?.description) || tryName(card?.description);
  if (desc) {
    const line = desc.split(/\r?\n/)[0].trim();
    if (line) return line.length > 80 ? `${line.slice(0, 77)}…` : line;
  }
  return 'Product';
}
