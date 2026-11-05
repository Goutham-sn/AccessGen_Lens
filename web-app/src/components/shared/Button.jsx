import { forwardRef } from 'react'

const VARIANTS = {
  primary: 'bg-brand-700 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none',
  dark: 'bg-ink-900 text-white hover:bg-ink-700 disabled:bg-gray-300 disabled:text-gray-600',
  ember: 'bg-ember-600 text-white shadow-sm shadow-ember-800/20 hover:bg-ember-700 disabled:bg-gray-300 disabled:text-gray-600',
  secondary: 'bg-white text-ink-700 border border-black/10 hover:bg-gray-50 hover:border-black/20 disabled:text-gray-400',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-gray-300 disabled:text-gray-600',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50 disabled:text-gray-400'
}

const SIZES = {
  // min 24×24 target (WCAG 2.2, 2.5.8); md/lg comfortably exceed it
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-6 py-3 text-base min-h-[50px]'
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', type = 'button', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium
        transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
