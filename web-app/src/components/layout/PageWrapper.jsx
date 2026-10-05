import { Navbar } from './Navbar.jsx'
import { Sidebar } from './Sidebar.jsx'

// Shared authenticated-page chrome: skip link, navbar, sidebar, main landmark.
export function PageWrapper({ title, actions, children, withSidebar = true }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <div className="flex flex-1">
        {withSidebar && <Sidebar />}
        <main id="main-content" className="flex-1 p-6 max-w-6xl mx-auto w-full">
          {(title || actions) && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              {title && <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>}
              {actions}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
