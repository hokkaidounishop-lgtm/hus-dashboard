/**
 * HUS design tokens — single source of truth.
 *
 * La Main 診断（2026-04-24）後の再設計。
 * - accent は構造化された「3%以下・7箇所以下」の焦点として使い、
 *   solid の塗りつぶしは Calendar の today dot 1箇所のみ。
 * - Hero banner / Nav active / P1P2 pill は「tint bg + accent line」の
 *   ラインアクセント方式に切替え、残り 97% を neutral ink/paper で構成。
 * - HUS 規定書 v1.0 の accent 出現頻度・階層をそのまま再現。
 */

// ── Canonical tokens ──────────────────────────────────────────────────────
export const tokens = {
  accent:       '#B15A3C',
  accentTint4:  'rgba(177, 90, 60, 0.04)',
  accentTint6:  'rgba(177, 90, 60, 0.06)',

  ink:          '#1A1A1A',
  inkMuted:     '#4A4A4A',
  inkSubtle:    '#8A8A86',

  paper:        '#EDECEA',
  paperWarm:    '#FAFAF7',
  hairline:     '#EDECE8',
}

// ── Legacy `colors` shim ──────────────────────────────────────────────────
// Older modules import `{ colors }` — keep the shape so they keep rendering
// while slowly migrating to `tokens`.
export const colors = {
  text:    tokens.ink,
  muted:   tokens.inkMuted,
  faint:   tokens.inkSubtle,
  bgPage:  tokens.paper,
  bgCard:  '#ffffff',
  border:  'rgba(0,0,0,0.06)',
  hair:    'rgba(0,0,0,0.04)',

  ok:      '#15803d',
  warn:    '#b45309',
  danger:  '#dc2626',

  accent:      tokens.accent,
  accentSoft:  tokens.accent,   // P2 は tint 方式に移行したので softの概念は消滅
  accentTint:  tokens.accentTint6,
  accentInk:   '#ffffff',
}

// ── Priority tokens ───────────────────────────────────────────────────────
// `pill` = Strategic Priority row（フル幅・左ライン入り）
// `tag`  = Team Pulse / Today Focus の小さい inline chip（tint bg + text）
// P1 のみ accent の色、P2 は accent を細いライン1本に限定、P3/P4 は完全 neutral。
export const priority = {
  P1: {
    pill: {
      bg:         '#ffffff',
      fg:         tokens.ink,
      border:     `1px solid ${tokens.hairline}`,
      borderLeft: `3px solid ${tokens.accent}`,
      badgeBg:    tokens.accentTint6,
      badgeFg:    tokens.accent,
    },
    tag: {
      bg: tokens.accentTint6,
      fg: tokens.accent,
    },
  },
  P2: {
    pill: {
      bg:         '#ffffff',
      fg:         tokens.ink,
      border:     `1px solid ${tokens.hairline}`,
      borderLeft: `2px solid ${tokens.accent}`,
      badgeBg:    'rgba(0,0,0,0.04)',
      badgeFg:    tokens.inkMuted,
    },
    tag: {
      bg: 'rgba(0,0,0,0.04)',
      fg: tokens.inkMuted,
    },
  },
  P3: {
    pill: {
      bg:         tokens.paperWarm,
      fg:         tokens.inkMuted,
      border:     `1px solid ${tokens.hairline}`,
      borderLeft: 'none',
      badgeBg:    'rgba(0,0,0,0.04)',
      badgeFg:    tokens.inkSubtle,
    },
    tag: {
      bg: 'rgba(0,0,0,0.04)',
      fg: tokens.inkSubtle,
    },
  },
  P4: {
    pill: {
      bg:         tokens.paperWarm,
      fg:         tokens.inkMuted,
      border:     `1px solid ${tokens.hairline}`,
      borderLeft: 'none',
      badgeBg:    'rgba(0,0,0,0.04)',
      badgeFg:    tokens.inkSubtle,
    },
    tag: {
      bg: 'rgba(0,0,0,0.04)',
      fg: tokens.inkSubtle,
    },
  },
}

// ── Nav active pill ───────────────────────────────────────────────────────
// tint bg + 下 2px の accent bar。solid 塗りつぶしは廃止。
export const navActivePill = {
  bg:        tokens.accentTint6,
  fg:        tokens.ink,
  bottomBar: tokens.accent,
}

// ── Calendar today dot ────────────────────────────────────────────────────
// La Main 診断：画面で唯一残す solid accent の焦点。触らない。
export const calendarTodayDot = {
  bg: tokens.accent,
  fg: '#ffffff',
}

// ── Hero banner（What's up?）────────────────────────────────────────────────
// 白 card + 左 3px accent bar + accent eyebrow。solid 塗りつぶしは廃止。
export const heroBanner = {
  bg:      '#ffffff',
  fg:      tokens.ink,
  eyebrow: tokens.accent,
  leftBar: tokens.accent,
  border:  `1px solid ${tokens.hairline}`,
}

export default { tokens, colors, priority, navActivePill, calendarTodayDot, heroBanner }
