# Payment Failed Page - Relevant CSS

This document highlights all CSS rules that affect the payment failed page UI.

## Key CSS Classes Used by Payment Failed Page

The payment failed page modifies these elements:
- `.confirmation-header` - Container for badge, title, and message
- `.success-badge` - Icon/badge (modified to show warning icon)
- `.success-title` - Title text (modified to show "Payment Couldn't Be Completed")
- `.success-message` - Message content (modified with HTML content)
- `.confirmation-layout` - Hidden when payment fails
- `.confirmation-left` - Hidden when payment fails
- `.confirmation-right` - Hidden when payment fails

---

## 1. Confirmation Header (Lines 6090-6093)

```css
.confirmation-header {
    text-align: center;
    margin-bottom: 40px;
}
```
**Used by:** Container for the success/failure badge, title, and message.

---

## 2. Success Badge (Lines 6095-6105)

```css
.success-badge {
    width: 80px;
    height: 80px;
    background-color: #10B981;  /* Green - changed to amber/orange in JS */
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    color: white;
}
```
**Used by:** Payment failed page replaces the SVG icon with a warning/info icon.
**Note:** The background color is green by default (success), but the payment failed page changes the icon color to `#f59e0b` (amber) via inline styles in JavaScript.

---

## 3. Success Title (Lines 6107-6114)

```css
.success-title {
    font-size: var(--font-size-5xl);
    font-weight: bold;
    color: #10B981;  /* Green - changed to #f59e0b in JS for failed state */
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 2px;
}
```
**Used by:** Payment failed page changes:
- Text content to "Payment Couldn't Be Completed"
- Color to `#f59e0b` (amber/orange) via inline style
- Removes `data-i18n-key` attribute to prevent i18n from resetting it

---

## 4. Success Message (Lines 6116-6122)

```css
.success-message {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
}
```
**Used by:** Payment failed page:
- Replaces content with HTML containing status, reassurance, and action buttons
- Sets inline styles: `color: #d1d5db`, `line-height: 1.6`, `white-space: normal`
- Removes `data-i18n-key` attribute

---

## 5. Payment Failed Hiding Rules (Lines 6124-6133) ⭐ CRITICAL

```css
/* Hide confirmation sections when payment fails or is pending */
.step-panel[data-payment-failed="true"] .confirmation-layout,
.step-panel[data-payment-pending="true"] .confirmation-layout,
.step-panel[data-payment-failed="true"] .confirmation-left,
.step-panel[data-payment-pending="true"] .confirmation-left,
.step-panel[data-payment-failed="true"] .confirmation-right,
.step-panel[data-payment-pending="true"] .confirmation-right {
  display: none !important;
  visibility: hidden !important;
}
```
**Purpose:** Hides order details, membership info, and "What happens next?" sections when payment fails.
**Trigger:** When `data-payment-failed="true"` is set on `.step-panel#step-5`.

---

## 6. Confirmation Layout (Lines 6135-6140)

```css
.confirmation-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 40px;
}
```
**Used by:** Hidden when payment fails (via rule #5 above).

---

## 7. Confirmation Left/Right Columns (Lines 6142-6152)

```css
.confirmation-left {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.confirmation-right {
    display: flex;
    flex-direction: column;
    gap: 24px;
}
```
**Used by:** Hidden when payment fails (via rule #5 above).

---

## 8. Responsive Styles - Tablet (Lines 6828-6840)

```css
@media (max-width: 1024px) {
    .confirmation-layout {
        grid-template-columns: 1fr;
        gap: 24px;
    }

    .success-title {
        font-size: var(--font-size-4xl);
    }

    .success-message {
        font-size: var(--font-size-md);
    }
}
```
**Affects:** Payment failed page message and title on tablets.

---

## 9. Responsive Styles - Mobile (Lines 6842-6857)

```css
@media (max-width: 768px) {
    .confirmation-header {
        margin-bottom: 30px;
    }

    .success-badge {
        width: 60px;
        height: 60px;
    }

    .success-title {
        font-size: var(--font-size-2xl);
    }

    .confirmation-card {
        padding: 20px;
    }
}
```
**Affects:** Payment failed page badge, title, and header spacing on mobile.

---

## Summary of Payment Failed Page Styling

### Elements Modified by JavaScript:
1. **`.success-badge`** - Icon changed to warning/info (color: `#f59e0b`)
2. **`.success-title`** - Text and color changed (color: `#f59e0b`)
3. **`.success-message`** - HTML content replaced with failure message and buttons

### Elements Hidden by CSS:
1. **`.confirmation-layout`** - Hidden via `data-payment-failed="true"` attribute
2. **`.confirmation-left`** - Hidden via `data-payment-failed="true"` attribute
3. **`.confirmation-right`** - Hidden via `data-payment-failed="true"` attribute

### Inline Styles Applied by JavaScript:
- Title color: `#f59e0b` (amber/orange)
- Message color: `#d1d5db` (light gray)
- Message line-height: `1.6`
- Message white-space: `normal`

---

## CSS Enhancement Opportunities

When enhancing the payment failed UI, consider:

1. **Add specific styles for failed state:**
   ```css
   .step-panel[data-payment-failed="true"] .success-badge {
       background-color: rgba(245, 158, 11, 0.1);
   }
   
   .step-panel[data-payment-failed="true"] .success-title {
       color: #f59e0b;
   }
   ```

2. **Style the action buttons in the message:**
   ```css
   #retry-payment-btn {
       /* Button styles */
   }
   
   #contact-support-btn {
       /* Button styles */
   }
   ```

3. **Add animations/transitions:**
   ```css
   .step-panel[data-payment-failed="true"] .confirmation-header {
       animation: fadeIn 0.3s ease-in;
   }
   ```
