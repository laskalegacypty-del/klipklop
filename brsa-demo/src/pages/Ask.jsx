import { Barry } from './Barry'

export function Ask() {
  return (
    <div className="min-h-screen bg-dust-100">
      <header className="border-b border-dust-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-4 sm:px-6">
          <img src="/brsa-logo-black.png" alt="BRSA" className="h-9 w-9 rounded-sm" />
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold text-charcoal">BRSA</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Barrel Racing SA</p>
          </div>
        </div>
      </header>

      <div className="overflow-hidden bg-charcoal">
        <div className="h-1.5 bg-brand-400" />
        <div className="h-1 bg-season" />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-12 text-center sm:px-6">
          <img
            src="/barry-avatar.png"
            alt="Barry"
            className="h-32 w-32 rounded-full border-4 border-season object-cover shadow-2xl sm:h-40 sm:w-40"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-season">BRSA's rules assistant</p>
            <h1 className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl">Meet Barry</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-stone-300 sm:text-base">
              Ask about membership, 1D–5D cuts, payouts, protests, or anything else in the BRSA rulebook — day or night.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Barry compact />
      </div>
    </div>
  )
}
