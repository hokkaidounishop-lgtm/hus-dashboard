import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.40)' }}
        onClick={onClose}
      />
      <div
        className={`relative w-full ${SIZES[size]} max-h-[90vh] flex flex-col`}
        style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 25px 60px 0 rgba(0,0,0,0.15)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <h2
            className="text-base font-semibold"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              color: '#1A1A1A',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-all"
            style={{ color: '#999999' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
              e.currentTarget.style.color = '#1A1A1A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#999999'
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
