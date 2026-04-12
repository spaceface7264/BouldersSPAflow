import { formatDisplayDate } from './display-format.js';

const CLASS_DATE_LOCALE = 'da-DK';

export function bookingStartIsoValue(b) {
  return (
    b?.duration?.start ||
    b?.startTime ||
    b?.startDateTime ||
    b?.dateTime ||
    b?.scheduledStart ||
    b?.date ||
    b?.start ||
    ''
  );
}

export function isBrpWaitingListBooking(b) {
  if (!b || typeof b !== 'object') return false;
  if (b.waitingListBooking != null && typeof b.waitingListBooking === 'object') return true;
  const t = b.type;
  if (typeof t === 'string') return /waiting/i.test(t);
  if (t && typeof t === 'object') {
    const inner = t.type || t.name || t.code || '';
    return String(inner).toLowerCase().includes('waiting');
  }
  return false;
}

export function brpBookingStartMs(b) {
  const s = b?.duration?.start;
  if (typeof s !== 'string') return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function brpBookingEndMs(b) {
  const s = b?.duration?.end;
  if (typeof s !== 'string') return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function formatDateTimeDisplay(iso) {
  if (!iso) return '—';
  if (typeof iso !== 'string') return formatDisplayDate(iso);
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return formatDisplayDate(iso);
  return d.toLocaleString(CLASS_DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTimeShort(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString(CLASS_DATE_LOCALE, { timeStyle: 'short' });
}

function formatClassDateNoYear(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(CLASS_DATE_LOCALE, {
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

function formatClassDateTimeNoYear(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const dateText = formatClassDateNoYear(iso);
  const timeText = formatTimeShort(iso);
  if (!timeText) return dateText;
  return `${dateText}, ${timeText}`;
}

export function formatClassSessionWhenLine(startIso, endIso) {
  if (!startIso) return '—';
  const startMs = Date.parse(startIso);
  const endMs = endIso ? Date.parse(endIso) : NaN;
  const hasValidEnd = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  if (!hasValidEnd) {
    return formatClassDateTimeNoYear(startIso);
  }
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  const sameLocalDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();
  if (sameLocalDay) {
    return `${formatClassDateTimeNoYear(startIso)} – ${formatTimeShort(endIso)}`;
  }
  return `${formatClassDateTimeNoYear(startIso)} – ${formatClassDateTimeNoYear(endIso)}`;
}

export function formatClassSessionDurationMinutes(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

export function formatGroupActivitySlotsAvailability(slots) {
  if (!slots || typeof slots !== 'object') return '';
  const leftRaw =
    slots.leftToBookIncDropin ?? slots.leftToBook ?? slots.available ?? slots.left;
  const left = leftRaw != null ? Number(leftRaw) : null;
  const totalRaw = slots.total ?? slots.totalBookable;
  const total = totalRaw != null ? Number(totalRaw) : null;
  const parts = [];
  if (left != null && Number.isFinite(left)) {
    if (left <= 0) {
      parts.push('Fully booked');
    } else if (total != null && Number.isFinite(total) && total > 0) {
      parts.push(`${left} of ${total} spots left`);
    } else if (left === 1) {
      parts.push('1 spot left');
    } else {
      parts.push(`${left} spots left`);
    }
  }
  const isFull = left != null && Number.isFinite(left) && left <= 0;
  if (slots.hasWaitingList === true && isFull) {
    const w = slots.inWaitingList;
    parts.push(
      w != null && Number.isFinite(Number(w)) ? `Waiting list: ${w}` : 'Waiting list open'
    );
  }
  return parts.join(' · ');
}

export function formatBookingCardAvailabilityLine(b) {
  if (!b || typeof b !== 'object') return '';
  if (b.checkedIn) {
    const t = typeof b.checkedIn === 'string' ? formatDateTimeDisplay(b.checkedIn) : '';
    return t && t !== '—' ? `Checked in · ${t}` : 'Checked in';
  }
  return '';
}

export function isDropInOnlyClass(activity) {
  const slots = activity?.slots;
  if (!slots || typeof slots !== 'object') return false;
  const leftToBook = Number(slots.leftToBook);
  const leftToBookIncDropin = Number(slots.leftToBookIncDropin);
  const reservedForDropin = Number(slots.reservedForDropin);
  const hasBookableExhausted = Number.isFinite(leftToBook) && leftToBook <= 0;
  const hasDropinCapacity =
    (Number.isFinite(leftToBookIncDropin) && leftToBookIncDropin > 0) ||
    (Number.isFinite(reservedForDropin) && reservedForDropin > 0);
  return hasBookableExhausted && hasDropinCapacity;
}

export function formatClassCardAvailabilityFromContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  const slotText = ctx.slots ? formatGroupActivitySlotsAvailability(ctx.slots) : '';
  if (slotText) return slotText;
  if (ctx.booking) return formatBookingCardAvailabilityLine(ctx.booking);
  return '';
}

export function isBrowseSlotsFullyBooked(slots) {
  if (!slots || typeof slots !== 'object') return false;
  const leftRaw =
    slots.leftToBookIncDropin ?? slots.leftToBook ?? slots.available ?? slots.left;
  if (leftRaw == null) return false;
  const n = Number(leftRaw);
  return Number.isFinite(n) && n <= 0;
}

export function isLikelySeriesSession(activity) {
  if (!activity || typeof activity !== 'object') return false;
  if (activity.event || activity.eventProduct || activity.eventProductId) return true;
  const ext = String(activity.externalMessage || '').toLowerCase();
  if (!ext) return false;
  return (
    ext.includes('opsummering af dato og tider') ||
    ext.includes('summary of dates and times') ||
    ext.includes('multi-session')
  );
}

const SERIES_COPY_HINTS = [
  'opsummering af dato og tider',
  'summary of dates and times',
  'multi-session',
  'attend all sessions in the series',
];

export function hasSeriesCopyHint(text) {
  const v = String(text || '').toLowerCase();
  if (!v) return false;
  return SERIES_COPY_HINTS.some((hint) => v.includes(hint));
}
