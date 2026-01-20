/**
 * XSS Protection Utility using DOMPurify
 *
 * This utility provides a simple wrapper around DOMPurify for sanitizing
 * HTML content before inserting it into the DOM via innerHTML.
 *
 * Usage:
 *   element.innerHTML = sanitizeHTML(untrustedContent);
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - The potentially unsafe HTML string
 * @param {object} config - Optional DOMPurify configuration
 * @returns {string} - Sanitized HTML safe for insertion
 */
export function sanitizeHTML(dirty, config = {}) {
  // Default config allows most HTML but removes scripts and event handlers
  // Note: 'style' attribute is NOT allowed to prevent CSS-based XSS attacks
  const defaultConfig = {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'tr', 'td', 'th',
      'thead', 'tbody', 'tfoot', 'pre', 'code', 'blockquote',
      // SVG tags for icons
      'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline',
      'g', 'use', 'defs', 'symbol', 'title', 'desc', 'text', 'tspan'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'href', 'src', 'alt', 'title',
      // SVG attributes
      'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width',
      'stroke-linecap', 'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'rx', 'ry',
      'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'xlink:href',
      'transform', 'preserveAspectRatio', 'xmlns', 'xmlns:xlink'
    ],
    KEEP_CONTENT: true, // Keep text content even if tags are removed
    ...config
  };

  return DOMPurify.sanitize(dirty, defaultConfig);
}

/**
 * Set text content safely (alternative to innerHTML for plain text)
 * This should be used when you just want to display text without HTML
 * @param {HTMLElement} element - The DOM element
 * @param {string} text - The text content
 */
export function setTextContent(element, text) {
  element.textContent = text;
}

// Make it available globally for legacy code
if (typeof window !== 'undefined') {
  window.sanitizeHTML = sanitizeHTML;
  window.setTextContent = setTextContent;
}
