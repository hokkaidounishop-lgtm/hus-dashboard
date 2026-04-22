/**
 * Founder dashboard (v2.2) mock data — Hokkaido Uni Shop.
 * Realistic premium-food-business numbers, not generic SaaS.
 *
 * Types (JSDoc — project is JS, not TS):
 *
 * @typedef {Object} StrategicPriority
 * @property {'P1'|'P2'|'P3'|'P4'} id
 * @property {string} title
 * @property {string} description   // for hover/tooltip — not always shown on screen
 */

/**
 * @typedef {Object} RevenueBreakdownItem
 * @property {'B2C'|'B2B'|'Export'|'Broker'} key
 * @property {string} label
 * @property {number} amount
 * @property {number} share              // 0..1 share of MTD total
 * @property {number} [deltaVsLastMonth] // % vs last-month-to-same-day
 *
 * @typedef {Object} RevenueSummary
 * @property {number} mtdSales
 * @property {number} forecast
 * @property {number} target
 * @property {number} deltaVsLastMonth   // % vs last-month-same-point
 * @property {number} deltaVsLastYear    // % vs last-year-same-month
 * @property {number} cvr                // %  e.g. 0.83
 * @property {number} cvrTarget          // %  e.g. 1.00
 * @property {number} aov                // USD
 * @property {number} aovTarget          // USD
 *
 * @typedef {Object} CashStatus
 * @property {'Safe'|'Watch'|'Tight'} level
 * @property {number} monthEndForecast
 * @property {number} overdueArCount
 * @property {string} [riskNote]
 *
 * @typedef {Object} TeamPulseItem
 * @property {string} id
 * @property {string} team
 * @property {string} lead
 * @property {string} focus            // this week focus
 * @property {string} currentState
 * @property {string} reviewNeeded
 * @property {string} blocker          // 'None' if no blocker
 * @property {string} nextReview
 * @property {'P1'|'P2'|'P3'|'P4'} strategicTag
 * @property {string} kpiLink          // KPI label this team moves
 * @property {number} [progress]       // 0-100, secondary
 *
 * @typedef {Object} TodayFocusItem
 * @property {string} id
 * @property {number} priority             // 1 (highest) .. 5
 * @property {'Decision'|'Follow-up'|'Review'|'Deadline'} type
 * @property {string} item                 // the action title
 * @property {string} owner
 * @property {string} whyItMatters         // required, 1 line
 * @property {'P1'|'P2'|'P3'|'P4'} strategicTag   // required
 * @property {string} due                  // free text or YYYY-MM-DD
 * @property {'Open'|'In Progress'|'Done'} status
 *
 * @typedef {Object} WeeklyAlert
 * @property {string} id
 * @property {'low'|'medium'|'high'} severity
 * @property {string} title
 * @property {string} current   // e.g. "0.83%"
 * @property {string} target    // e.g. "1.00% target"
 * @property {string} impact    // why it matters (1 line)
 * @property {string} owner
 */

/** @type {StrategicPriority[]} */
export const strategicPriorities = [
  {
    id: 'P1',
    title: 'NY B2C Growth',
    description: 'Increase high-margin, repeat B2C customers from New York.',
  },
  {
    id: 'P2',
    title: 'B2B Expansion',
    description: 'Grow repeatable B2B accounts; market expands when effort is applied.',
  },
  {
    id: 'P3',
    title: 'New Revenue Lines',
    description: 'Build Tuna Show / Broker / Export into scalable revenue pillars.',
  },
  {
    id: 'P4',
    title: 'KPI-first Execution',
    description: 'Protect time for KPI-linked work, not reactive work.',
  },
]

/** @type {RevenueSummary} */
export const revenueSummary = {
  mtdSales:         100600,
  forecast:         143700,
  target:           165000,
  deltaVsLastMonth: 15.3,
  deltaVsLastYear:  22.6,
  cvr:              0.83,
  cvrTarget:        1.00,
  aov:              414,
  aovTarget:        420,
}

/** @type {RevenueBreakdownItem[]} */
export const revenueBreakdown = [
  { key: 'B2C',    label: 'B2C',           amount: 48600, share: 0.483, deltaVsLastMonth:  12.4 },
  { key: 'B2B',    label: 'B2B',           amount: 32000, share: 0.318, deltaVsLastMonth:  18.5 },
  { key: 'Export', label: 'Export',        amount: 14200, share: 0.141, deltaVsLastMonth: -8.2 },
  { key: 'Broker', label: 'Broker / Spot', amount: 5800,  share: 0.058, deltaVsLastMonth:  5.1 },
]

/** @type {CashStatus} */
export const cashStatus = {
  level:            'Watch',
  monthEndForecast: 184500,
  overdueArCount:   3,
  riskNote:         'Q2 inventory deposit ($42K) due May 10 — confirm Freshline drawdown timing.',
}

