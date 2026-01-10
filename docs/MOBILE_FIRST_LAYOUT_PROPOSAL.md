# Mobile-First Professional Layout Proposal

## Design Philosophy
- **Subtle Branding**: Logo is present but not dominant
- **Friendly & Approachable**: Generous spacing, soft edges, warm interactions
- **Professional Polish**: Clean typography, consistent spacing, refined details
- **Mobile-First**: Optimized for small screens, scales beautifully to desktop

## Layout Structure

### 1. Header (Subtle & Clean)
```
┌─────────────────────────────────────┐
│ [Logo]                              │  ← Small, top-left, subtle
│                                     │
└─────────────────────────────────────┘
```

**Key Features:**
- Logo: 32px height (desktop), 28px (mobile)
- Minimal padding: 16px vertical, 20px horizontal
- Subtle background: Transparent or very light overlay
- No heavy borders or shadows
- Optional: Subtle accent line at bottom (1px, low opacity)

### 2. Step Indicator (Clear Progress)
```
┌─────────────────────────────────────┐
│  ● ──── ○ ──── ○ ──── ○            │  ← Clean, minimal
└─────────────────────────────────────┘
```

**Key Features:**
- Compact height: 60px (mobile), 72px (desktop)
- Clear visual hierarchy
- Subtle animations on active step
- Good touch targets (44px minimum)

### 3. Content Area (Breathing Room)
```
┌─────────────────────────────────────┐
│                                     │
│     [Main Content]                  │  ← Generous padding
│                                     │
│     Max-width: 640px (mobile-first) │
│     Max-width: 800px (desktop)      │
│                                     │
└─────────────────────────────────────┘
```

**Key Features:**
- Mobile-first: 20px padding
- Desktop: 24px padding
- Max-width constraints prevent text from being too wide
- Generous vertical spacing between sections

### 4. Footer (Subtle & Informative)
```
┌─────────────────────────────────────┐
│  Contact | Legal                    │
│  © 2026 Boulders                    │
└─────────────────────────────────────┘
```

## Specific Recommendations

### Header Improvements
1. **Logo Size**: 32px (desktop), 28px (mobile)
2. **Header Height**: 56px (desktop), 48px (mobile)
3. **Background**: Transparent or rgba(0,0,0,0.02)
4. **Optional Accent**: Thin bottom border (1px, rgba(255,255,255,0.05))

### Spacing System
- **Mobile**: 16px base unit
- **Desktop**: 24px base unit
- **Sections**: 32px gap (mobile), 48px (desktop)
- **Cards**: 12px gap (mobile), 16px (desktop)

### Typography Hierarchy
- **Page Title**: 24px (mobile), 32px (desktop)
- **Section Headings**: 18px (mobile), 20px (desktop)
- **Body Text**: 16px (mobile), 16px (desktop)
- **Small Text**: 14px (mobile), 14px (desktop)

### Visual Polish
1. **Soft Shadows**: Subtle elevation (0 2px 8px rgba(0,0,0,0.08))
2. **Rounded Corners**: 12px for cards, 8px for buttons
3. **Gentle Transitions**: 0.2s ease for interactions
4. **Subtle Borders**: 1px, low opacity (rgba(255,255,255,0.1))

### Mobile-First Breakpoints
- **Mobile**: < 640px (default)
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Content Max-Widths
- **Mobile**: Full width minus padding
- **Tablet**: 640px max
- **Desktop**: 800px max (for readability)

## Implementation Priority

1. ✅ Logo positioned top-left (done)
2. ✅ Logo size reduced (done)
3. ⏭️ Refine header spacing and background
4. ⏭️ Optimize step indicator spacing
5. ⏭️ Improve content area padding and max-widths
6. ⏭️ Add subtle visual polish (shadows, borders)
7. ⏭️ Ensure consistent spacing system
