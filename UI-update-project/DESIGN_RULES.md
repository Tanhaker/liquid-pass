# DESIGN_RULES.md — LiquidPass Frontend

Read this file in full before generating or modifying any UI. These rules override your default styling instincts. If a request conflicts with this file, follow this file and flag the conflict.

---

## 0. Scope reminder
UI only. The Stylus contract at `0xe67078be99dec98b9788a0e6c2054d03b361f84` is already deployed and tested — do not modify contract code, ABI, or redeploy anything. Wire the frontend to existing functions only.

---

## 1. Non-negotiable: do not look AI-generated

This is the top priority of every screen you build. Before shipping any component, check it against this list:

**Never do:**
- Centered hero: giant bold headline + subheadline + two pill buttons + soft gradient blob. This is the single most recognizable "AI slop" pattern — do not use this composition.
- Purple-to-blue gradients on dark backgrounds.
- Generic 3-icon feature grids using default lucide-react icons with no visual hierarchy between them.
- Identical card styling (same padding/shadow/radius) applied uniformly regardless of content importance.
- Untouched shadcn defaults. shadcn is allowed as structural scaffolding only — restyle spacing, type scale, and color so it doesn't read as default.
- Uniform section padding that makes the page feel like slides in a template deck.
- Emoji used as functional icons.

**Always do:**
- Make at least one layout choice per page that breaks the standard centered-container pattern (asymmetry, offset grid, unconventional composition).
- Tie every visual decision back to the product concept: passes are **time decaying assets**. If a design choice doesn't reinforce that, reconsider it.
- It's fine to look a little rough/unfinished in places ("vibe coded" is acceptable). It is NOT fine to look templated or swappable with a generic Web3 hackathon project.

---

## 2. Color palette — locked, do not substitute

Use exactly these core semantic colors across the protocol:

| Role | Dark Theme | Light Theme | Notes |
|---|---|---|---|
| Primary accent (Uranium green) | `#98FF1A` | `#6BBF00` | CTAs, active states, "fresh/valid pass" indicator |
| High-contrast accent text | `#98FF1A` | `#3E7A00` | Readable accent text on light backgrounds |
| Warning / Mid-decay (Aviation) | `#FF9F1C` | `#9A5C00` | Warning, "expiring soon", WCAG AA compliant (>4.5:1 on light) |
| Danger / Fire sale | `#F87171` | `#C4342A` | Critical expiry, loss, strikethrough |
| Status info | `#7B92FF` | `#2D6FC4` | Protocol metrics, verification states |
| Base page background | `#08090C` | `#EDEDE8` | Deep void on dark; warm technical paper on light |
| Card surface | `#11141A` | `#F7F7F3` | Primary cards, raised modules |
| Panel nested surface | `#161A22` | `#DFDFD8` | Recessed telemetry bays, input boxes |
| Default border | `#232936` | `#C7C7BE` | 1px technical divider lines |
| Strong border | `#323A4C` | `#B0B0A5` | Emphasized card outlines, active HUD borders |
| Primary text | `#F2F4F7` | `#141412` | Main headlines, key metrics |
| Secondary text | `#8E95A1` | `#5A5A52` | Subheadlines, descriptors, readable labels |
| Tertiary text | `#667085` | `#8A8A80` | Subtle metadata, timestamps |

---

## 3. Aesthetic direction: grunge + futuristic

This is a specific, unusual pairing — lean into the tension between the two rather than smoothing it into generic "modern dark UI."

**Grunge elements:**
- Textured/noisy surfaces instead of flat fills — subtle grain, paper-like or scanned texture on background sections (CSS noise overlay via isolated `::before` pseudo-elements).
- Slightly imperfect edges: torn/rough-edge dividers instead of clean straight lines in at least one section.
- Stamped / distressed physical ticket notches (`.ticket-edge`) on pass cards.
- Off-kilter rotation on cards/badges (a few degrees, not enough to hurt readability) rather than everything perfectly grid-aligned.
- Hand-marked feel for small accents (underlines, ticks, badge shapes) — think stamped/stenciled rather than vector-perfect.

**Futuristic elements:**
- Sharp, technical typography for data/numbers (monospace or a geometric sans) contrasted against a more expressive display face for headlines.
- Glow/emissive treatment on the primary accent color (`#98FF1A` / `#B4FF39`) for active/live states — this is what sells "futuristic" against the grunge texture.
- Scanline micro-interactions reserved for state transitions (e.g., a pass expiring, a transaction confirming) — use sparingly, it should punctuate not decorate.
- Data-forward UI chrome: exposed technical details (token IDs, block numbers, tx hashes) styled deliberately rather than hidden, framed like a HUD/terminal readout.

