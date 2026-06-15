/**
 * TikTok Pixel utilities for conversion tracking.
 * Base pixel loader lives in index.html; this module fires purchase events.
 */

function formatPrice(price) {
  if (typeof price === 'string') {
    return parseFloat(price.replace(/[^\d.-]/g, '')) || 0;
  }
  return price || 0;
}

function formatContents(items = []) {
  return items.map((item) => ({
    content_id: String(item.id || item.productId || item.name || '15daypass'),
    content_type: 'product',
    content_name: item.name || '15-Day Trial Pass',
    quantity: item.quantity || 1,
    price: formatPrice(item.amount || item.price || 0),
  }));
}

const trackedPurchaseIds = new Set();

/**
 * Track a TikTok-attributed 15-day pass purchase (TikTok standard event: CompletePayment).
 * Only intended for paid orders that used the TIKTOK coupon.
 * @param {string} transactionId - Order/transaction ID
 * @param {Array<object>} items - Purchased items
 * @param {number} value - Total purchase value
 * @param {string} currency - Currency code (default: DKK)
 */
function trackCompletePayment(transactionId, items = [], value = 0, currency = 'DKK') {
  if (!transactionId) {
    console.warn('[TikTok] CompletePayment: transaction ID is required');
    return;
  }

  const txKey = String(transactionId);
  if (trackedPurchaseIds.has(txKey)) {
    return;
  }

  if (typeof window.ttq === 'undefined' || typeof window.ttq.track !== 'function') {
    console.warn('[TikTok] CompletePayment: ttq not available');
    return;
  }

  const numericValue = formatPrice(value);
  const contents = formatContents(items);
  const payload = {
    content_type: 'product',
    currency,
    value: numericValue,
    order_id: txKey,
    event_id: `tiktok_${txKey}`,
    contents: contents.length > 0
      ? contents
      : [{
          content_id: '15daypass',
          content_type: 'product',
          content_name: '15-Day Trial Pass',
          quantity: 1,
          price: numericValue,
        }],
  };

  window.ttq.track('CompletePayment', payload);
  trackedPurchaseIds.add(txKey);
  console.log('[TikTok] CompletePayment tracked:', txKey, payload);
}

window.TikTok = {
  trackCompletePayment,
  formatContents,
  formatPrice,
};
