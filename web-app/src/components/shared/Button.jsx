import { forwardRef } from 'react'

const VARIANTS = {
  primary: 'bg-ink-900 text-paper hover:bg-ink-700 disabled:bg-ink-400',
  dark: 'bg-ink-900 text-paper hover:bg-ink-700 disabled:bg-ink-400',
  ember: 'bg-ember-600 text-white hover:bg-ember-700 disabled:bg-ink-400',
  secondary: 'bg-white text-ink-900 border border-ink-900/20 hover:border-ink-900/60 disabled:text-ink-400',
  danger: 'bg-white text-ember-700 border border-ember-600/40 hover:bg-ember-50 disabled:text-ink-400',
  ghost: 'bg-transparent text-brand-700 underline-offset-4 hover:underline disabled:text-ink-400'
}

const SIZES = {
  // min 24×24 target (WCAG 2.2, 2.5.8); md/lg comfortably exceed it
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-5 py-2.5 text-[15px] min-h-[46px]'
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', type = 'button', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[4px] font-medium
        transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
