import { useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2 } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/AppContext'
import { calendarTodayDot } from '../config/theme'

// Warm-toned event color palette
const EVENT_COLORS = {
  red:    { dot: '#A93226', chip: { bg: 'rgba(220,38,38,0.10)',  color: '#A93226',  border: 'rgba(220,38,38,0.2)' } },
  gold:   { dot: '#1a1a18', chip: { bg: 'rgba(0,0,0,0.06)', color: '#333333',  border: 'rgba(0,0,0,0.10)' } },
  teal:   { dot: '#2D5B6B', chip: { bg: 'rgba(45,91,107,0.10)',  color: '#2D5B6B',  border: 'rgba(45,91,107,0.2)' } },
  green:  { dot: '#16a34a', chip: { bg: 'rgba(61,122,92,0.10)',  color: '#16a34a',  border: 'rgba(61,122,92,0.2)' } },
  amber:  { dot: '#1a1a18', chip: { bg: 'rgba(0,0,0,0.04)', color: '#333333',  border: 'rgba(0,0,0,0.06)' } },
  purple: { dot: '#7B5EA7', chip: { bg: 'rgba(123,94,167,0.10)', color: '#7B5EA7',  border: 'rgba(123,94,167,0.2)' } },
  indigo: { dot: '#3D5A8A', chip: { bg: 'rgba(61,90,138,0.10)',  color: '#3D5A8A',  border: 'rgba(61,90,138,0.2)' } },
  orange: { dot: '#C06030', chip: { bg: 'rgba(192,96,48,0.10)',  color: '#C06030',  border: 'rgba(192,96,48,0.2)' } },
  slate:  { dot: '#9b9b94', chip: { bg: 'rgba(107,101,96,0.08)', color: '#9b9b94',  border: 'rgba(107,101,96,0.15)' } },
  blue:   { dot: '#2D5B6B', chip: { bg: 'rgba(45,91,107,0.10)',  color: '#2D5B6B',  border: 'rgba(45,91,107,0.2)' } },
}

const COLOR_OPTIONS = ['red', 'gold', 'teal', 'green', 'amber', 'purple', 'indigo', 'orange', 'slate', 'blue']

const BLANK_EVENT = { title: '', date: '', project: '', color: 'teal', notes: '' }

