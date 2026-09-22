# Design System — Web Note (Notion/Linear Minimalist)

## 0. Research Log
- Layer A: `minimalist-skill.md` (Notion/Linear aesthetic)
- Layer B: `notion.md` + `linear.app.md` (token references)
- Perfection: `perfection/README.md` (Lighthouse 100, real-browser QA)
- UI-UX-DB: searched for "minimal note app typography spacing" → system font stack, 1.7 line-height, 4px base unit

---

## 1. Color Tokens (CSS Variables)

### Light Mode
```css
:root {
  --bg: 255 255 255;           /* #ffffff - pure white */
  --bg-elevated: 250 250 250;  /* #fafafa - sidebar, cards */
  --bg-hover: 245 245 245;     /* #f5f5f5 - hover states */
  --fg: 26 26 26;              /* #1a1a1a - near black */
  --fg-muted: 115 115 115;     /* #737373 - secondary text */
  --fg-subtle: 163 163 163;    /* #a3a3a3 - placeholder, disabled */
  --border: 229 229 229;       /* #e5e5e5 - hairline borders */
  --border-strong: 212 212 212;/* #d4d4d4 - focused borders */
  --primary: 37 99 235;        /* #2563eb - blue-600, restrained */
  --primary-hover: 29 78 216;  /* #1d4ed8 - blue-700 */
  --primary-fg: 255 255 255;   /* white */
  --ring: 37 99 235;           /* focus ring */
  --destructive: 220 38 38;    /* #dc2626 - red-600 */
  --destructive-fg: 255 255 255;
  --success: 22 163 74;        /* #16a34a - green-600 */
  --success-fg: 255 255 255;
}
```

### Dark Mode
```css
.dark {
  --bg: 26 26 26;              /* #1a1a1a - Notion dark, not pure black */
  --bg-elevated: 20 20 20;     /* #141414 - sidebar, cards */
  --bg-hover: 38 38 38;        /* #262626 - hover states */
  --fg: 250 250 250;           /* #fafafa - near white */
  --fg-muted: 163 163 163;     /* #a3a3a3 - secondary text */
  --fg-subtle: 115 115 115;    /* #737373 - placeholder, disabled */
  --border: 51 51 51;          /* #333333 - hairline borders */
  --border-strong: 68 68 68;   /* #444444 - focused borders */
  --primary: 59 130 246;       /* #3b82f6 - blue-500 */
  --primary-hover: 96 165 250; /* #60a5fa - blue-400 */
  --primary-fg: 26 26 26;      /* dark text on primary */
  --ring: 59 130 246;
  --destructive: 239 68 68;    /* #ef4444 - red-500 */
  --destructive-fg: 255 255 255;
  --success: 34 197 94;        /* #22c55e - green-500 */
  --success-fg: 26 26 26;
}
```

---

## 2. Typography

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --leading-tight: 1.4;
  --leading-normal: 1.6;
  --leading-relaxed: 1.75;  /* reading content */
}
```

---

## 3. Spacing & Radius

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
  --radius-sm: 0.375rem;  /* 6px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
}
```

---

## 4. Shadows (Restrained, Border-First)

```css
:root {
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.03);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.03);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.03);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.03);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.03);
}
.dark {
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.2);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.2);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.2);
}
```

---

## 5. Transitions & Motion

```css
:root {
  --transition-fast: 120ms ease-out;
  --transition-base: 150ms ease-out;
  --transition-slow: 200ms ease-out;
}
```

- All interactive elements: `transition-colors var(--transition-base)`
- Transform animations (expand/collapse): `transition-transform var(--transition-fast)`
- Reduced motion: `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }`

---

## 6. Component Primitives

### Buttons
| Variant | Light | Dark | Use Case |
|---------|-------|------|----------|
| Primary | bg-primary text-primary-fg hover:bg-primary-hover | bg-primary text-primary-fg hover:bg-primary-hover | Main CTAs |
| Secondary | bg-bg-elevated text-fg border border-border hover:bg-bg-hover | bg-bg-elevated text-fg border border-border hover:bg-bg-hover | Secondary actions |
| Ghost | transparent text-fg-muted hover:bg-bg-hover | transparent text-fg-muted hover:bg-bg-hover | Toolbar, subtle actions |
| Destructive | bg-destructive text-destructive-fg hover:bg-red-700 | bg-destructive text-destructive-fg hover:bg-red-600 | Dangerous actions |

- Padding: `px-3 py-1.5` (sm), `px-4 py-2` (md), `px-6 py-3` (lg)
- Radius: `var(--radius-md)` (8px)
- Focus: `focus-visible: outline-none ring-2 ring-ring ring-offset-2 ring-offset-bg`

### Inputs
- Base: `bg-bg border border-border text-fg placeholder-fg-subtle`
- Focus: `focus-visible: outline-none ring-2 ring-ring border-transparent`
- Radius: `var(--radius-md)`
- Padding: `px-3 py-2` (comfortable touch target)

### Cards / Panels
- Background: `bg-bg-elevated` (light) / `bg-bg-elevated` (dark)
- Border: `border border-border`
- Radius: `var(--radius-lg)` (12px)
- No shadow by default; shadow only for modals/dropdowns (`var(--shadow-lg)`)

### Sidebar (Left/Right)
- Background: `bg-bg-elevated`
- Border: `border-r border-border` (left) / `border-l border-border` (right)
- Selected item: `bg-primary/10 text-primary` with left accent bar `border-l-2 border-primary`

### Top Bar
- Height: 48px (3rem)
- Background: `bg-bg/80 backdrop-blur-sm` (subtle glass)
- Border: `border-b border-border`

---

## 7. Layout Constants

```css
:root {
  --topbar-h: 3rem;        /* 48px */
  --sidebar-w: 16rem;      /* 256px - left */
  --sidebar-w-collapsed: 3.5rem; /* 56px */
  --right-sidebar-w: 20rem; /* 320px */
  --mobile-drawer-w: 18rem; /* 288px */
  --bottom-nav-h: 3.5rem;  /* 56px */
  --content-max-w: 48rem;  /* 768px - reading width */
  --editor-max-w: 56rem;   /* 896px - editing width */
}
```

---

## 8. Accessibility Constraints

- **Contrast**: All text meets WCAG AA (4.5:1), large text 3:1
- **Focus Visible**: Every interactive element has `focus-visible` ring (2px, primary color, 2px offset)
- **Reduced Motion**: All transitions respect `prefers-reduced-motion`
- **Touch Targets**: Minimum 44×44px (achieved via padding)
- **Color Independence**: No information conveyed by color alone (icons + text + states)

---

## 9. Accepted Debt

- Tiptap editor prose styles (`prose` classes) use Tailwind Typography defaults — will need custom prose theme later for full token alignment
- Some emoji icons in RightSidebar tabs — should migrate to Lucide icons
- Mobile drawer animation uses CSS transform — could use View Transitions API for smoother UX
- Diagnostics page uses inline `DiagnosticCard` — should extract to shared component

---

## 10. Reference Fidelity

This design system targets **Notion/Linear visual parity**:
- Light: Near-white (#fff), subtle gray layering (#fafafa, #f5f5f5), hairline borders (#e5e5e5)
- Dark: #1a1a1a base, #141414 elevated, #262626 hover, #333333 borders
- Accent: Single restrained blue, used only for primary actions, links, selection
- Typography: System font stack, generous line-height (1.75 for reading)
- Motion: 150ms ease-out, purposeful only (state changes, not decoration)