/**
 * HUS Level System configuration
 * Weights and thresholds can be adjusted here without touching component code.
 */

export const LEVEL_WEIGHTS = {
  revenue:      0.30,  // B2C+B2B Revenue achievement rate
  cvr:          0.20,  // CVR achievement rate (current vs target)
  taskComplete: 0.20,  // Task completion rate (done / total)
  projectAvg:   0.20,  // Average project progress
  aov:          0.10,  // AOV achievement rate (current vs target)
}

export const LEVEL_DEFINITIONS = [
  { level: 1, name: '起動中',    min: 0,  max: 20, color: '#999999', bgGradient: 'linear-gradient(135deg, #E8E8E8 0%, #D5D5D5 100%)' },
  { level: 2, name: '成長中',    min: 21, max: 40, color: '#1A1A1A', bgGradient: 'linear-gradient(135deg, #F5E6C8 0%, #E8D4A8 100%)' },
  { level: 3, name: '軌道に乗った', min: 41, max: 60, color: '#2D5B6B', bgGradient: 'linear-gradient(135deg, #C8DDE5 0%, #A8C8D5 100%)' },
  { level: 4, name: '本格稼働',   min: 61, max: 80, color: '#3D7A5C', bgGradient: 'linear-gradient(135deg, #C8E5D4 0%, #A8D5B8 100%)' },
  { level: 5, name: '領域展開',   min: 81, max: 100, color: '#1A1A1A', bgGradient: 'linear-gradient(135deg, #1A1A1A 0%, #2D2520 100%)' },
]

/**
 * Compute the HUS Level score from live data.
 * @param {object} params
 * @param {object} params.kpis - KPI data (current + targets)
 * @param {array}  params.tasks - All tasks
 * @param {array}  params.projects - All projects
 * @returns {{ score: number, level: object, breakdown: object }}
 */
export function computeHUSLevel({ kpis, tasks, projects }) {
  const w = LEVEL_WEIGHTS

  // Revenue achievement (capped at 100%)
  const revTarget = kpis.targets?.monthlyRevenue * 12 || 1
  const revActual = kpis.current?.totalRevenue || 0
  const revenueRate = Math.min(revActual / revTarget, 1)

  // CVR achievement
  const cvrTarget = kpis.targets?.cvr || 1
  const cvrActual = kpis.current?.cvr || 0
  const cvrRate = Math.min(cvrActual / cvrTarget, 1)

  // Task completion rate
  const totalTasks = tasks.length || 1
  const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'completed').length
  const taskRate = doneTasks / totalTasks

  // Average project progress
  const projectProgress = projects.length > 0
    ? projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length / 100
    : 0

  // AOV achievement
  const aovTarget = kpis.targets?.aov || 1
  const aovActual = kpis.current?.aov || 0
  const aovRate = Math.min(aovActual / aovTarget, 1)

  // Weighted score (0-100)
  const rawScore =
    revenueRate   * w.revenue * 100 +
    cvrRate       * w.cvr * 100 +
    taskRate      * w.taskComplete * 100 +
    projectProgress * w.projectAvg * 100 +
    aovRate       * w.aov * 100

  const score = Math.round(Math.min(rawScore, 100))

  // Find current level
  const level = LEVEL_DEFINITIONS.find((l) => score >= l.min && score <= l.max)
    || LEVEL_DEFINITIONS[0]

  return {
    score,
    level,
    breakdown: {
      revenue:      { rate: revenueRate, weighted: Math.round(revenueRate * w.revenue * 100), weight: w.revenue },
      cvr:          { rate: cvrRate, weighted: Math.round(cvrRate * w.cvr * 100), weight: w.cvr },
      taskComplete: { rate: taskRate, weighted: Math.round(taskRate * w.taskComplete * 100), weight: w.taskComplete },
      projectAvg:   { rate: projectProgress, weighted: Math.round(projectProgress * w.projectAvg * 100), weight: w.projectAvg },
      aov:          { rate: aovRate, weighted: Math.round(aovRate * w.aov * 100), weight: w.aov },
    },
  }
}
