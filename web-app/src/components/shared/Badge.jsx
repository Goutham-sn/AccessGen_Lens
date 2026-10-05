const TONES = {
  brand: 'bg-brand-50 text-brand-800 border-brand-200',
  neutral: 'bg-gray-100 text-ink-700 border-gray-300',
  success: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200'
}

export function Badge({ tone = 'brand', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5
      text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
