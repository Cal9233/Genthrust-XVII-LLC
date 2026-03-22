# Genthrust-XVII-LLC Internal Dashboard — Revamp Design Specification

> **Status**: Design-only document. No code has been changed. Use this as the implementation brief.
> **Prepared**: 2026-03-16
> **Scope**: `/app/internal/` — all 6 tabs plus shared layout, navigation, and component library

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Layout Architecture](#4-layout-architecture)
5. [Component Redesigns](#5-component-redesigns)
6. [Tab-by-Tab Redesign](#6-tab-by-tab-redesign)
7. [New Design Tokens (tailwind.config.js)](#7-new-design-tokens)
8. [Animation & Interaction Spec](#8-animation--interaction-spec)
9. [Inspiration Sources & References](#9-inspiration-sources--references)

---

## 1. Design Philosophy

### Vision

**"Precision Operations Interface"** — a dark-themed, high-density internal tool that feels like it belongs in a modern air traffic operations center. Every pixel earns its place. Data is king; decoration serves only to clarify.

This is not a marketing website. It is a command center for an aviation parts distribution company used by a small, expert internal team. The aesthetic direction is:

> **Refined Operational Dark** — the intersection of Linear's editorial restraint, Supabase's data-density pragmatism, and Stripe's financial clarity. Navy-deep backgrounds. Crisp white type. Burgundy as a surgical accent, not a decoration. Zero filler.

### The Three Principles

1. **Signal over Style** — every color, border, and animation carries information. Status dots that pulse mean something. A red badge means action required. Nothing is decorative.

2. **Eyes-on-data** — the user's gaze should never travel more than a zone to find what they need. Tables are the primary UI surface, not cards. Dense-but-scannable rows, not padded-out cards.

3. **Calm authority** — deep backgrounds reduce eye strain during long sessions. No bright whites on full viewport backgrounds. No unnecessary hover gymnastics.

### What Changes Fundamentally

| Current | New |
|---|---|
| Horizontal tab bar (sticky header + tab strip) | Persistent left sidebar (icon + label, collapsible to icons) |
| `bg-slate-50` light page background | `bg-[#0d1117]` deep near-black background |
| Cards with gradient fills (blue-500/10 etc.) | Cards with `bg-[#161b22]` and a single `border-white/[0.06]` border |
| Tab strip under header | Sidebar rail with active left-border indicator |
| Inter throughout | IBM Plex Sans (body) + IBM Plex Mono (data/numerics) — both available via Google Fonts |
| Per-page `fadeInUp` at page level | Layout-level entry animation; page content staggered via CSS custom properties |

---

## 2. Color System

### Palette Philosophy

The current navy+burgundy brand is good — it is distinctive and aviation-appropriate. The problem is application: navy is used on the header but the page background reverts to `slate-50` (light), creating a jarring two-tone split. The revamp makes navy the **ambient environment**, not just the header.

### New Base Palette

```
BACKGROUND LAYERS (dark mode, always for internal)
──────────────────────────────────────────────────
bg-void          #0b0f14    Page root background (deepest)
bg-surface       #111827    Primary card/panel background
bg-elevated      #1a2233    Slightly lighter surface (table header, hover states)
bg-overlay       #1f2d42    Drawer background, modal overlay content
bg-border        rgba(255,255,255,0.07)  Default border on dark surfaces

BRAND
──────────────────────────────────────────────────
brand-navy       #1e4a8d    Primary brand (logo color — keep)
brand-navy-dim   #14325f    Hover states, active backgrounds on sidebar
brand-burgundy   #9c2a3e    Secondary brand — use ONLY for: active nav indicator,
                             destructive action accents, critical alert outlines
brand-burgundy-glow rgba(156,42,62,0.15)   Subtle glow on hover for destructive

CONTENT
──────────────────────────────────────────────────
text-primary     #f0f6fc    Main headings, table row primary data
text-secondary   #8b949e    Labels, helper text, secondary data
text-tertiary    #484f58    Muted text, placeholders, empty states
text-link        #58a6ff    Monospace IDs that are clickable (RO#, SO#, Invoice#)

STATUS (unchanged semantics, new hex for dark bg)
──────────────────────────────────────────────────
status-ok        #3fb950    Connected, Running, Paid, Healthy
status-warn      #d29922    Warning, DueSoon, Limited
status-err       #f85149    Stopped, Overdue, AOG, Critical
status-info      #58a6ff    Open, Active, In Progress, Pending

ACCENT
──────────────────────────────────────────────────
accent-blue      #1f6feb    Primary action buttons, focus ring color
accent-blue-dim  #0d3060    Button hover state, selected row background
```

These hex values are deliberately chosen from GitHub's dark mode palette — the most battle-tested dark UI for data-dense developer tooling. They are not arbitrary.

### Light/Dark Mode Strategy

The internal dashboard is **dark-mode-only**. There is no toggle. Internal tools for ops teams benefit from reduced eye strain and better data contrast on dark. If a future requirement mandates light mode, add a `data-theme` attribute to the layout root and scope the color variables under it — but do not design for it now. Keep the CSS variable structure clean for future extension:

```css
:root {
  --bg-void: #0b0f14;
  --bg-surface: #111827;
  --bg-elevated: #1a2233;
  --text-primary: #f0f6fc;
  --text-secondary: #8b949e;
  /* etc. */
}
```

---

## 3. Typography

### Font Selection

Replace Inter with **IBM Plex Sans** (body) and keep **JetBrains Mono** for data fields, or switch to **IBM Plex Mono** for a more cohesive IBM Plex family pairing. Both are available in Google Fonts. Rationale: IBM Plex Sans has a subtle technical character that suits operational software — slightly narrower letterforms, engineered warmth. It does not read as "generic SaaS" the way Inter does after a decade of overuse.

```
Display / Page Titles: IBM Plex Sans, weight 600
Section Headers:       IBM Plex Sans, weight 500
Body / Table cells:    IBM Plex Sans, weight 400
Numeric data / IDs:    IBM Plex Mono, weight 400 (or 500 for emphasis)
Status labels:         IBM Plex Sans, weight 500, uppercase + tracking-wide
```

### Size Scale

```
text-2xs   10px   0.625rem  — Badge labels, timestamp footnotes
text-xs    12px   0.75rem   — Table cell secondary text, helper
text-sm    14px   0.875rem  — Table cell primary, sidebar labels, body
text-base  16px   1rem      — Card titles, section headings
text-lg    18px   1.125rem  — Page section headers (h2)
text-xl    20px   1.25rem   — Page titles (h1) in compact header form
text-2xl   24px   1.5rem    — Dashboard greeting, large stat numbers
text-3xl   30px   1.875rem  — Oversized KPI numbers (used sparingly)
```

### Numeric Rendering

All monetary values, counts, and IDs must use `font-mono`. On a dark background, monospace numerics align vertically in table columns and are immediately scannable. This is the Stripe convention.

```
RO-00123        → font-mono text-link text-xs
$4,521.00       → font-mono text-primary text-sm font-medium
42 / 50 Running → font-mono text-status-ok text-base font-semibold
```

---

## 4. Layout Architecture

### From Top-Bar Tabs to Left Sidebar

**Current architecture:**
```
┌──────────────────────────────────────────────────────┐
│  HEADER (navy, full-width, sticky)                   │
│    Logo | Nav Tabs | User | Sign Out                 │
├──────────────────────────────────────────────────────┤
│  MAIN CONTENT (bg-slate-50)                          │
│    container mx-auto px-4 py-8                       │
└──────────────────────────────────────────────────────┘
```

**New architecture:**
```
┌────────┬─────────────────────────────────────────────┐
│        │  TOPBAR (slim, 48px, bg-surface)            │
│ SIDE-  │    [breadcrumb / page title]  [user pill]   │
│  BAR   ├─────────────────────────────────────────────┤
│ 220px  │  PAGE CONTENT                               │
│ (or    │    Full width, bg-void, px-6 py-6           │
│ 64px   │    No container max-width                   │
│ when   │    Uses CSS grid internally per page        │
│ col-   │                                             │
│ lapsed)│                                             │
│        │                                             │
└────────┴─────────────────────────────────────────────┘
```

### Sidebar Specification

```
Width:        220px expanded / 64px collapsed (icon-only)
Background:   bg-[#111827] with right border border-white/[0.06]
Toggle:       Chevron button pinned at bottom of sidebar
Position:     sticky left, full height, independent scroll

Top section:
  - Logo mark (32×32) + "GENTHRUST" wordmark (hidden when collapsed)
  - "INTERNAL" badge in burgundy-400 (hidden when collapsed)

Nav items (stacked, full width):
  - 44px tall touch target
  - 16px left padding, icon (20px), 12px gap, label
  - Inactive: text-secondary, no background
  - Hover: bg-white/[0.04] text-primary, transition 150ms
  - Active: bg-[#1a2233] text-primary, left border 2px solid #9c2a3e
            (the burgundy left-border is the ONLY accent color in idle state)

Bottom section (pinned):
  - Collapse toggle (ChevronLeft / ChevronRight icon)
  - Divider line
  - User avatar pill (avatar + name, hidden when collapsed)
  - Sign out button
```

### Topbar (slim, 48px)

```
Background:    bg-[#111827] border-b border-white/[0.06]
Left:          Breadcrumb — "Genthrust › [Active Tab]" in text-secondary / text-primary
Right:         Refresh timestamp  |  User pill (avatar + name chip)
               No logo in topbar (logo lives in sidebar top)
Height:        48px (down from 64px — reclaim vertical space)
```

### Content Area

```
Background:  bg-[#0b0f14]
Padding:     pl-[220px] (or pl-[64px] when collapsed), pt-[48px]
             Inner content padding: px-6 py-6
Max-width:   None — let data tables stretch to full width
             (Aviation ERP data needs wide tables)
```

### Responsive Breakpoints

```
Desktop (≥1280px): Sidebar 220px expanded, full table columns
Tablet (768-1279px): Sidebar auto-collapses to 64px icon-only on mount
                     Tables become horizontally scrollable
Mobile (<768px): Sidebar becomes bottom sheet drawer, triggered by hamburger
                 Top bar retains title + hamburger
```

### Page Structure Template

Every page follows this structure:

```
<section class="space-y-6">
  <!-- 1. Page Header Zone (always 56px tall) -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-xl font-semibold text-[#f0f6fc] tracking-tight">{title}</h1>
      <p class="text-xs text-[#8b949e] mt-0.5">{subtitle}</p>
    </div>
    <div class="flex items-center gap-2">
      {page-specific actions}
    </div>
  </div>

  <!-- 2. KPI Strip (optional, max 6 stats) -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
    {StatCard × N}
  </div>

  <!-- 3. Primary Content (tables / charts) -->
  <div class="space-y-4">
    {ChartCard / DataSection × N}
  </div>
</section>
```

---

## 5. Component Redesigns

### 5.1 StatCard

**Current state:** Gradient fill cards (`from-blue-500/10 to-blue-600/5`), rounded-xl, icon in colored badge, large bold number, trend arrow. Light background. The gradients are competing for attention — 6 of them side by side creates a rainbow strip.

**New design:**

```
Background:    bg-[#161b22]
Border:        border border-white/[0.06]
Border-radius: rounded-lg (8px, not 12px — less roundness = more precision)
Padding:       p-4

Internal layout:
  Row 1: Icon (16px, text-secondary) + Label (text-xs text-secondary font-medium uppercase tracking-wide)
  Row 2: Value (text-2xl font-semibold font-mono text-primary)
  Row 3: [optional] Trend chip or subtitle (text-xs text-secondary)

Icon:  NO colored icon badge. Icon is small (16px), text-secondary, sits left of label.
       Icon badge containers add visual noise on dark backgrounds.

Hover: border-white/[0.12] transition-colors duration-150
       (subtle — not scale, not shadow, just border brightening)

Loading state: Replace gradient pulse with dark skeleton
  bg-[#1a2233] animate-pulse
  Inner bars: bg-white/[0.06] rounded
```

**Specific Tailwind classes:**

```tsx
// Card wrapper
"bg-[#161b22] border border-white/[0.06] rounded-lg p-4
 hover:border-white/[0.12] transition-colors duration-150
 cursor-pointer"

// Label row
"flex items-center gap-1.5 mb-2"
  Icon: "w-4 h-4 text-[#8b949e]"
  Label: "text-[10px] font-medium text-[#8b949e] uppercase tracking-wider"

// Value
"text-2xl font-semibold font-mono text-[#f0f6fc] leading-none"

// Trend chip (positive)
"inline-flex items-center gap-0.5 text-[10px] font-medium text-[#3fb950]"
// Trend chip (negative)
"inline-flex items-center gap-0.5 text-[10px] font-medium text-[#f85149]"
```

---

### 5.2 StatusOverviewGrid (Dashboard health cards)

**Current state:** 6 gradient-filled OverviewCard components with icon badge + title + health dot + 2-4 metrics in a 2-col grid. Light backgrounds. Cards feel like a list of items, not a unified dashboard.

**New design:** Convert to a **status strip + metric grid hybrid**:

```
Layout: 3-column grid (lg:grid-cols-3), gap-4

Each card:
  bg-[#161b22] border border-white/[0.06] rounded-lg p-5
  Left accent bar: 3px wide, full height, color = health status
    - Healthy: #3fb950
    - Warning: #d29922
    - Critical: #f85149
  Top row: Icon (20px, text-secondary) | Title (text-sm font-medium text-primary)
           ← left, Health badge → right
             Health badge: tiny pill "● HEALTHY" / "● WARNING" / "● CRITICAL"
             text-[10px] uppercase tracking-wide, colored text + matching bg at 10% opacity
  Metrics grid: 2-col within card, each metric:
    - Label: text-[10px] text-secondary uppercase tracking-wide
    - Value: text-xl font-mono font-semibold text-primary

Clickable state: cursor-pointer
  Hover: border-white/[0.10] bg-[#1a2233] transition 150ms
```

**Tailwind classes for card wrapper:**
```
"relative bg-[#161b22] border border-white/[0.06] rounded-lg p-5
 overflow-hidden cursor-pointer
 hover:bg-[#1a2233] hover:border-white/[0.10]
 transition-all duration-150"
```

**Accent bar (absolute positioned):**
```
"absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
// color via inline style or conditional class:
// healthy → bg-[#3fb950]
// warning → bg-[#d29922]
// critical → bg-[#f85149]
```

**Health badge:**
```
// healthy
"inline-flex items-center gap-1 px-2 py-0.5 rounded-full
 text-[10px] font-medium uppercase tracking-wide
 bg-[#3fb950]/10 text-[#3fb950]"
```

---

### 5.3 DataTable

**Current state:** `bg-white` container, `bg-slate-50` header, `divide-y divide-slate-100` rows, light border. Hover is `hover:bg-slate-50/50`. Works but is entirely a light-mode table dropped into a dark context.

**New design:**

```
Container:
  No outer border or card wrapper in most uses.
  Table lives directly within a ChartCard body (which provides the card chrome).

Table header:
  bg-[#161b22] (same as card surface — no contrast pop, just spacing)
  th: text-[10px] font-medium text-[#8b949e] uppercase tracking-wider
      px-4 py-2.5
      Sortable headers: cursor-pointer hover:text-[#f0f6fc] transition-colors
  Bottom border: border-b border-white/[0.06]

Table rows:
  td: px-4 py-3 text-sm text-[#f0f6fc]
  Secondary data cells: text-[#8b949e]
  Mono/ID cells: font-mono text-[#58a6ff] text-xs font-medium (link blue)
  Row divider: divide-y divide-white/[0.04]

  Hover:  bg-white/[0.03] cursor-pointer transition-colors duration-100

Selected row:
  bg-[#1f6feb]/10 border-l-2 border-[#1f6feb]

Empty state:
  py-16 text-center
  Icon: w-10 h-10 text-[#484f58]
  Text: text-sm text-[#484f58]
```

**Search input (within DataTable header):**
```
"w-full pl-9 pr-4 py-2 text-sm rounded-md
 bg-[#0b0f14] border border-white/[0.08]
 text-[#f0f6fc] placeholder-[#484f58]
 focus:outline-none focus:border-[#1f6feb] focus:ring-1 focus:ring-[#1f6feb]/30
 transition-all duration-150"
```

**Pagination:**
```
"flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]"
Count: "text-xs text-[#8b949e]"
Buttons: "p-1.5 rounded text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06]
          disabled:opacity-30 transition-colors"
Page indicator: "text-xs text-[#8b949e] font-mono px-2"
```

**StatusBadge (new dark-mode variants):**

Replace the current `bg-color-50 text-color-700 border-color-200` (light mode) badges with:

```
Open / Active / In Progress / Pending (blue-info):
  "bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20"

Completed / Paid / Approved / Received (green):
  "bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20"

Shipped / Delivered (purple):
  "bg-[#a371f7]/10 text-[#a371f7] border border-[#a371f7]/20"

Overdue / PAST_DUE / Cancelled / AOG (red):
  "bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20"

DUE_SOON / Warning (amber):
  "bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20"

Closed / Unknown (neutral):
  "bg-white/[0.06] text-[#8b949e] border border-white/[0.08]"

Base wrapper always:
  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium font-sans"
  (rounded, not rounded-full — pill shape is overused; a sharper badge reads more authoritatively)
```

---

### 5.4 DetailDrawer

**Current state:** `bg-white`, `border-l border-slate-200`, white header. Slides in from right. Clean but entirely light-mode.

**New design:**

```
Backdrop:
  "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]
   transition-opacity duration-300"

Drawer panel:
  "fixed top-0 right-0 h-full w-full sm:w-[560px] z-50 flex flex-col
   bg-[#161b22] border-l border-white/[0.08]
   shadow-[−20px_0_60px_rgba(0,0,0,0.5)]
   transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
  (The easing curve is the iOS-style deceleration — feels natural, not mechanical)

Drawer header:
  "flex items-start justify-between px-6 py-5
   border-b border-white/[0.06] flex-shrink-0"
  Title: "text-base font-semibold text-[#f0f6fc] tracking-tight"
  Subtitle: "text-xs text-[#8b949e] mt-0.5"
  Close button:
    "p-1.5 rounded text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06]
     transition-colors flex-shrink-0"

Scrollable content area:
  "flex-1 overflow-y-auto overscroll-contain px-6 py-5"
  Custom scrollbar (via CSS):
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
```

**DrawerMetaGrid (field grid inside drawer):**
```
// Grid wrapper
"grid grid-cols-2 gap-2"

// Each field
"bg-[#0b0f14] rounded-md px-3 py-2.5 border border-white/[0.05]"
  Label: "text-[10px] text-[#8b949e] font-medium uppercase tracking-wide mb-1"
  Value: "text-sm text-[#f0f6fc]"
```

**DrawerLineItems (nested table in drawer):**
```
Table wrapper: "rounded-md border border-white/[0.06] overflow-hidden"
Header: bg-[#1a2233] th: "text-[10px] text-[#8b949e] uppercase tracking-wide px-3 py-2"
Row: "border-t border-white/[0.04]" td: "px-3 py-2 text-xs text-[#f0f6fc]"
Hover: "hover:bg-white/[0.03]"
```

---

### 5.5 ChartCard

**Current state:** `bg-white border border-slate-200`, solid white card. Clean but light-mode.

**New design:**

```
// Card wrapper
"bg-[#161b22] border border-white/[0.06] rounded-lg overflow-hidden"

// Card header
"px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between"
  Icon: "w-4 h-4 text-[#8b949e]"
  Title: "text-sm font-medium text-[#f0f6fc]"
  Subtitle: "text-xs text-[#8b949e] mt-0.5"
  Action slot: any icon button, uses same button style as close button

// Card body (no padding by default — tables need edge-to-edge)
// Add padding class: "p-5" when containing non-table content
```

**SectionDivider:**
```
"flex items-center gap-3 py-1"
  Icon: "w-3.5 h-3.5 text-[#484f58]"
  Label: "text-[10px] font-semibold text-[#484f58] uppercase tracking-wider"
  Line: "flex-1 h-px bg-white/[0.05]"
```

---

### 5.6 TabNav → Sidebar (SideNav)

**Completely replace TabNav with a persistent left sidebar.**

```tsx
// SideNav component signature (new component, replaces TabNav)
// File: components/internal/SideNav.tsx

// Outer wrapper — sidebar shell
"fixed left-0 top-0 h-full z-40 flex flex-col
 bg-[#111827] border-r border-white/[0.06]
 transition-[width] duration-200 ease-in-out"
// Expanded: w-[220px]  |  Collapsed: w-[64px]

// Logo zone (top, 64px tall — matches topbar height)
"h-16 flex items-center gap-2.5 px-4 flex-shrink-0 border-b border-white/[0.06]"
  Logo img: "h-7 w-auto flex-shrink-0"
  Wordmark (collapsed: hidden, expanded: visible):
    "text-sm font-semibold tracking-wider text-[#f0f6fc] truncate"
    "INTERNAL" chip: "text-[9px] font-bold uppercase tracking-widest
                      text-[#c1506c] bg-[#9c2a3e]/15 px-1.5 py-0.5 rounded"

// Nav list — main section
"flex-1 overflow-y-auto py-3 px-2 space-y-0.5"
  Each nav item:
    "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
     font-medium transition-all duration-150 cursor-pointer w-full"
    Inactive: "text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.04]"
    Active:   "text-[#f0f6fc] bg-[#1a2233]"
             + left border: "before:absolute before:left-0 before:top-[4px]
                              before:bottom-[4px] before:w-[3px]
                              before:bg-[#9c2a3e] before:rounded-r-full"
    Icon: "w-5 h-5 flex-shrink-0"
    Label (hidden when collapsed):
      "truncate" + conditional render via CSS opacity/width

// Bottom zone (user + collapse toggle)
"flex-shrink-0 border-t border-white/[0.06] p-2 space-y-0.5"
  Collapse toggle button:
    "flex items-center justify-center w-full px-3 py-2 rounded-md text-sm
     text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.04] transition-all"
    Icon: ChevronLeft (expanded) / ChevronRight (collapsed), w-4 h-4
    Label: "Collapse" (hidden when collapsed)

  User pill (expanded state):
    "flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white/[0.04]
     cursor-pointer transition-colors"
    Avatar: "w-7 h-7 rounded-full bg-[#9c2a3e] flex items-center justify-center
             text-xs font-bold text-white flex-shrink-0"
    Name+email (hidden collapsed):
      Name: "text-sm font-medium text-[#f0f6fc] truncate"
      Email: "text-[10px] text-[#8b949e] truncate"
```

---

### 5.7 Header → Topbar (slim)

**Replace current 64px header + 44px tab strip (108px total) with a single 48px topbar.**

```tsx
// File: components/internal/Topbar.tsx

"sticky top-0 z-30 h-12 flex items-center justify-between
 px-6 bg-[#111827] border-b border-white/[0.06]"

// Left: breadcrumb
"flex items-center gap-2 text-sm"
  "Genthrust": "text-[#8b949e]"
  "/": "text-[#484f58] mx-0.5"
  Active page: "text-[#f0f6fc] font-medium"

// Right: refresh chip + user
"flex items-center gap-3"
  Refresh chip: "text-xs text-[#8b949e] font-mono tabular-nums"
    Format: "Updated 2m ago" — auto-refreshed, no manual button needed on topbar
  User pill: "flex items-center gap-2 px-2.5 py-1 rounded-md
              bg-white/[0.04] hover:bg-white/[0.07] transition-colors cursor-pointer"
    Avatar: "w-6 h-6 rounded-full overflow-hidden bg-[#9c2a3e]"
    Name: "text-sm text-[#f0f6fc] font-medium hidden sm:block"
```

---

### 5.8 Layout Root (InternalLayout)

**New layout composition:**

```tsx
// Current: flex-col, header on top, main below
// New: flex-row, sidebar fixed left, flex-col right side

<div className="min-h-screen bg-[#0b0f14] flex">
  {/* Sidebar — fixed */}
  <SideNav collapsed={collapsed} onToggle={setCollapsed} session={session} />

  {/* Content column */}
  <div
    className="flex flex-col flex-1 min-w-0 transition-[margin-left] duration-200"
    style={{ marginLeft: collapsed ? 64 : 220 }}
  >
    {/* Topbar */}
    <Topbar session={session} />

    {/* Page content */}
    <main className="flex-1 px-6 py-6 overflow-x-hidden">
      {children}
    </main>

    {/* Chat panel lives in layout root, unchanged */}
    <ChatPanelWrapper />
  </div>
</div>
```

The `collapsed` state should be stored in `localStorage` so it persists across page navigations.

---

### 5.9 ConnectionHealth Card (ERP page)

**Current state:** 3 connection pills in a gray card.

**New design — Terminal-style health indicator:**

```
Card header: "Connection Health" title + pulsing dot animation
Each connection row:
  "flex items-center gap-3 p-3 rounded-md bg-[#0b0f14] border border-white/[0.05]"
  Left: icon in 28×28 rounded square
    Connected: bg-[#3fb950]/10, icon text-[#3fb950]
    Error:     bg-[#f85149]/10, icon text-[#f85149]
    Loading:   bg-white/[0.05], icon text-[#484f58] animate-pulse
  Right:
    Label: "text-xs font-medium text-[#f0f6fc]"
    Status: "text-[10px] text-[status-color] font-mono"
             "● CONNECTED" / "● DISCONNECTED" / "● CHECKING"
  No borders between items — use spacing only
Last checked: "text-[10px] text-[#484f58] font-mono mt-2"
```

---

## 6. Tab-by-Tab Redesign

### 6.1 Dashboard (Home)

**Current layout:**
```
[Greeting text]             [Refresh button]
[6 OverviewCard grid — 3 columns]
```

**New layout:**
```
[Page header: "Good morning, Calvin"  ←  subtle greeting, small]
[Last refreshed timestamp — right, monospace]

┌──────────────────────────────────────────────────────┐
│  STATUS STRIP — 6 cards in 3×2 grid                 │
│  Bot Fleet | ERP | Automation                        │
│  Clients   | Inventory | Quotes/RFQ                  │
│  (Each card: left accent bar, health badge, metrics) │
└──────────────────────────────────────────────────────┘

[Auto-refresh every 60s — no manual button. Stale indicator
 in topbar breadcrumb if data is >90s old: "Updated 2m ago ⚠"]
```

**Key changes:**
- Remove the manual Refresh button from page content (topbar handles stale indicator)
- Greeting text becomes `text-sm text-[#8b949e]` — it is ambient, not dominant
- Cards have no gradients, just the left health-bar accent
- Clicking a card navigates to that tab (unchanged behavior)

**Greeting treatment:**
```tsx
// Instead of large h1:
<p className="text-sm text-[#8b949e] mb-6">
  {greeting}, <span className="text-[#f0f6fc] font-medium">{firstName}</span>
  <span className="ml-3 font-mono text-[10px] text-[#484f58]">
    Updated {lastRefresh.toLocaleTimeString()}
  </span>
</p>
```

---

### 6.2 Bots

**Current layout:**
```
[Page header]
[4 sub-tabs: Fleet | Inventory Intel | PDF Tools | Quote Inbox]
[Tab content — varies by sub-tab]
```

**Sub-tab navigation redesign:**

Replace the inner sub-tab bar with a **horizontal segmented control** (pill-style):

```
"inline-flex items-center bg-[#161b22] border border-white/[0.06]
 rounded-lg p-0.5 gap-0.5"

Each segment:
  Inactive: "px-4 py-1.5 text-xs font-medium text-[#8b949e] rounded-md
             hover:text-[#f0f6fc] transition-colors cursor-pointer"
  Active:   "px-4 py-1.5 text-xs font-medium text-[#f0f6fc] rounded-md
             bg-[#1a2233]"
```

**Bot Fleet sub-tab:**

```
Layout: Two-column on desktop (lg:grid-cols-[1fr_320px])
  Left: Bot status table
  Right: Recent notifications feed (160px wide on desktop)

Bot status table (replaces current card list):
  - One row per bot (not a grid of cards)
  - Columns: Status Dot | Bot Name | Service Name | Uptime | Actions
  - RUNNING rows: left accent #3fb950
  - STOPPED rows: left accent #f85149
  - Actions: "Restart" text button (text-[#58a6ff] text-xs)

Notifications feed (right panel):
  - Slim card, overflow-y-auto, max 10 items
  - Each item: timestamp (mono, 10px) + message (12px)
  - Color-coded left dot by severity
  - "Bot Notifications" header in card
```

**Stat cards (Fleet sub-tab):**
```
Grid: grid-cols-2 sm:grid-cols-4 gap-3
  Running Bots / Stopped / Total SKUs / Today Alerts
  (Use new StatCard design — icon + mono number)
```

**Inventory Intel sub-tab:**

```
Layout: stacked sections
  1. KPI strip (4 stats)
  2. Two-column: Condition Breakdown pie chart | Sales Velocity table
  3. Active Alerts table (full width)

Charts: Recharts stays, but background:
  ResponsiveContainer fills bg-[#161b22] area
  Grid lines: stroke="#ffffff10"
  Tooltip: bg-[#1a2233] border-white/[0.08] text-[#f0f6fc]
  Bar/Line colors: #58a6ff (primary), #3fb950 (positive), #f85149 (negative)
```

---

### 6.3 ERP

**Current layout:**
```
[Page header]
[ConnectionHealth | PartsSync — 2-col]
[KeyMetrics — 6 stats]
[RepairOrders section]
[SalesOrders section]
[Invoices section]
```

**New layout — more data-forward:**

```
[Page header with inline action buttons: "Sync Parts" (incremental) + "Full Sync"]
[3-column strip: ERP DB status | Inventory DB | Portal DB — inline status chips]
[KeyMetrics — 6 stats, compact]

[Tab bar: Repair Orders | Sales Orders | Invoices]
  (Show only one table at a time — reduces vertical scroll significantly)
  Each tab shows its own table + drawer
  Active tab has bottom border indicator in brand-burgundy

When a tab is active, the table is full-width within the ChartCard
```

**Why tab the three tables?** Currently users must scroll past 3 full tables (each with pagination). Tabbing them makes the most-used data immediately visible without scroll. Aviation ops typically works on one order type at a time — an AP clerk uses invoices, a buyer uses repair orders.

**Connection health — new treatment (inline strip instead of card):**

```
// Replaces the ConnectionHealth ChartCard
// Shows as a horizontal row of 3 status chips under the page header
"flex items-center gap-2 flex-wrap"
  Each chip:
    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium
     bg-[#161b22] border"
    Connected: "border-[#3fb950]/30 text-[#3fb950]"
    Error:     "border-[#f85149]/30 text-[#f85149]"
    Dot: "w-1.5 h-1.5 rounded-full animate-pulse"
  Label: "ERP Database", "Inventory DB", "Portal DB"
```

**Parts sync — inline action in page header (not its own card):**

```
// Move from standalone ChartCard to header action buttons
<div className="flex items-center gap-2">
  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     bg-[#161b22] border border-white/[0.08] text-[#8b949e] rounded-md
                     hover:text-[#f0f6fc] hover:border-white/[0.15] transition-all">
    <RefreshCw className="w-3.5 h-3.5" />
    Incremental Sync
  </button>
  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     bg-[#1f6feb] border border-[#1f6feb] text-white rounded-md
                     hover:bg-[#388bfd] transition-all">
    Full Sync
  </button>
</div>
```

**Order tables — new column visual treatment:**

- Order number column: `font-mono text-[#58a6ff] text-xs` (link-blue, already monospace)
- Vendor/Customer: `text-[#f0f6fc] text-sm`
- Status: new dark StatusBadge
- Dates: `font-mono text-[#8b949e] text-xs tabular-nums`
- Amounts: `font-mono text-[#f0f6fc] text-sm font-medium text-right`
- Line count: `font-mono text-[#484f58] text-xs text-right`

---

### 6.4 Automation

**Current layout:**
```
[Page header]
[KPI strip — 4+ stats]
[NET30 Payment Timeline table]
[Follow-up ROs table]
[Purchase Orders table]
[Email Tools section]
```

**New layout — workflow-first:**

```
[Page header]
[3-zone KPI strip: Due This Week | Overdue | Total Open Value]

[Two-column main grid on lg+ screens: lg:grid-cols-[1fr_360px]]
  Left column (primary work queue):
    "Priority Queue" heading
    Unified table mixing NET30 + RO Follow-ups + POs, sorted by urgency
    Color coding: PAST_DUE rows get subtle bg-[#f85149]/5 tint + left accent
    DUE_SOON: bg-[#d29922]/5 tint
    Normal: default dark row

  Right column (action panel):
    "Email Tools" heading
    Quick-send actions stacked vertically
    Each action: icon + label + "Send" button
    Compact, no excessive padding
```

**Status urgency colors in rows:**

```
// Applied to tr element
PAST_DUE: "bg-[#f85149]/[0.04] border-l-2 border-[#f85149]"
DUE_SOON: "bg-[#d29922]/[0.04] border-l-2 border-[#d29922]"
UPCOMING: default row
```

**Payment Timeline Bar (NET30 visual):**

The `PaymentTimelineBar` component stays but is restyled:

```
Track: bg-[#1a2233] rounded-full h-1.5
Fill:
  UPCOMING: bg-[#58a6ff]
  DUE_SOON: bg-[#d29922]
  PAST_DUE: bg-[#f85149]
Days label: font-mono text-[10px] text-[#8b949e] — right of bar
```

---

### 6.5 Clients

**Current layout:**
```
[Page header]
[4 stat cards]
[Company Directory + Portal Users — tabs or sections]
```

**New layout:**

```
[Page header with "Invite User" primary action button]
[2-stat strip: Active Clients | Pending Activation]

[Two-column grid: lg:grid-cols-[1fr_360px]]
  Left: Company Directory (sortable table, search)
    Columns: Company | Users | Active | Pending | Contacts
    Clicking a company row expands inline (accordion) to show contact list
    No drawer needed — contacts are few enough to inline

  Right: Pending Activations panel
    List of pending users with "Activate" / "Reject" quick actions
    "pending_count" badge on panel header
    Each row: Avatar initials | Name | Email | Joined date | Actions
```

**Company row expanded state (accordion):**

```
// When clicked, row expands below to show contacts
"bg-[#161b22] border-t border-white/[0.04]"
Contact pills:
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
   bg-[#1a2233] text-[#8b949e] text-xs"
```

**User activation quick actions:**

```
Activate button:
  "px-2.5 py-1 text-xs font-medium rounded-md
   bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20
   hover:bg-[#3fb950]/20 transition-colors"

Reject button:
  "px-2.5 py-1 text-xs font-medium rounded-md
   bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20
   hover:bg-[#f85149]/20 transition-colors"
```

---

### 6.6 Audit Log

**Current layout:**
```
[Page header]
[Stat cards]
[Filter controls]
[Event table]
[Expanded row detail (collapsible)]
```

**New layout — this page benefits most from the dark theme:**

```
[Page header: "Audit Log"]
[3-stat strip: Total Events | Failed Events | Unique Users (today)]

[Filter bar — full width, card wrapper]
  "bg-[#161b22] border border-white/[0.06] rounded-lg px-4 py-3
   flex flex-wrap items-center gap-3"
  Fields: Email filter | Action filter | Resource type | Date range
  Each filter: small input/select, dark-themed, inline
  "Clear Filters" link — text-[#58a6ff] text-xs

[Events table — full width]
  Columns: Timestamp | User | Action | Resource | IP | Status | Duration
  Status column: ✓ green / ✗ red — icon only, no text (space savings)
  Method badge: GET/POST/DELETE — monospace tiny pill
    GET: bg-[#3fb950]/10 text-[#3fb950]
    POST: bg-[#58a6ff]/10 text-[#58a6ff]
    DELETE: bg-[#f85149]/10 text-[#f85149]
  Duration: font-mono text-[10px] text-[#484f58] tabular-nums

[Click to expand row — slides open inline (no drawer needed for logs)]
  Expanded: bg-[#0b0f14] border-t border-white/[0.04] px-4 py-3
  Shows: Path | User Agent | Error message | Metadata JSON
  Metadata: rendered in a dark code block
    "bg-[#0b0f14] border border-white/[0.06] rounded-md p-3
     font-mono text-xs text-[#8b949e] overflow-x-auto"
```

**Method badge component (new, reusable):**

```tsx
function MethodBadge({ method }: { method: string }) {
  const colors = {
    GET:    'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/20',
    POST:   'bg-[#58a6ff]/10 text-[#58a6ff] border-[#58a6ff]/20',
    PUT:    'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/20',
    PATCH:  'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/20',
    DELETE: 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/20',
  }
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono
                      font-medium border ${colors[method] || colors.GET}`}>
      {method}
    </span>
  )
}
```

---

## 7. New Design Tokens

Full replacement `tailwind.config.js` — migrate from the current colors to these:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- Brand (retained from current) ---
        navy: {
          DEFAULT: '#1e4a8d',
          dim:     '#14325f',
          50:  '#f0f4f9',
          100: '#dae3f0',
          200: '#b8cae3',
          300: '#8aa8d1',
          400: '#5a82ba',
          500: '#3d67a3',
          600: '#1e4a8d',
          700: '#1a3f78',
          800: '#163462',
          900: '#132b51',
        },
        burgundy: {
          DEFAULT: '#9c2a3e',
          glow: 'rgba(156,42,62,0.15)',
          50:  '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d0d7',
          300: '#f4a9b6',
          400: '#c1506c',    // sidebar chip text
          500: '#df4d69',
          600: '#9c2a3e',
          700: '#8a2436',
          800: '#73202f',
          900: '#631e2b',
        },
        // --- Dark UI surfaces ---
        void:     '#0b0f14',
        surface:  '#111827',
        elevated: '#1a2233',
        overlay:  '#1f2d42',
        // --- Status palette (dark-mode calibrated) ---
        ok:     '#3fb950',
        warn:   '#d29922',
        err:    '#f85149',
        info:   '#58a6ff',
        // --- Content ---
        primary:   '#f0f6fc',
        secondary: '#8b949e',
        tertiary:  '#484f58',
        link:      '#58a6ff',
        // --- Action accent ---
        accent:   {
          DEFAULT: '#1f6feb',
          dim:     '#0d3060',
          bright:  '#388bfd',
        },
        // --- Legacy aliases (keep for public-facing pages) ---
        'space': {
          DEFAULT: '#020617',
          50: '#0f172a',
          100: '#1e293b',
        },
        'electric-blue': {
          DEFAULT: '#2563EB',
          600: '#2563EB',
        },
        'status': {
          'available': '#059669',
          'limited':   '#d97706',
          'aog':       '#dc2626',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'var(--font-jetbrains-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'card':           '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover':     '0 4px 12px rgba(0,0,0,0.5)',
        'drawer':         '-20px 0 60px rgba(0,0,0,0.5)',
        'navy-focus':     '0 0 0 3px rgba(31,111,235,0.25)',
        'glow-blue':      '0 0 15px rgba(31,111,235,0.3)',
        'glow-crimson':   '0 0 15px rgba(248,81,73,0.3)',
      },
      animation: {
        'fade-in':      'fadeIn 0.4s ease-out forwards',
        'fade-in-up':   'fadeInUp 0.35s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'border-beam':  'borderBeam 4s linear infinite',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.32,0.72,0,1) forwards',
        'slide-out-right': 'slideOutRight 0.25s ease-in forwards',
        'status-pulse': 'statusPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        slideInRight: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        statusPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(0.85)' },
        },
        borderBeam: {
          '0%':   { '--beam-angle': '0deg' },
          '100%': { '--beam-angle': '360deg' },
        },
      },
      transitionTimingFunction: {
        'ios': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // Retained for public pages:
        'hero-gradient': 'linear-gradient(to bottom, #f0f4f9 0%, #ffffff 50%, #f8fafc 100%)',
        'chrome-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #94A3B8 25%, #FFFFFF 50%, #64748B 75%, #FFFFFF 100%)',
        // New internal dark:
        'subtle-grid': "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0H0v20' fill='none' stroke='rgba(255,255,255,0.02)' stroke-width='1'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
```

---

## 8. Animation & Interaction Spec

### Philosophy

The current codebase already uses Framer Motion and CSS animations well — this spec refines them for the dark context and adds a few key missing interactions.

### Page Entry

Every page content zone fades+slides up. The current `fadeInUp` CSS animation is fine — keep it but reduce the translate from 20px to 8px (less theatrical on dark backgrounds, more precise):

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Stagger timing pattern:
```
Page header:     0ms
KPI strip:      60ms
Primary section: 120ms
Secondary section: 180ms
Tertiary:       220ms
```

### Sidebar Collapse

The sidebar width transition uses CSS `transition-[width]` not JS — this ensures it's hardware-accelerated:

```css
.sidebar {
  transition: width 200ms ease-in-out;
}
.sidebar-content {
  /* Labels fade out as sidebar narrows */
  transition: opacity 150ms ease, width 200ms ease-in-out;
}
.sidebar-label {
  white-space: nowrap;
  overflow: hidden;
  /* When collapsed, parent has overflow:hidden and label clips */
}
```

### Drawer Open/Close (DetailDrawer)

Use Framer Motion `AnimatePresence` for the drawer — more precise than CSS-only for mount/unmount:

```tsx
// Backdrop
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
/>

// Drawer panel
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
  // The ease is iOS deceleration curve — feels physical
/>
```

### Status Pulse (live indicators)

For the pulsing status dots on connected services:

```css
@keyframes statusPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}
.status-dot-live {
  animation: statusPulse 2s ease-in-out infinite;
}
/* Only RUNNING/connected statuses pulse — stopped dots are static */
```

### Table Row Hover

Keep hover transitions at 100ms maximum — faster than the current 200ms default for table rows. Table hover must feel instant:

```
transition-colors duration-100
```

### Stat Card Count Animation

The `AnimatedCounter` component already exists at `components/ui/AnimatedCounter.tsx` — use it on all KPI values to animate on load. Duration: 600ms with ease-out. Numbers count up from 0 to value.

### Bot Status Indicators (Bots page)

For RUNNING bots, add a subtle `box-shadow` pulse to the green status dot:

```css
.bot-running-dot {
  animation: botGlow 2.5s ease-in-out infinite;
}
@keyframes botGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.4); }
  50%       { box-shadow: 0 0 0 4px rgba(63, 185, 80, 0); }
}
```

### Micro-interactions

| Interaction | Spec |
|---|---|
| Button press | `active:scale-[0.97] transition-transform duration-75` |
| Card click | `active:scale-[0.99]` |
| Sort header click | Column header text briefly flashes `text-primary` then settles |
| Search input focus | Border transitions from `border-white/[0.08]` to `border-accent` |
| Toast/feedback | Slide-in from bottom-right, `bg-surface border-white/[0.1]` |

### Recharts Customization

All charts must use a consistent dark-mode theme:

```tsx
const CHART_THEME = {
  background: 'transparent',
  grid: {
    stroke: 'rgba(255,255,255,0.04)',
    strokeDasharray: '3 3',
  },
  axis: {
    tick: { fill: '#8b949e', fontSize: 11, fontFamily: 'IBM Plex Mono' },
    line: { stroke: 'rgba(255,255,255,0.06)' },
  },
  tooltip: {
    contentStyle: {
      background: '#1a2233',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 6,
      fontSize: 12,
      color: '#f0f6fc',
    },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
  },
  colors: {
    primary:  '#58a6ff',
    positive: '#3fb950',
    negative: '#f85149',
    warning:  '#d29922',
    neutral:  '#484f58',
  },
}
```

---

## 9. Inspiration Sources & References

### Direct References

**Linear App Redesign (2024)**
Linear's recent UI refresh reduced visual noise in the sidebar, improved label alignment, and increased contrast in dark mode. Key takeaway: sidebar items should have clear active state hierarchy — not just color change, but layout differentiation (left border, background change). Source: [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)

**GitHub Dark Theme**
The status colors (`#3fb950` green, `#f85149` red, `#d29922` amber, `#58a6ff` blue) are directly borrowed from GitHub's dark mode — the most used dark developer UI, rigorously tested for accessibility contrast ratios on dark backgrounds. The surface colors (`#0d1117`, `#161b22`, `#1f2d42`) follow GitHub's exact layer system.

**Stripe Dashboard**
Stripe's approach to financial data: monospace numbers right-aligned, currency always consistent precision, status badges as small rounded-corner pills (not rounded-full), data tables as the dominant UI pattern rather than cards. Source: [Stripe Dashboard design patterns](https://docs.stripe.com/stripe-apps/patterns)

**Vercel Dashboard**
Developer-first UX: information hierarchy via text weight and color, not borders and backgrounds. Minimal chrome, maximum information. Source: [Vercel Dashboard UX analysis](https://medium.com/design-bootcamp/vercels-new-dashboard-ux-what-it-teaches-us-about-developer-centric-design-93117215fe31)

**Supabase Dashboard Navigation**
Supabase's sidebar navigation is the benchmark for managing dense navigation in developer tools. Key pattern: separate icon+label collapsed/expanded modes, grouped sections, footer user account area. Source: [Supabase dashboard sidebar patterns](https://www.navbar.gallery/blog/best-side-bar-navigation-menu-design-examples)

**shadcn/ui Sidebar Blocks**
The shadcn sidebar block component (`ui.shadcn.com/blocks/sidebar`) demonstrates the exact collapsible pattern to implement — icon-only rail vs full sidebar, CSS transition-based (not JS), persistent state via localStorage. Source: [shadcn/ui Sidebar](https://ui.shadcn.com/blocks/sidebar)

### Design System Principles Applied

From the SaaS dashboard design research:

1. **Neutral base + 2 signal colors** — `#0b0f14` base, `#58a6ff` for info/action, `#f85149` for critical. All other colors are status-specific.

2. **Data density control** — ERP tables show 25 rows with compact `py-3` rows. The design does NOT add density toggles (scope creep) but the component is structured to accept a `compact` prop.

3. **Mobile-first navigation** — Bottom sheet drawer on mobile; sidebar on desktop. Sidebar state persists in `localStorage`.

4. **Sparklines as micro-viz** — The existing Recharts `LineChart` on the Bots page stays. On the Dashboard StatCards, consider adding `ResponsiveContainer` sparklines at 80×24px in the card body for trend visualization without consuming vertical space.

### Pattern Library Candidates (if implementing shadcn/ui)

If the team wants to adopt shadcn/ui primitives during implementation, these components map directly:

| Current Component | shadcn/ui Equivalent |
|---|---|
| Custom DetailDrawer | `Sheet` (right-side) |
| Custom Modal | `Dialog` |
| Custom DataTable | Custom (shadcn Table primitives) |
| Custom StatusBadge | `Badge` with custom variants |
| Custom Toggle | `Switch` |
| Custom Dropdown | `DropdownMenu` |

Adopting shadcn primitives is optional — the existing custom components are well-built and only need restyling, not replacement.

---

## Implementation Priority Order

Suggested implementation sequence to deliver value fastest:

### Phase 1 — Foundation (highest impact, affects all pages)
1. Add IBM Plex Sans + IBM Plex Mono to `_app` / layout font loading
2. Update `globals.css` — add CSS custom properties for all dark mode colors
3. Update `tailwind.config.js` with new tokens
4. Rewrite `InternalLayout` — sidebar + topbar architecture
5. New `SideNav` component (replaces `TabNav`)
6. New `Topbar` component (replaces header)
7. Update `globals.css` dark scrollbar + dark selection color

### Phase 2 — Core Components
8. Restyle `StatCard` (dark, no gradients)
9. Restyle `ChartCard`
10. Restyle `DataTable` + `StatusBadge` (dark mode)
11. Restyle `DetailDrawer` (dark, Framer Motion easing)
12. Restyle `StatusOverviewGrid` (left accent bar design)

### Phase 3 — Per-Page Passes
13. ERP page — tab the three tables, inline connection status
14. Bots page — two-column fleet layout
15. Automation page — priority queue unified table
16. Clients page — accordion company rows + pending panel
17. Audit Log page — inline row expansion + MethodBadge
18. Dashboard home — remove manual refresh button, update greeting

### Phase 4 — Polish
19. Recharts dark theme across all charts
20. AnimatedCounter on all KPI values
21. Bot status glow animations
22. Sidebar collapse localStorage persistence

---

*End of design specification. Total estimated implementation: 3-5 focused engineering days.*
