// Live cognitive load meter, 0–100. Colors are paired with text labels so
// the meaning never relies on color alone.
export function CognitiveMeter({ score = 0 }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const state = clamped < 40 ? 'Calm' : clamped < 70 ? 'Busy' : 'Overwhelming'
  const barColor = clamped < 40 ? 'bg-green-600' : clamped < 70 ? 'bg-ink-900' : 'bg-red-600'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink-900">Cognitive load</h2>
        <span className="text-sm text-ink-700">{state} · {clamped}</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={`Cognitive load: ${clamped} out of 100, ${state.toLowerCase()}`}
        className="h-3 w-full rounded-full bg-paper overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
