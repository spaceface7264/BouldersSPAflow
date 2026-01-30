# Add-ons Modal - Minimalist Layout Implementation Guide

## Overview
Clean, info-focused modal for membership add-ons during signup flow. Features expandable rows with image lightbox.

## Design Principles
- **Minimal visual weight** - no large images stealing focus
- **Progressive disclosure** - expand for details on demand
- **Fast loading** - small thumbnails (64px)
- **Click thumbnails** - opens full-size lightbox overlay
- **Mobile-first** - works seamlessly on all devices

## Layout Structure

### Modal Dimensions
- Max width: `700px`
- Max height: `85vh`
- Modal sheet: dark glass effect with backdrop blur

### Card Layout (Minimalist List)
Each card is a horizontal row with:
1. **Left**: 64x64px image thumbnail (clickable → lightbox)
2. **Center**: Title + short description
3. **Right**: Price + expand button
4. **Expandable section**: Features list + Add to Cart button

```
[Thumbnail] [Title               ] [99 kr/mo] [▼]
            [Description         ]
──────────────────────────────────────────────────
            [✓ Feature 1         ]
            [✓ Feature 2         ]
            [Add to Cart Button  ]
```

## Component Breakdown

### 1. Card Main Row
```css
display: flex
padding: 16px 20px
gap: 16px
align-items: center
border: 2px solid item-border
border-radius: 12px
cursor: pointer
```

**States:**
- Hover: border → brand-accent, subtle glow
- Selected: border → brand-accent, background tint

### 2. Thumbnail (64x64px)
```css
width: 64px
height: 64px
border-radius: 10px
border: 2px solid item-border
object-fit: cover
cursor: pointer
```

