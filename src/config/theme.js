/**
 * HUS design tokens — single source of truth for color.
 *
 * Step 6 introduces the HUS accent color (terracotta #B15A3C, per HUS規定書 v1.0)
 * to replace pure black (#1a1a18) on interactive / priority / hero surfaces.
 * Black is retained purely as body text color because it is the most legible
 * on the #EDECEA warm-gray page background — only the "active pill / P1 pill /
 * hero banner / today dot" surfaces switch to terracotta.
 *
 * Import from anywhere:
 *   import { colors, priority } from '../config/theme'
 */

// ── Canonical palette ─────────────────────────────────────────────────────
export const colors = {
  // Neutrals (unchanged)
  text:    '#1a1a18',  // body text / dense numbers (kept black for legibility)
  muted:   '#6b6b66',
  faint:   '#9b9b94',
  bgPage:  '#EDECEA',  // warm gray page background
  bgCard:  '#ffffff',
  border:  'rgba(0,0,0,0.06)',
  hair:    'rgba(0,0,0,0.04)',

  // Semantic
  ok:      '#15803d',
  warn:    '#b45309',
  danger:  '#dc2626',

  // HUS accent — terracotta (規定書 v1.0)
  accent:      '#B15A3C',                 // full strength — active pill, hero, P1
  accentSoft:  '#C38570',                 // 70 % mix w/ warm bg — P2
  accentTint:  'rgba(177, 90, 60, 0.08)', // hover / selected chip wash
  accentInk:   '#ffffff',                 // text on accent surfaces
}

// ── Priority pill tokens ──────────────────────────────────────────────────
// Used by StrategicPrioritiesSection, MorningDashboard P1/P2 pills,
// TeamPulseSection priority badges, TodayFocusSection priority badges.
export const priority = {
  P1: { bg: colors.accent,     fg: colors.accentInk, badgeBg: 'rgba(255,255,255,0.18)' },
  P2: { bg: colors.accentSoft, fg: colors.accentInk, badgeBg: 'rgba(255,255,255,0.20)' },
  P3: { bg: colors.bgCard,     fg: colors.text,      badgeBg: 'rgba(0,0,0,0.06)', border: true },
  P4: { bg: colors.bgCard,     fg: colors.text,      badgeBg: 'rgba(0,0,0,0.06)', border: true },
}

// ── Nav active pill ───────────────────────────────────────────────────────
export const navActivePill = {
  bg: colors.accent,
  fg: colors.accentInk,
}

// ── Calendar today-dot ────────────────────────────────────────────────────
export const calendarTodayDot = {
  bg: colors.accent,
  fg: colors.accentInk,
}

// ── Hero banner (What's up?) ──────────────────────────────────────────────
export const heroBanner = {
  bg: colors.accent,
  fg: colors.accentInk,
  pattern: 'rgba(255,255,255,0.45)', // for the subtle diagonal over-pattern
}

// Default export for ergonomic `import theme from '../config/theme'`
export default { colors, priority, navActivePill, calendarTodayDot, heroBanner }
