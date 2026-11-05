export function HumanSummary({ paragraphs }) {
  if (!paragraphs || paragraphs.length === 0) return null
  return (
    <section aria-labelledby="summary-heading" className="card p-6 sm:p-8">
      <h2 id="summary-heading" className="text-xl font-semibold text-ink-900 mb-4">
        In human terms
      </h2>
      <div className="space-y-4 max-w-2xl">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-ink-700 leading-relaxed">{p}</p>
        ))}
      </div>
    </section>
  )
}