**Behavior:**
- Click → opens full-size lightbox
- Hover → scale(1.05), border → brand-accent
- Stop propagation (don't trigger card selection)

### 3. Content Area
**Title:**
- Font: 1.125rem (18px), weight 700
- Color: text-secondary
- Margin bottom: 4px

**Description:**
- Font: 0.875rem (14px)
- Color: text-muted
- Line height: 1.4

### 4. Price Box
```css
text-align: right
display: flex
flex-direction: column
```

**Amount:** 1.5rem (24px), bold, brand-accent color  
**Unit:** 0.875rem (14px), text-muted color

### 5. Expand Button
```css
width: 32px
height: 32px
border: 1px solid item-border
border-radius: 6px
background: transparent
```

**States:**
- Default: ▼ symbol
- Expanded: rotate 180deg
- Hover: background → item-border, color → brand-accent

### 6. Expandable Details Section
```css
max-height: 0 (collapsed)
max-height: 300px (expanded)
transition: max-height 0.3s ease
overflow: hidden
```

**Content:**
- Border top: 1px solid item-border
- Padding: 16px 20px
- Features: list with checkmarks (✓)
- Add to Cart button: full width

### 7. Features List
```css
list-style: none
margin-bottom: 16px
```

**Each item:**
- Padding left: 20px (space for checkmark)
- Position relative
- Font: 0.875rem (14px)
- Color: text-muted

**Checkmark (::before):**
- Content: "✓"
- Position: absolute left 0
- Color: brand-accent
- Font weight: bold

### 8. Add to Cart Button
```css
width: 100%
padding: 10px
background: brand-accent
border-radius: 8px
font-size: 0.875rem (14px)
font-weight: 600
```

**States:**
- Hover: background → brand-accent-hover
- Selected card: background → success color
- Text changes: "Add to Cart" → "Remove"

## Image Lightbox

### Structure
Fixed overlay above modal (z-index: 2000)

```css
position: fixed
inset: 0
background: rgba(0, 0, 0, 0.9)
backdrop-filter: blur(8px)
display: flex (when active)
align-items: center
justify-content: center
cursor: pointer
```

### Lightbox Image
```css
max-width: 90vw
max-height: 90vh
object-fit: contain
border-radius: 12px
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5)
```

### Close Button
Position: absolute top 20px, right 20px  
Size: 40x40px  
Glass effect: white 10% opacity, backdrop blur  
Symbol: ×

**Close triggers:**
- Click anywhere on lightbox background
- Click close button
- Press ESC key

## JavaScript Behaviors

### Card Interaction
```javascript
// Click card main → toggle selected state
// Click thumbnail → open lightbox (stop propagation)
// Click expand button → toggle expanded class
// Click Add to Cart → toggle selected + update button text
```

### Lightbox
```javascript
function openLightbox(imageSrc) {
  lightboxImage.src = imageSrc
  lightbox.classList.add('active')
}

function closeLightbox() {
  lightbox.classList.remove('active')
}

// ESC key listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox()
})
```

## Mobile Responsive (@max-width: 768px)

### Card Changes:
- Flex wrap enabled
- Image thumbnail: 40x40px
- Right section (price + expand): full width row
- Features: single column (not 2-col grid)

### Actions Footer:
- Stack vertically
- Buttons: full width, equal flex

## Color Variables
```css
--color-brand-accent: #ec4899 (magenta)
--color-brand-accent-hover: #db2777
--color-success: #10b981 (green)
--color-text-secondary: #e5e7eb
--color-text-muted: #9ca3af
--color-surface-dark: #1f2937
--color-item-border: #374151
```

## Key Implementation Notes

1. **Thumbnail images:** Load 64x64px WebP for thumbnails, 800x800px for lightbox
2. **Expand animation:** Use `max-height` transition (not height for smoother)
3. **Event propagation:** Stop propagation on thumbnail click and expand button
4. **Selected state:** Track selected addons, update button text accordingly
5. **Accessibility:** ESC closes lightbox, focus management for keyboard nav
6. **Touch targets:** Minimum 44px touch targets on mobile (expand btn is 32px on desktop)

## Implementation Readiness

**Overall: ready for implementation.** Gaps below are filled with concrete specs. Design and behavior are clear; a few concrete specs will unblock implementation.

### Ready
- Layout concept (horizontal row + expandable section) and dimensions (700px, 85vh, 64px thumb).
- Component styling (padding, borders, typography, states).
- Lightbox behavior and z-index (2000 above modal 1000).
- Mobile breakpoint (768px) and thumbnail size change (40px).
- Color variables (align with existing `:root` in styles.css; doc uses #ec4899, codebase may use #F0F – confirm).
- High-level JS (toggle selected, expand, lightbox open/close, ESC).

### Implementation spec (gaps filled)

1. **DOM / template structure**  
   Current template is vertical (image on top, then plan-info, features, button). Redesign needs a concrete markup, e.g.:
   - Card: wrapper with `.addon-card` (or keep), inner “main row” (thumb + content + price + expand button), then expandable block (features + Add to Cart).
   - Class names for: main row, thumbnail wrapper, expand toggle button, expandable details container.
   - Keep existing `data-element="name"`, `data-element="description"`, etc. so `populateBoostModal` / `populateAddonsModal` can stay, or list new selectors.

2. **Expandable section height**  
   Expanded: `max-height: 400px`; `overflow-y: auto` so long lists scroll. Transition: `max-height 0.3s ease`.

3. **Lightbox DOM placement**  
   Single `.addon-lightbox` appended to `document.body`, toggled via `.addon-lightbox--active` (or `.active`). Inner: wrapper (flex center), img with class `addon-lightbox-img`, close button `.addon-lightbox-close`. Default `display: none`, active `display: flex`.

4. **Images**  
   Use same product image URL for thumb and lightbox. Thumb: CSS 64×64 (40×40 @768px), `object-fit: cover`. Lightbox: same URL, `max-width: 90vw; max-height: 90vh; object-fit: contain`.

5. **Discount / banner**  
   List row: show original price (strikethrough) when present. Omit image banner in list view; optional in lightbox caption.

6. **Button copy**  
   App uses `button.added` (e.g. “Tilføjet!”) when selected. Doc says “Remove.” Decide: keep “Added!” or add `button.remove` and use “Remove” when selected.

7. **Accessibility**  
   Lightbox: focus close button on open; trap focus; return focus to thumbnail on close; ESC closes. Expand: `aria-expanded` and `aria-controls` on expand button; `hidden` on `.addon-card-details` when collapsed.

8. **Touch targets**  
   @media (max-width: 768px): `.addon-card-expand` gets `min-width: 44px; min-height: 44px`.


## Final Notes
- Clean, fast-loading design prioritizes content over imagery
- Expandable details reduce initial cognitive load
- Lightbox provides full image context on demand
- Layout scales perfectly from mobile to desktop
- Works with existing Boulders brand colors (magenta accent)