The combination should read as: a weathered, real physical object (the pass) inside a precise, technical system (the chain). Don't let one side win completely — a fully clean futuristic UI or a fully distressed grunge UI both miss the brief.

---

## 4. Typography

- Headline face: **Cabinet Grotesk** (bold, punchy, industrial display weight).
- Body / UI face: **General Sans** (clean, high-legibility geometric sans).
- Monospace face: System monospace / monospace HUD font for numbers, prices, timestamps, token IDs, and contract addresses.

---

## 5. Motion — Framer Motion + Three.js Hero Surface

- **Framer Motion**: Component-level animations, staggered row reveals, value recovery duel transitions, interactive card hover tilts, and unlock flows.
- **3D Hero Surface Mesh**: Theme-aware interactive particle wave (`components/ui/dotted-surface.tsx`).
  - Rendered with Three.js using `powerPreference: 'low-power'` and capped DPR $\le 2$.
  - Must automatically pause its animation loop (`cancelAnimationFrame`) when scrolled out of view or tab is backgrounded (`IntersectionObserver` + `visibilitychange`).
  - Reduced particle density on mobile ($45 \times 30$) vs desktop ($75 \times 50$).
  - Full memory disposal on unmount (`geometry.dispose()`, `material.dispose()`, `renderer.forceContextLoss()`).
- **Respect `prefers-reduced-motion`**: When active, skip animation loops and render static final states with zero delay.

---

## 6. MANDATORY: Light Mode Implementation Rules

Follow these non-negotiable rules whenever touching or creating light mode styles:

### 1. The "Industrial Paper" Aesthetic (No Flashbangs)
- Light mode is **warm, technical off-white paper** (`#EDEDE8`), never blinding pure `#FFFFFF`.
- Cards must use `#F7F7F3` with crisp, tactile borders (`#C7C7BE`) so components feel like printed data sheets or physical vouchers.
- Typography must be deep charcoal `#141412` for primary text and `#5A5A52` for secondary text to ensure high contrast and maximum readability.

### 2. The Chip Exception Rule (Badges Stay Dark in Both Themes)
- Status chips, badge tags, token identifiers (`TOKEN #`, `PRO`, `PASSKEY //`, etc.), and tech pills **MUST STAY DARK IN BOTH THEMES**.
- Apply `--chip-bg: #141412` and `--chip-text: #B4FF39`. Badges never invert to white or light grey; they act as high-contrast anchor stamps across both modes.

### 3. WCAG AA Contrast Compliance
- The warning / mid-cycle accent on light mode must be **`#9A5C00`**, achieving a $\ge 4.5:1$ contrast ratio against the `#EDEDE8` background.
- Primary green accent text on light mode must use **`#3E7A00`** rather than neon lime so it passes accessibility requirements.

### 4. Noise & Grain Overlay Isolation (Critical Bug Prevention)
- `.grain-overlay` MUST paint its noise SVG on a **`::before` pseudo-element** with `position: fixed; inset: 0; pointer-events: none; z-index: 0;`.
- Set `opacity: 0.08` for dark mode and `opacity: 0.03` for light mode **on `.grain-overlay::before` only**.
- **NEVER** apply `opacity` directly to `<body>` or `.grain-overlay` as a root class, or the entire page and all its UI children will be faded.

### 5. Theme Wipe Transition
- When toggling themes:
  - Switching to **Light Mode**: Right-to-left sweep wipe.
  - Switching to **Dark Mode**: Left-to-right sweep wipe.
- The transition must execute smoothly without freezing browser snapshot layers (`::view-transition-new(root)`) or leaving opaque canvas overlays over the DOM.

### 6. 3D Terrain Dotted Surface Color
- Mesh dots in `components/ui/dotted-surface.tsx` render in Amber **`#C77700`** across both themes.
- Dark mode: `THREE.AdditiveBlending` for glowing point ambiance.
- Light mode: `THREE.NormalBlending` with slightly reduced opacity for crisp technical terrain points.

---

## 7. Process checklist (follow in order, do not skip steps)

1. Check both Dark Mode and Light Mode on any newly built or modified component.
2. Verify that badges and chips remain jet black with neon text in light mode.
3. Verify that contrast ratios meet WCAG AA standards.
4. Verify responsive behavior across mobile (< 768px), tablet (< 1024px), and desktop ($\ge$ 1024px).
5. Every transaction (buy/list/unlist) must show explicit pending/success/fail states — never a silent hang.

---

## 8. Out of scope — do not build, even if visually referenced

No AI chatbot, no browser extension, no real IPFS/Pinata upload flow, no fractionalized bundles, no gift-link transfers, no real yield/Aave integration, no subgraph. If a cosmetic reference to any of these appears (e.g. a "yield earned" counter), it must be clearly decorative frontend-only state — never implying a working backend capability that doesn't exist.