function EventForm({ value, onChange, projects }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Title</label>
        <input className="input" value={value.title} onChange={(e) => set('title', e.target.value)} placeholder="Meeting title..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={value.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className="w-6 h-6 rounded-full transition-all"
                style={{
                  background: EVENT_COLORS[c]?.dot || '#9b9b94',
                  opacity: value.color === c ? 1 : 0.5,
                  outline: value.color === c ? '2px solid #1a1a18' : 'none',
                  outlineOffset: '2px',
                  transform: value.color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="label">Linked Project</label>
        <select className="input" value={value.project || ''} onChange={(e) => set('project', e.target.value || null)}>
          <option value="">— None —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none h-16" value={value.notes || ''} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </div>
  )
}

function EventDetail({ event, onEdit, onDelete, onClose, projects }) {
  const c = EVENT_COLORS[event.color] || EVENT_COLORS.teal
  const project = projects.find((p) => p.id === event.project)
  return (
    <div className="space-y-3">
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{ background: c.chip.bg, color: c.chip.color, border: `1px solid ${c.chip.border}`, borderRadius: 20 }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
        {event.color}
      </div>
      <div>
        <div className="text-xs mb-0.5" style={{ color: '#9b9b94' }}>Date</div>
        <div className="text-sm" style={{ color: '#1a1a18' }}>{format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}</div>
      </div>
      {project && (
        <div>
          <div className="text-xs mb-0.5" style={{ color: '#9b9b94' }}>Project</div>
          <div className="text-sm" style={{ color: '#1a1a18' }}>{project.name}</div>
        </div>
      )}
      {event.notes && (
        <div>
          <div className="text-xs mb-0.5" style={{ color: '#9b9b94' }}>Notes</div>
          <div className="text-sm" style={{ color: '#9b9b94' }}>{event.notes}</div>
        </div>
      )}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: '#1a1a18' }}
        >
          <Edit2 size={12} /> Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs font-medium ml-auto"
          style={{ color: '#dc2626' }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}

export default function CalendarView() {
  const { events, projects, addEvent, updateEvent, deleteEvent } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [modal, setModal] = useState(null)

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }),
  })

  const eventsOnDay = (day) =>
    events.filter((e) => e.date && isSameDay(parseISO(e.date), day))

  const openAdd = (date) =>
    setModal({ mode: 'add', data: { ...BLANK_EVENT, date: format(date, 'yyyy-MM-dd') } })

  const openView = (event) =>
    setModal({ mode: 'view', data: event })

  const openEdit = (event) =>
    setModal({ mode: 'edit', data: { ...event } })

  const closeModal = () => setModal(null)

  const handleSave = () => {
    if (!modal.data.title.trim() || !modal.data.date) return
    if (modal.mode === 'add') addEvent(modal.data)
    else updateEvent(modal.data.id, modal.data)
    closeModal()
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this event?')) {
      deleteEvent(id)
      closeModal()
    }
  }

  return (
    <div className="space-y-4">
      {/* Calendar card */}
      <div
        className="overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <h2
            className="text-base font-medium"
            style={{ color: '#1a1a18' }}
          >
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#9b9b94' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0efe9' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: '#9b9b94' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0efe9' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#9b9b94' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0efe9' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium py-3" style={{ color: '#9b9b94' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvents = eventsOnDay(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDate = isToday(day)

            return (
              <div
                key={i}
                className="min-h-[96px] p-1.5 cursor-pointer transition-colors group"
                style={{
                  borderRight: i % 7 !== 6 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  opacity: !isCurrentMonth ? 0.3 : 1,
                }}
                onMouseEnter={(e) => { if (isCurrentMonth) e.currentTarget.style.background = '#F9F9F9' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                onClick={() => isCurrentMonth && openAdd(day)}
              >
                <div
                  className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1"
                  style={{
                    // Step 6: today's date dot adopts HUS terracotta accent (see src/config/theme.js).
                    background: isTodayDate ? calendarTodayDot.bg : 'transparent',
                    color: isTodayDate ? calendarTodayDot.fg : '#9b9b94',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {format(day, 'd')}
                </div>

                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt) => {
                    const c = EVENT_COLORS[evt.color] || EVENT_COLORS.teal
                    return (
                      <button
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); openView(evt) }}
                        className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate leading-snug transition-opacity hover:opacity-75"
                        style={{
                          background: c.chip.bg,
                          color: c.chip.color,
                          border: `1px solid ${c.chip.border}`,
                        }}
                      >
                        {evt.title}
                      </button>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs px-1" style={{ color: '#9b9b94' }}>+{dayEvents.length - 3} more</div>
                  )}
                  {dayEvents.length === 0 && isCurrentMonth && (
                    <div
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-xs px-1 transition-opacity"
                      style={{ color: '#9b9b94' }}
                    >
                      <Plus size={10} /> Add
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#9b9b94' }}>
        {projects.slice(0, 6).map((p) => {
          const colorMap = {
            'proj-001': 'red', 'proj-002': 'blue', 'proj-003': 'green',
            'proj-004': 'amber', 'proj-005': 'purple', 'proj-006': 'teal',
            'proj-007': 'indigo', 'proj-008': 'orange',
          }
          const color = colorMap[p.id] || 'slate'
          return (
            <span key={p.id} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: EVENT_COLORS[color]?.dot || '#9b9b94' }} />
              {p.name}
            </span>
          )
        })}
      </div>

      {/* View modal */}
      <Modal isOpen={modal?.mode === 'view'} onClose={closeModal} title={modal?.data?.title || 'Event'} size="sm">
        {modal?.mode === 'view' && (
          <EventDetail
            event={modal.data}
            onEdit={() => openEdit(modal.data)}
            onDelete={() => handleDelete(modal.data.id)}
            onClose={closeModal}
            projects={projects}
          />
        )}
      </Modal>

      {/* Add/Edit modal */}
      <Modal
        isOpen={modal?.mode === 'add' || modal?.mode === 'edit'}
        onClose={closeModal}
        title={modal?.mode === 'add' ? 'Add Event' : 'Edit Event'}
        size="md"
      >
        {(modal?.mode === 'add' || modal?.mode === 'edit') && (
          <>
            <EventForm value={modal.data} onChange={(data) => setModal((m) => ({ ...m, data }))} projects={projects} />
            <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <button onClick={closeModal} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                {modal?.mode === 'add' ? 'Add Event' : 'Save'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
