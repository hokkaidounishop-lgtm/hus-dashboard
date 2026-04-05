import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import Modal from './Modal'
import { useApp } from '../context/AppContext'

const STATUS_CFG = {
  'on-track':  { label: 'On Track',  bg: '#F5F5F5', color: '#999999' },
  'active':    { label: 'Active',    bg: '#F5F5F5', color: '#999999' },
  'planning':  { label: 'Planning',  bg: '#F5F5F5', color: '#999999' },
  'behind':    { label: 'Behind',    bg: '#F5F5F5', color: '#C0392B' },
  'stalled':   { label: 'Stalled',   bg: '#F5F5F5', color: '#C0392B' },
  'completed': { label: 'Completed', bg: '#F5F5F5', color: '#999999' },
}

const BLANK = {
  name: '', description: '', status: 'planning', owner: '',
  kpis: '', deliverables: '', startDate: '', dueDate: '', progress: 0,
}

function ProjectForm({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Project Name</label>
          <input className="input" value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. EU Uni Export" />
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <textarea className="input resize-none h-20" value={value.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div>
          <label className="label">Owner</label>
          <input className="input" value={value.owner} onChange={(e) => set('owner', e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={value.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" className="input" value={value.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>
        <div>
          <label className="label">Progress (%)</label>
          <input type="number" min="0" max="100" className="input" value={value.progress} onChange={(e) => set('progress', parseInt(e.target.value) || 0)} />
        </div>
        <div className="col-span-2">
          <label className="label">KPIs</label>
          <input className="input" value={value.kpis} onChange={(e) => set('kpis', e.target.value)} placeholder="e.g. CVR ≥ 1% | ROAS ≥ 2.5x" />
        </div>
        <div className="col-span-2">
          <label className="label">Key Deliverables</label>
          <input className="input" value={value.deliverables} onChange={(e) => set('deliverables', e.target.value)} placeholder="Comma-separated deliverables" />
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project, onEdit, onDelete }) {
  const s = STATUS_CFG[project.status] || STATUS_CFG['planning']
  const dueFormatted = project.dueDate ? format(parseISO(project.dueDate), 'MMM d, yyyy') : '—'
  const isOverdue = project.dueDate && project.dueDate < new Date().toISOString().slice(0, 10) && project.status !== 'completed'
  const isCritical = project.status === 'stalled' || project.status === 'behind'

  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-4 group transition-all cursor-default"
      style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderLeft: isCritical ? '3px solid #C0392B' : undefined,
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#E0E0E0'
        e.currentTarget.style.boxShadow = '0 3px 12px 0 rgba(0,0,0,0.06)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#F0F0F0'
        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0,0,0,0.04)'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="font-medium text-sm leading-snug"
            style={{ fontFamily: '"Inter", system-ui, sans-serif', color: '#1A1A1A' }}
          >
            {project.name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#999999' }}>{project.owner}</div>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#999999' }}>{project.description}</p>

      {/* KPIs */}
      {project.kpis && (
        <div
          className="text-xs rounded-lg px-3 py-2 font-medium leading-relaxed"
          style={{ background: '#F5F5F5', color: '#999999', border: '1px solid #F0F0F0' }}
        >
          {project.kpis}
        </div>
      )}

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs mb-1.5" style={{ color: '#999999' }}>
          <span>Progress</span>
          <span className="font-medium" style={{ color: '#999999' }}>{project.progress}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: isOverdue ? '#C0392B' : '#999999', fontWeight: isOverdue ? 500 : 400 }}>
          {isOverdue ? '⚠ Overdue · ' : 'Due '}{dueFormatted}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(project)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#C4BBB3' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,169,110,0.1)'; e.currentTarget.style.color = '#1A1A1A' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C4BBB3' }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(project.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#C4BBB3' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(192,57,43,0.08)'; e.currentTarget.style.color = '#C0392B' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C4BBB3' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectTracker() {
  const { projects, addProject, updateProject, deleteProject } = useApp()
  const [modal, setModal] = useState(null)

  const openAdd = () => setModal({ mode: 'add', data: { ...BLANK } })
  const openEdit = (p) => setModal({ mode: 'edit', data: { ...p } })
  const closeModal = () => setModal(null)

  const handleSave = () => {
    if (!modal.data.name.trim()) return
    if (modal.mode === 'add') addProject(modal.data)
    else updateProject(modal.data.id, modal.data)
    closeModal()
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this project?')) deleteProject(id)
  }

  const statusOrder = ['active', 'behind', 'stalled', 'on-track', 'planning', 'completed']
  const sorted = [...projects].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
  )

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_CFG).map(([k, v]) => {
            const count = projects.filter((p) => p.status === k).length
            if (!count) return null
            return (
              <span
                key={k}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: v.bg, color: v.color }}
              >
                {v.label} · {count}
              </span>
            )
          })}
        </div>
        <button
          onClick={openAdd}
          className="btn-primary"
        >
          <Plus size={15} /> Add Project
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {sorted.map((p) => (
          <ProjectCard key={p.id} project={p} onEdit={openEdit} onDelete={handleDelete} />
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={!!modal}
        onClose={closeModal}
        title={modal?.mode === 'add' ? 'Add New Project' : 'Edit Project'}
        size="lg"
      >
        {modal && (
          <>
            <ProjectForm value={modal.data} onChange={(data) => setModal((m) => ({ ...m, data }))} />
            <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: '1px solid #F0F0F0' }}>
              <button onClick={closeModal} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                {modal.mode === 'add' ? 'Add Project' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
