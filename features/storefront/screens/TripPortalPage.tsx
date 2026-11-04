import { publicRequest } from '../lib/graphql'
import { dollars, date } from '../lib/format'

/** Client portal: read-only itinerary, what is owed and when, and pay links. No traveler details. */
export async function TripPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let t: any = null, error: string | null = null
  try { t = (await publicRequest(`query($token: String!) { viewTripPortal(token: $token) }`, { token })).viewTripPortal } catch (e: any) { error = e.message }
  if (!t) return <p role="alert" className="text-sm">{error || 'Trip not found'}</p>
  const when = [t.startDate ? date(t.startDate) : '', t.endDate ? date(t.endDate) : ''].filter(Boolean).join(' to ')
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{[t.tripNumber, when].filter(Boolean).join(' · ')}</p>
      </header>

      <section aria-labelledby="balance" className="space-y-2 rounded-md border p-3">
        <h2 id="balance" className="font-medium">Balance</h2>
        {t.balanceCents > 0
          ? <p className="text-sm"><span className="text-lg font-semibold">{dollars(t.balanceCents, t.currencyCode)}</span> due{t.nextDueAt ? <> · next due {date(t.nextDueAt)}</> : null}</p>
          : <p className="text-sm">Nothing is due right now.</p>}
        {t.invoices.length ? (
          <ul className="divide-y text-sm">
            {t.invoices.map((i: any) => (
              <li key={i.number} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0"><span className="block font-mono text-xs uppercase tracking-wide">{i.number}</span><span className="block text-muted-foreground">{i.status === 'paid' ? `${dollars(i.totalCents, i.currencyCode)} received` : `${dollars(i.totalCents - i.collectedCents, i.currencyCode)} due ${date(i.dueAt)}`}</span></span>
                {i.payToken ? <a className="font-medium underline" href={`/invoice/${i.payToken}`}>Pay {i.number}</a> : <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Paid</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No invoices yet.</p>}
      </section>

      <section aria-labelledby="itinerary" className="space-y-3">
        <h2 id="itinerary" className="font-medium">Itinerary</h2>
        {t.days.length ? t.days.map((d: any, n: number) => (
          <div key={n} className="space-y-1 rounded-md border p-3">
            <h3 className="text-sm font-medium">{[d.date ? date(d.date) : '', d.title].filter(Boolean).join(' · ')}</h3>
            {d.items.length ? <ul className="space-y-1 text-sm">{d.items.map((it: any, j: number) => <li key={j}>{[it.time, it.title].filter(Boolean).join(' ')}{it.location ? <span className="text-muted-foreground"> · {it.location}</span> : null}{it.notes ? <span className="block text-muted-foreground">{it.notes}</span> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">No items yet.</p>}
          </div>
        )) : <p className="text-sm text-muted-foreground">Your advisor has not added the day-by-day plan yet.</p>}
      </section>
      <p className="text-xs text-muted-foreground print:hidden">Use your browser's print option for a paper copy.</p>
    </div>
  )
}
