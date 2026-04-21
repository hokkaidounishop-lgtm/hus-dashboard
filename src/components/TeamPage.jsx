import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Users, RotateCcw } from 'lucide-react'
import Modal from './Modal'
import seedData from '../data/team.json'

const STORAGE_KEY = 'hus:team:v1'

function loadTeam() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedData
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return seedData
    return parsed
  } catch {
    return seedData
  }
}

function saveTeam(team) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team))
  } catch (e) {
    console.error('[Team] Failed to persist:', e)
  }
}

function Avatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
      style={{
        background: '#1a1a18',
        color: '#ffffff',
        letterSpacing: '-0.01em',
      }}
    >
      {initial || '?'}
    </div>
  )
}

function RoleBadge({ role }) {
  return (
    <span
      className="text-[11px] font-semibold uppercase px-2 py-0.5 inline-block"
      style={{
        borderRadius: 20,
        background: 'rgba(0,0,0,0.04)',
        color: '#1a1a18',
        letterSpacing: '0.08em',
      }}
    >
      {role || '—'}
    </span>
  )
}

function MemberCard({ member, onEdit, onDelete }) {
  return (
    <div
      className="rounded-xl flex flex-col gap-3"
      style={{
        borderRadius: 12,
        padding: '16px 18px',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={member.name} />
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate" style={{ color: '#1a1a18', letterSpacing: '-0.01em' }}>
            {member.name || 'Unnamed'}
          </div>
          <div className="mt-1.5">
            <RoleBadge role={member.role} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(member)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 transition-all"
            style={{
              borderRadius: 8,
              background: 'rgba(0,0,0,0.04)',
              color: '#1a1a18',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
            aria-label={`Edit ${member.name}`}
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
      </div>
      <div className="text-sm leading-relaxed" style={{ color: '#6b6b66' }}>
        {member.scope || <span style={{ color: '#9b9b94', fontStyle: 'italic' }}>No scope set</span>}
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(member)}
          className="self-start flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: '#9b9b94' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9b94' }}
        >
          <Trash2 size={11} />
          Remove
        </button>
      )}
    </div>
  )
}

function MemberForm({ initial, onSubmit, onCancel, onDelete }) {
  const [name,  setName]  = useState(initial?.name  || '')
  const [role,  setRole]  = useState(initial?.role  || '')
  const [scope, setScope] = useState(initial?.scope || '')

  const canSave = name.trim().length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        onSubmit({
          id: initial?.id,
          name: name.trim(),
          role: role.trim(),
          scope: scope.trim(),
        })
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1a1a18', letterSpacing: '0.08em' }}>
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="text-sm px-3 py-2 outline-none transition-colors"
          style={{
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            color: '#1a1a18',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a1a18' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)' }}
          placeholder="メンバー名"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1a1a18', letterSpacing: '0.08em' }}>
          Role
        </span>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-sm px-3 py-2 outline-none"
          style={{
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            color: '#1a1a18',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a1a18' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)' }}
          placeholder="例: Marketing / B2C CVR"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1a1a18', letterSpacing: '0.08em' }}>
          Scope / 担当範囲
        </span>
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          rows={3}
          className="text-sm px-3 py-2 outline-none resize-none"
          style={{
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            color: '#1a1a18',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a1a18' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)' }}
          placeholder="担当範囲を記述"
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSave}
          className="flex-1 text-sm font-semibold px-4 py-2 transition-all"
          style={{
            borderRadius: 8,
            background: canSave ? '#1a1a18' : 'rgba(0,0,0,0.15)',
            color: '#ffffff',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium px-4 py-2 transition-all"
          style={{
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            color: '#1a1a18',
          }}
        >
          Cancel
        </button>
        {onDelete && initial?.id && (
          <button
            type="button"
            onClick={() => onDelete(initial)}
            className="flex items-center gap-1 text-sm font-medium px-3 py-2 transition-all"
            style={{
              borderRadius: 8,
              background: 'rgba(220,38,38,0.06)',
              color: '#dc2626',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)' }}
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>
    </form>
  )
}

export default function TeamPage() {
  const [team, setTeam]         = useState(() => loadTeam())
  const [editing, setEditing]   = useState(null) // member | 'new' | null

  useEffect(() => {
    saveTeam(team)
  }, [team])

  const handleSave = (payload) => {
    setTeam((prev) => {
      if (payload.id) {
        return prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m))
      }
      return [...prev, { ...payload, id: `mem-${Date.now()}` }]
    })
    setEditing(null)
  }

  const handleDelete = (member) => {
    if (!confirm(`Remove ${member.name}?`)) return
    setTeam((prev) => prev.filter((m) => m.id !== member.id))
    setEditing(null)
  }

  const handleReset = () => {
    if (!confirm('Reset team to defaults? All local edits will be lost.')) return
    setTeam(seedData)
  }

  const modalTitle = useMemo(() => {
    if (editing === 'new') return 'Add member'
    if (editing?.name)     return `Edit · ${editing.name}`
    return 'Edit member'
  }, [editing])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#1a1a18', color: '#ffffff' }}
          >
            <Users size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#1a1a18', letterSpacing: '-0.01em' }}>
              Team
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#9b9b94' }}>
              {team.length} members · edits saved locally
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-all"
            style={{
              borderRadius: 8,
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              color: '#6b6b66',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#1a1a18'; e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b6b66'; e.currentTarget.style.background = '#ffffff' }}
            title="Reset to defaults"
          >
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 transition-all"
            style={{
              borderRadius: 8,
              background: '#1a1a18',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#333333' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a18' }}
          >
            <Plus size={14} />
            Add member
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {team.length === 0 ? (
        <div
          className="rounded-xl text-sm text-center"
          style={{
            borderRadius: 12,
            padding: '32px 16px',
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.06)',
            color: '#9b9b94',
          }}
        >
          No members. Click <strong style={{ color: '#1a1a18' }}>Add member</strong> to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {team.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onEdit={(member) => setEditing(member)}
            />
          ))}
        </div>
      )}

      {/* Edit / Add modal */}
      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={modalTitle}
        size="sm"
      >
        {editing && (
          <MemberForm
            initial={editing === 'new' ? null : editing}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            onDelete={editing === 'new' ? null : handleDelete}
          />
        )}
      </Modal>
    </div>
  )
}
