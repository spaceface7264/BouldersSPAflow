/**
 * Google Tag Manager (GTM) Utilities
 * Provides helper functions for pushing ecommerce events to DataLayer
 * following GA4's standard ecommerce schema
 */

// Initialize DataLayer if it doesn't exist
window.dataLayer = window.dataLayer || [];

/**
 * Push an event to the DataLayer
 * @param {string} eventName - The name of the event
 * @param {object} eventData - The event data object
 */
function pushToDataLayer(eventName, eventData = {}) {
  if (!eventName) {
    console.warn('[GTM] Event name is required');
    return;
  }

  const event = {
    event: eventName,
    ...eventData
  };

  window.dataLayer.push(event);
  console.log('[GTM] Pushed event:', eventName, eventData);
}

/**
 * Format price from DKK to the format expected by GA4 (as number, not string)
 * @param {number} priceInDKK - Price in DKK
 * @returns {number} Price as a number
 */
function formatPrice(priceInDKK) {
  if (typeof priceInDKK === 'string') {
    // Remove currency symbols and commas, convert to number
    return parseFloat(priceInDKK.replace(/[^\d.-]/g, '')) || 0;
  }
  return priceInDKK || 0;
}

/**
 * Format product data for GA4 ecommerce events
 * @param {object} product - Product object from cart/state
 * @returns {object} Formatted product data
 */
function formatProductForGA4(product) {
  return {
    item_id: String(product.id || product.productId || ''),
    item_name: product.name || '',
    price: formatPrice(product.amount || product.price || 0),
    quantity: product.quantity || 1,
    item_category: product.type || 'membership', // membership, punch-card, addon
  };
}

/**
 * Track select_item event (when a product is selected)
 * GA4 Event: select_item
 * @param {object} product - The selected product
 * @param {string} itemListId - Optional: The list ID (e.g., 'membership', 'punch-card')
 * @param {string} itemListName - Optional: The list name
 */
function trackSelectItem(product, itemListId = null, itemListName = null) {
  if (!product) {
    console.warn('[GTM] select_item: Product is required');
    return;
  }

  const ecommerceData = {
    ecommerce: {
      items: [formatProductForGA4(product)]
    }
  };

  if (itemListId) {
    ecommerceData.ecommerce.items[0].item_list_id = itemListId;
  }
  if (itemListName) {
    ecommerceData.ecommerce.items[0].item_list_name = itemListName;
  }

  pushToDataLayer('select_item', ecommerceData);
}

/**
 * Track add_to_cart event (when items are added to cart)
 * GA4 Event: add_to_cart
 * @param {Array<object>} items - Array of cart items
 * @param {number} value - Total cart value
 * @param {string} currency - Currency code (default: 'DKK')
 */
function trackAddToCart(items = [], value = 0, currency = 'DKK') {
  if (!Array.isArray(items) || items.length === 0) {
    console.warn('[GTM] add_to_cart: Items array is required');
    return;
  }

  const formattedItems = items.map(item => formatProductForGA4(item));

  pushToDataLayer('add_to_cart', {
    ecommerce: {
      currency: currency,
      value: formatPrice(value),
      items: formattedItems
    }
  });
}

/**
 * Track begin_checkout event (when checkout process starts)
 * GA4 Event: begin_checkout
 * @param {Array<object>} items - Array of cart items
 * @param {number} value - Total cart value
 * @param {string} currency - Currency code (default: 'DKK')
 */
function trackBeginCheckout(items = [], value = 0, currency = 'DKK') {
  if (!Array.isArray(items) || items.length === 0) {
    console.warn('[GTM] begin_checkout: Items array is required');
    return;
  }

  const formattedItems = items.map(item => formatProductForGA4(item));

  pushToDataLayer('begin_checkout', {
    ecommerce: {
      currency: currency,
      value: formatPrice(value),
      items: formattedItems
    }
  });
}

/**
 * Track purchase event (when order is completed)
 * GA4 Event: purchase
 * @param {string} transactionId - Order/transaction ID
 * @param {Array<object>} items - Array of purchased items
 * @param {number} value - Total purchase value
 * @param {number} tax - Tax amount (optional)
 * @param {number} shipping - Shipping amount (optional)
 * @param {string} currency - Currency code (default: 'DKK')
 */
function trackPurchase(transactionId, items = [], value = 0, tax = 0, shipping = 0, currency = 'DKK') {
  if (!transactionId) {
    console.warn('[GTM] purchase: Transaction ID is required');
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.warn('[GTM] purchase: Items array is required');
    return;
  }

  const formattedItems = items.map(item => formatProductForGA4(item));

  pushToDataLayer('purchase', {
    ecommerce: {
      transaction_id: String(transactionId),
      value: formatPrice(value),
      tax: formatPrice(tax),
      shipping: formatPrice(shipping),
      currency: currency,
      items: formattedItems
    }
  });
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pushToDataLayer,
    trackSelectItem,
    trackAddToCart,
    trackBeginCheckout,
    trackPurchase,
    formatProductForGA4,
    formatPrice
  };
}

// Make functions available globally
window.GTM = {
  pushToDataLayer,
  trackSelectItem,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  formatProductForGA4,
  formatPrice
};
