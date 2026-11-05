import { Navbar } from './Navbar.jsx'

// Shared page chrome: skip link, the top bar, the main landmark. The left
// sidebar is gone: everything is in the top bar.
export function PageWrapper({ title, eyebrow, actions, children, wide = false }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main-content" className={`mx-auto w-full flex-1 px-5 py-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>
        {(title || actions) && (
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
            <div>
              {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
              {title && <h1 className="text-2xl font-semibold text-ink-900 sm:text-[28px]">{title}</h1>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
      <footer className="border-t border-rule py-5">
        <p className="mx-auto max-w-7xl px-5 font-mono text-[11px] text-ink-500">
          AccessGen Lens runs on your machine. A simulation is a way in, never the same as a lived experience.
        </p>
      </footer>
    </div>
  )
}
