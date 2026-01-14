# Boost Modal Implementation

## Overview

The Boost Modal is a modal dialog that appears when a user selects a product with the "Boost" label. It displays products that have the "boostProduct" label as upsell/add-on options.

## How It Works

### 1. Product Selection Trigger

When a user selects a product (membership, campaign, or 15-day pass) on Step 2 (Access selection), the system checks if the selected product has a "Boost" label:

```javascript
// Check if product has boost label - if so, show modal instead of auto-advancing
if (product && hasBoostLabel(product)) {
  showBoostModal();
} else {
  nextStep(); // Normal flow
}
```

### 2. Product Scanning

The boost modal searches for products with the "boostProduct" label from the following sources:

#### Products Scanned (42 products in your case):

1. **Subscriptions** (`/api/products/subscriptions?businessUnit={id}`)
   - Filtered by the selected business unit (gym)
   - Backend returns subscriptions available for that specific gym
   - Includes: memberships, campaigns, 15-day passes, etc.

2. **Value Cards** (`/api/products/valuecards`)
   - **NOT filtered by business unit** (no query parameter)
   - Backend returns ALL value cards globally
   - These are punch cards available at all gyms

3. **Raw Products** (before filtering)
   - Also checks `state.allRawProducts` which contains products before they're filtered by display rules
   - This ensures boost products aren't missed if they're filtered out (e.g., missing "Public" label)

### 3. Why These Products?

The products scanned are determined by:

- **Backend API responses**: When a gym is selected, the frontend fetches subscriptions and value cards
- **Business unit filtering**: Subscriptions are filtered by the selected gym (`businessUnit` query parameter)
- **Global products**: Value cards are global and not filtered by gym
- **Product associations**: Backend database determines which products belong to which business units

### 4. Label Matching

Products are identified as boost products if they have a "boostProduct" label (case-insensitive):

```javascript
product.productLabels.some(
  label => label.name && label.name.toLowerCase() === 'boostproduct'
)
```

### 5. Modal Display

Once boost products are found:
- Modal title: "Boost your membership"
- Products are rendered using the addon card template
- Cards are made visible (opacity: 1, visibility: visible)
- Users can select/deselect boost products
- "Skip" button allows users to proceed without selecting

## Code Flow

```
User selects product with "Boost" label
    ↓
hasBoostLabel(product) returns true
    ↓
showBoostModal() called
    ↓
loadBoostProducts() (if not already loaded)
    ↓
Scans: subscriptions + value cards + raw products
    ↓
Filters products with "boostProduct" label
    ↓
populateBoostModal() renders products
    ↓
Modal displayed with boost products
```

## Key Functions

- `hasBoostLabel(product)` - Checks if product has "Boost" label
- `loadBoostProducts()` - Loads and filters products with "boostProduct" label
- `populateBoostModal()` - Renders boost products in the modal
- `showBoostModal()` - Shows the modal with boost products

## State Management

- `state.boostProducts` - Array of products with "boostProduct" label
- `state.allRawProducts` - All products before filtering (for boost product detection)
- `state.selectedProduct` - Currently selected product (checked for "Boost" label)

## Backend Dependencies

The boost modal relies on:

1. **Product Labels**: Products must have the "boostProduct" label in their `productLabels` array
2. **API Endpoints**:
   - `/api/products/subscriptions?businessUnit={id}` - Returns subscriptions for a gym
   - `/api/products/valuecards` - Returns all value cards (global)
   - `/api/products?businessUnit={id}` - Optional endpoint for additional products (currently returns 404)

## Notes

- Boost products are checked from **all loaded products**, not just displayed ones
- This ensures boost products aren't missed if they're filtered out by display rules
- The modal uses the same infrastructure as the addons modal
- Products are deduplicated by ID before being displayed
