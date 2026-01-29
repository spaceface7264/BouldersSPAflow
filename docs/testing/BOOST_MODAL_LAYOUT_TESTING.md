# Boost / Addons Modal – Cross-Device & Browser Testing

Use this checklist to confirm the boost/addons modal layout works as expected across devices and browsers.

## What We Rely On

- **Viewport**: `width=device-width, initial-scale=1.0, viewport-fit=cover` for correct sizing and safe areas on notched devices.
- **Safe area**: `env(safe-area-inset-*)` on the modal overlay so content stays inside the notch/home-indicator area.
- **Flex chain**: Overlay → sheet → content → main → grid use `min-height: 0` and `flex: 1 1 auto` so the grid scrolls correctly (especially in Safari).
- **Cards**: `.addon-card-body` wraps description + features; cards grow to fit all text (no in-card scroll).
- **Fallbacks**: `max-height: 84vh` and `width: 94vw` before `min()` so older browsers still get sensible layout.

## Devices to Test

| Device type        | Notes                                      |
|--------------------|--------------------------------------------|
| iPhone (notched)   | Safe area, viewport-fit=cover, scroll      |
| Android phone      | Small viewport, touch scroll               |
| iPad / tablet      | 640px+ grid (multi-column), scroll         |
| Desktop            | Multi-column grid, mouse, keyboard         |

## Browsers to Test

| Browser           | Notes                                      |
|-------------------|--------------------------------------------|
| Safari (iOS)      | Flex min-height, -webkit-overflow-scrolling |
| Chrome (Android)  | Touch scroll, viewport                      |
| Chrome (desktop)  | Mouse, keyboard, resize                    |
| Firefox           | Scroll, backdrop-filter                    |
| Safari (macOS)    | Backdrop, scroll                           |
| Edge              | General layout                             |

## Layout Checklist

- [ ] **Open modal**  
  Trigger boost flow (e.g. select a product with Boost label). Modal opens centered, overlay dims background.

- [ ] **Sheet size**  
  Sheet fits viewport (no horizontal overflow). On small screens ~95vw width; on large screens capped at 1000px. Height never exceeds viewport (max-height fallback).

- [ ] **Safe area (notched phones)**  
  On iPhone X+ or similar: modal content (and close button) stay inside safe area; no content under notch or home indicator.

- [ ] **Single column (narrow)**  
  At &lt;640px: one column, cards stack. Grid scrolls vertically when there are many or long cards.

- [ ] **Multi-column (wide)**  
  At ≥640px: grid uses `repeat(auto-fit, minmax(280px, 1fr))`. Multiple cards per row when space allows.

- [ ] **Card content**  
  Each card shows image (or placeholder), title, description, features, price, “Add to cart”. **Full description and feature list visible** (no text cut off; card grows to fit).

- [ ] **Long description**  
  Use a product with long description (e.g. Kaffekort with full coffee list). Entire text is visible without scrolling inside the card; grid scrolls if needed.

- [ ] **Images**  
  Product images respect `max-height` by breakpoint (e.g. 280px base, 320px at 640px, 400px at 1024px, 240px at 768px, 200px at 380px). No broken aspect ratio or overflow.

- [ ] **Footer**  
  Hint text and Skip / Continue (or Close) stay visible at bottom of sheet. Not covered by keyboard or overlapping content.

## Interaction Checklist

- [ ] **Scroll grid**  
  With 2+ cards or long content, grid scrolls smoothly (momentum on iOS with `-webkit-overflow-scrolling: touch`). No scroll on body while modal is open (`body.modal-open`).

- [ ] **Close**  
  Close (X) works. Focus and scroll position are reasonable after close.

- [ ] **Add to cart**  
  “Add to cart” on a card adds product; button state updates (e.g. “Added”). Card click (outside button) toggles addon as expected.

- [ ] **Skip / Continue**  
  Skip and Continue behave correctly and close or advance the flow as designed.

## Quick Regression (One Device)

1. Open boost modal.
2. Confirm two cards (or more) visible, no horizontal overflow.
3. Confirm **full description text** on the longer card (e.g. Kaffekort) – nothing cut off.
4. Scroll grid if needed; close modal.

## If Something Fails

- **Text cut off in card**  
  Check that template has `.addon-card-body` wrapping plan-info + plan-features and that `.addon-card .addon-card-body` has `flex: 0 0 auto` (no max-height/overflow on card).

- **Grid doesn’t scroll**  
  Check flex chain (content, main, grid) has `min-height: 0` and grid has `overflow-y: auto`. Check for `overflow: hidden` on a parent that shouldn’t clip.

- **Modal under notch / home indicator**  
  Confirm viewport has `viewport-fit=cover` and overlay uses `env(safe-area-inset-*)`.

- **Weird layout in one browser**  
  Check for missing fallbacks (e.g. `max-height: 84vh` before `min()`), and that no global `.plan-card` rule is overriding addon card layout.

## Reference

- Implementation: [BOOST_MODAL_IMPLEMENTATION.md](../implementation/BOOST_MODAL_IMPLEMENTATION.md)
- Addons modal uses the same markup and styles as the boost modal (shared `.addons-*` / `.addon-card` classes).
