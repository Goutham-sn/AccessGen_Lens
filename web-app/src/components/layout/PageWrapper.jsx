import { Navbar } from './Navbar.jsx'
import { Sidebar } from './Sidebar.jsx'

// Shared authenticated-page chrome: skip link, navbar, sidebar, main landmark.
export function PageWrapper({ title, actions, children, withSidebar = true }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_20%_0%,rgba(111,92,246,.10),transparent),radial-gradient(40%_50%_at_90%_0%,rgba(255,106,69,.08),transparent)]" />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <div className="flex flex-1">
        {withSidebar && <Sidebar />}
        <main id="main-content" className="flex-1 px-5 py-8 sm:px-8 max-w-6xl mx-auto w-full animate-fade-up">
          {(title || actions) && (
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              {title && <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900">{title}</h1>}
              {actions}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
