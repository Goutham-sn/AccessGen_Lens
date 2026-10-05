import { forwardRef } from 'react'

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-gray-300 disabled:text-gray-600',
  secondary: 'bg-white text-ink-700 border border-gray-300 hover:bg-gray-100 disabled:text-gray-400',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-gray-300 disabled:text-gray-600',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50 disabled:text-gray-400'
}

const SIZES = {
  // min 24×24 target (WCAG 2.2 — 2.5.8); md/lg comfortably exceed it
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-6 py-3 text-base min-h-[48px]'
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', type = 'button', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
