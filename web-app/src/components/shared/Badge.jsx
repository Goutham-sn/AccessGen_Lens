const TONES = {
  brand: 'bg-white text-ink-800 border-rule',
  neutral: 'bg-white text-ink-700 border-rule',
  success: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  ember: 'bg-ember-50 text-ember-800 border-ember-100'
}

export function Badge({ tone = 'brand', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5
      font-mono text-[11px] font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
