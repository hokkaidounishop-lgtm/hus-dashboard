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
        style={{ background: 'rgba(22,34,48,0.60)' }}
        onClick={onClose}
      />
      <div
        className={`relative rounded-card w-full ${SIZES[size]} max-h-[90vh] flex flex-col`}
        style={{
          background: '#FFFFFF',
          boxShadow: '0 25px 60px 0 rgba(0,0,0,0.20), 0 0 0 1px rgba(234,231,226,0.6)',
        }}
      >
        {/* Gold accent line at top */}
        <div
          className="h-0.5 rounded-t-card"
          style={{ background: 'linear-gradient(90deg, transparent, #C9A96E, transparent)' }}
        />
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid #EAE7E2' }}
        >
          <h2
            className="text-base font-medium"
            style={{
              fontFamily: '"Noto Serif JP", Georgia, serif',
              color: '#1A1A1A',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: '#9B9590' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F5F3F0'
              e.currentTarget.style.color = '#1A1A1A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#9B9590'
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
