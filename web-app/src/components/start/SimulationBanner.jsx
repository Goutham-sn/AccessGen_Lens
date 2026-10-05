// The shared intro. The text comes from the backend (config/copy.js), so the
// start page, the reports and the PDF always say the same thing.
export function SimulationBanner({ text, className = '' }) {
  if (!text) return null
  return (
    <section
      aria-label="About this simulation"
      className={`rounded-xl border border-brand-200 bg-brand-50 p-4 text-ink-900 ${className}`}
    >
      <p className="text-base leading-relaxed">{text}</p>
    </section>
  )
}
