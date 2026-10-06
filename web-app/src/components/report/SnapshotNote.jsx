// A report is a snapshot of one visit: when it ran, and that the same page
// can give different results on different days. The note text comes from the
// backend (config/copy.js) so the web report, the shared report and the PDF
// say the same thing; the date is shown in the viewer's own time zone.
export function formatRanAt(ranAt, { locale, timeZone } = {}) {
  const date = new Date(ranAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(locale, {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone
  })
}

export function SnapshotNote({ ranAt, note, locale, timeZone }) {
  const when = formatRanAt(ranAt, { locale, timeZone })
  if (!when && !note) return null
  return (
    <p className="text-sm text-ink-600">
      {when ? `Run on ${when}. ` : ''}{note}
    </p>
  )
}
