import { useMemo } from 'react'
import { Trophy, TrendingUp, CheckSquare, Target, Layers, DollarSign, Zap } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { computeHUSLevel, LEVEL_DEFINITIONS } from '../config/levelSystem'

const BREAKDOWN_CONFIG = {
  revenue:      { label: 'Revenue Achievement',   icon: TrendingUp, color: '#1A1A1A' },
  cvr:          { label: 'CVR Achievement',        icon: Target,     color: '#C0392B' },
  taskComplete: { label: 'Task Completion',        icon: CheckSquare, color: '#3D7A5C' },
  projectAvg:   { label: 'Project Progress',       icon: Layers,     color: '#2D5B6B' },
  aov:          { label: 'AOV Achievement',         icon: DollarSign, color: '#7C5CFC' },
}

export default function LevelSystem() {
  const { kpis, tasks, projects } = useApp()

  const { score, level, breakdown } = useMemo(
    () => computeHUSLevel({ kpis, tasks, projects }),
    [kpis, tasks, projects]
  )

  const levelRange = level.max - level.min + 1
  const progressInLevel = score - level.min
  const progressPct = Math.min((progressInLevel / levelRange) * 100, 100)

  const nextLevel = LEVEL_DEFINITIONS.find((l) => l.level === level.level + 1) || null
  const pointsToNext = nextLevel ? nextLevel.min - score : 0

  const isMaxLevel = level.level === 5

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="p-6">
        {/* Card header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.04)' }}
            >
              <Trophy size={15} style={{ color: '#666666' }} />
            </div>
            <h3
              className="text-sm font-medium"
              style={{ color: '#1A1A1A' }}
            >
              HUS Level System
            </h3>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <Zap size={11} style={{ color: '#1A1A1A' }} />
            <span className="text-xs font-semibold" style={{ color: '#1A1A1A' }}>
              Score: {score}/100
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left — current level & progress */}
          <div>
            <div className="flex items-baseline gap-2.5 mb-1.5">
              <span
                className="text-4xl font-bold"
                style={{
                  color: '#1A1A1A',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: 1,
                }}
              >
                Lv.{level.level}
              </span>
              <span
                className="text-base font-medium"
                style={{ color: '#1A1A1A' }}
              >
                {level.name}
              </span>
            </div>

            <div className="text-xs mb-5" style={{ color: '#999999' }}>
              Overall Score:{' '}
              <span style={{ color: '#1A1A1A', fontWeight: 600 }}>
                {score}
              </span>
              /100
            </div>

            {/* Progress bar */}
            <div className="flex justify-between text-xs mb-2" style={{ color: '#999999' }}>
              <span>Lv.{level.level} {level.name}</span>
              {nextLevel && <span>Lv.{nextLevel.level} {nextLevel.name}</span>}
              {isMaxLevel && <span style={{ color: '#1A1A1A' }}>MAX</span>}
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden relative"
              style={{ background: 'rgba(0,0,0,0.06)' }}
            >
              <div
                className="h-full rounded-full relative"
                style={{
                  width: `${progressPct}%`,
                  background: '#1A1A1A',
                  transition: 'width 0.7s ease',
                }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                  }}
                />
              </div>
            </div>

            {nextLevel ? (
              <div className="flex items-center gap-1.5 mt-2.5">
                <Target size={11} style={{ color: '#999999' }} />
                <span className="text-xs" style={{ color: '#999999' }}>
                  <span style={{ color: '#1A1A1A', fontWeight: 600 }}>
                    {pointsToNext} points
                  </span>{' '}
                  to next level
                </span>
              </div>
            ) : (
              <div
                className="text-xs font-semibold uppercase tracking-widest mt-2.5 flex items-center gap-2"
                style={{ color: '#1A1A1A', letterSpacing: '0.15em' }}
              >
                MAXIMUM LEVEL ACHIEVED
              </div>
            )}
          </div>

          {/* Right — score breakdown */}
          <div
            className="rounded-lg p-4"
            style={{
              background: 'rgba(0,0,0,0.02)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: '#1A1A1A', letterSpacing: '0.10em' }}
            >
              Score Breakdown
            </div>
            <div className="space-y-3">
              {Object.entries(breakdown).map(([key, data]) => {
                const config = BREAKDOWN_CONFIG[key]
                const Icon = config.icon
                const ratePct = Math.round(data.rate * 100)
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(0,0,0,0.04)' }}
                        >
                          <Icon size={11} style={{ color: config.color }} />
                        </div>
                        <span className="text-xs truncate" style={{ color: '#666666' }}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs tabular-nums" style={{ color: '#999999' }}>
                          {ratePct}%
                        </span>
                        <span
                          className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(0,0,0,0.04)', color: '#1A1A1A', minWidth: 28, textAlign: 'center' }}
                        >
                          +{data.weighted}
                        </span>
                      </div>
                    </div>
                    <div
                      className="h-1 rounded-full overflow-hidden ml-7"
                      style={{ background: 'rgba(0,0,0,0.06)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ratePct}%`,
                          background: config.color,
                          transition: 'width 0.5s ease',
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
            >
              <span className="text-xs" style={{ color: '#999999' }}>
                Weights: Rev 30% / CVR 20% / Tasks 20% / Projects 20% / AOV 10%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