/** @type {WeeklyAlert[]} */
export const weeklyAlerts = [
  {
    id:       'al-cvr',
    severity: 'high',
    title:    'Site-wide CVR below target',
    current:  '0.83%',
    target:   '1.00% target',
    impact:   'Every 0.1% lift ≈ +$3.5K/mo. PDP redesign + checkout audit owed.',
    owner:    'Tad',
  },
  {
    id:       'al-export',
    severity: 'medium',
    title:    'Export gross margin compression',
    current:  '21%',
    target:   '28% normal',
    impact:   'Air freight surcharge eating margin on Tokyo→LAX route.',
    owner:    '疾風',
  },
  {
    id:       'al-tunashow',
    severity: 'medium',
    title:    'Tuna Show launch behind schedule',
    current:  '11d slip',
    target:   'gate May 5',
    impact:   'Pushes first revenue from May into June — affects Q2 forecast.',
    owner:    'Jus',
  },
  {
    id:       'al-complaint',
    severity: 'low',
    title:    'Complaint rate trending up',
    current:  '1.4%',
    target:   '0.8% normal',
    impact:   'Mostly cold-chain timing in Texas — track 2 more weeks.',
    owner:    'とべぶた',
  },
]

/** @type {TodayFocusItem[]} */
export const todayFocus = [
  {
    id:           'tf-1',
    priority:     1,
    type:         'Decision',
    item:         'Approve Freshline May order quantity',
    owner:        'Tad',
    whyItMatters: 'Locks in B2B Q2 supply — affects revenue forecast and cash drawdown timing.',
    strategicTag: 'P2',
    due:          'Today',
    status:       'Open',
  },
  {
    id:           'tf-2',
    priority:     2,
    type:         'Follow-up',
    item:         'Ping Jus on Tuna Show launch slip',
    owner:        'Tad',
    whyItMatters: '11-day slip pushes first revenue from May → June; need new gate date.',
    strategicTag: 'P3',
    due:          'Today',
    status:       'Open',
  },
  {
    id:           'tf-3',
    priority:     3,
    type:         'Review',
    item:         'Review CVR Recovery PDP redesign mock',
    owner:        'とべぶた',
    whyItMatters: 'Every 0.1% CVR lift ≈ +$3.5K/mo — can\'t ship without sign-off.',
    strategicTag: 'P1',
    due:          'Tomorrow',
    status:       'In Progress',
  },
  {
    id:           'tf-4',
    priority:     4,
    type:         'Deadline',
    item:         'Send Mailchimp NY segment campaign',
    owner:        '脳汁',
    whyItMatters: 'Holiday push timing — slip costs ~$8K B2C revenue.',
    strategicTag: 'P1',
    due:          'Fri 4/24',
    status:       'Open',
  },
]

/** @type {TeamPulseItem[]} */
export const teamPulse = [
  {
    id:           'tp-sales',
    team:         'Sales',
    lead:         'Tad',
    focus:        'Close 2 new B2B accounts this week (Freshline + Whole Foods NJ)',
    currentState: 'Freshline term sheet drafted; Whole Foods NJ buyer intro scheduled Wed.',
    reviewNeeded: 'Term sheet sign-off',
    blocker:      'None',
    nextReview:   'Fri 4/24',
    strategicTag: 'P2',
    kpiLink:      'B2B MTD Sales',
    progress:     55,
  },
  {
    id:           'tp-b2c',
    team:         'B2C / Marketing',
    lead:         'とべぶた',
    focus:        'CVR Recovery — PDP redesign + DropShip Meta launch',
    currentState: 'Creative library 70%; PDP mock awaiting Tad review.',
    reviewNeeded: 'PDP redesign mock',
    blocker:      'Tad PDP review pending — blocks ad creative finalization',
    nextReview:   'Thu 4/23',
    strategicTag: 'P1',
    kpiLink:      'Site-wide CVR (target 1.0%)',
    progress:     42,
  },
  {
    id:           'tp-ops',
    team:         'Ops / Export',
    lead:         '疾風',
    focus:        'Cut Tokyo→LAX air freight cost; renegotiate carrier rates',
    currentState: 'RFQ sent to 3 carriers; awaiting bids.',
    reviewNeeded: 'Carrier bid comparison',
    blocker:      'None',
    nextReview:   'Mon 4/27',
    strategicTag: 'P3',
    kpiLink:      'Export GM% (target 28%)',
    progress:     30,
  },
  {
    id:           'tp-finance',
    team:         'Finance',
    lead:         '小池',
    focus:        'Lock Q2 cash forecast & Freshline drawdown timing',
    currentState: 'AR aging reconciled; forecast model 80% complete.',
    reviewNeeded: 'Cash forecast review',
    blocker:      'None',
    nextReview:   'Wed 4/29',
    strategicTag: 'P4',
    kpiLink:      'Month-end Cash Forecast',
    progress:     80,
  },
  {
    id:           'tp-claude',
    team:         'Claude Code / Projects',
    lead:         'ナランチャ',
    focus:        'Ship Founder Cockpit v2.2 (Steps 1–5)',
    currentState: 'Steps 1–3 complete and approved; Step 4 in flight.',
    reviewNeeded: 'Step 4 visual review',
    blocker:      'None',
    nextReview:   'Today',
    strategicTag: 'P4',
    kpiLink:      'Cockpit ship date',
    progress:     70,
  },
  {
    id:           'tp-newbiz',
    team:         'New Business',
    lead:         'Jus',
    focus:        'Tuna Show — finalize partner contract, set May launch gate',
    currentState: 'Partner verbal yes; legal redlines outstanding.',
    reviewNeeded: 'Contract redline approval',
    blocker:      'Partner legal team unresponsive 6 days — escalate this week',
    nextReview:   'Tue 4/28',
    strategicTag: 'P3',
    kpiLink:      'Tuna Show first-month revenue',
    progress:     35,
  },
]



