// A small, made-up shop for the landing page demo. It is built with the
// everyday mistakes real shops make, on purpose: stock shown only by a
// coloured dot, tiny buttons packed together, pale grey text, icon buttons
// with no name. Each `sr` string is what a screen reader would say.

export const PRODUCTS = [
  { id: 'canvas', name: 'Canvas Low', price: '£64', inStock: false, colour: '#c2410c', shoe: '#ef4444' },
  { id: 'trail', name: 'Trail Runner', price: '£89', inStock: true, colour: '#15803d', shoe: '#3b82f6' },
  { id: 'court', name: 'Court Classic', price: '£72', inStock: false, colour: '#c2410c', shoe: '#f5f5f4' }
]

function Shoe({ color }) {
  return (
    <svg viewBox="0 0 120 64" className="h-16 w-auto" aria-hidden="true">
      <path d="M8 44c0-8 6-12 14-14l22-6c6-2 10-8 14-14 2-3 6-4 9-2l10 8c6 5 14 8 22 10 8 2 13 7 13 14v6H8z" fill={color} stroke="#1f2937" strokeWidth="2" />
      <path d="M8 50h104v5c0 2-2 4-4 4H12c-2 0-4-2-4-4z" fill="#e7e5e4" stroke="#1f2937" strokeWidth="2" />
      <path d="M46 26l8 8M54 22l8 8M62 18l7 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// T renders text (the Dyslexia view swaps letters inside it).
export function DemoShop({ T = (s) => s, onAdd, onSave, basket, toast }) {
  return (
    <div className="relative h-full select-none bg-[#fbfaf8] text-[#1c1917]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
        <span className="text-lg font-bold tracking-tight" data-sr="Northwind, link">{T('Northwind')}</span>
        <nav className="hidden gap-5 text-[13px] text-stone-500 sm:flex">
          <span data-sr="Women, link">{T('Women')}</span>
          <span data-sr="Men, link">{T('Men')}</span>
          <span data-sr="Sale, link">{T('Sale')}</span>
        </nav>
        <div className="flex items-center gap-3">
          <button type="button" data-sr="button" className="h-7 w-7 rounded-full text-stone-600 hover:bg-stone-100" tabIndex={-1}>
            <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          <span data-sr={`Basket, ${basket} items`} className="relative inline-flex h-7 items-center rounded-full bg-stone-900 px-3 text-[12px] font-semibold text-white">
            {T('Basket')} {basket}
          </span>
        </div>
      </div>

      <div className="px-5 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400" data-sr="Spring edit">{T('Spring edit')}</p>
        <h3 className="mt-1 text-xl font-semibold" data-sr="Running and everyday shoes, heading level 2">{T('Running and everyday shoes')}</h3>
        <p className="mt-1 text-[12px] text-stone-400" data-sr="">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#15803d] align-middle" />{T('in stock')}
          <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-[#c2410c] align-middle" />{T('sold out')}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 py-4">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-3" data-sr={`${p.name}, ${p.price}`}>
            <div className="flex h-20 items-center justify-center rounded-lg bg-stone-100">
              <Shoe color={p.shoe} />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: p.colour }} data-sr="" />
              <span className="truncate text-[13px] font-medium">{T(p.name)}</span>
            </div>
            <p className="text-[12px] text-stone-400">{p.price}</p>
            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                data-sr="Add, button"
                data-product={p.id}
                onClick={() => onAdd?.(p)}
                className="h-[22px] rounded bg-stone-900 px-2 text-[10px] font-semibold text-white hover:bg-stone-700"
              >
                {T('Add')}
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-sr="button"
                onClick={() => onSave?.(p)}
                className="h-[22px] w-[22px] rounded border border-stone-300 text-[11px] text-stone-500 hover:bg-stone-100"
              >
                ♡
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="px-5 pb-4 text-[11px] leading-relaxed text-stone-400" data-sr="Free returns within 30 days. Orders before 2pm ship today.">
        {T('Free returns within 30 days. Orders before 2pm ship today. Sizes run small, so most customers order half a size up.')}
      </p>

      {toast && (
        <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[12px] font-semibold text-white shadow-lg ${toast.tone === 'good' ? 'bg-emerald-700' : 'bg-stone-900'}`}>
          {toast.text}
        </div>
      )}
    </div>
  )
}
