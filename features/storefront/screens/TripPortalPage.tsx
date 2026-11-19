import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { dollars, date, words } from '../lib/format'
import { Days } from '../components/Days'

/** Client portal: read-only itinerary, what is owed and when, and pay links. No traveler details. */
export async function TripPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let t: any = null
  try { t = (await publicRequest(`query($token: String!) { viewTripPortal(token: $token) }`, { token })).viewTripPortal } catch {}
  if (!t) notFound()
  const when = [t.startDate ? date(t.startDate) : '', t.endDate ? date(t.endDate) : ''].filter(Boolean).join(' to ')
  const firstOpen = t.invoices.find((i: any) => i.payToken && i.totalCents > i.collectedCents)
  return (
    <div className="max-w-3xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-slate-700">{[`Trip code ${t.tripNumber}`, when, words(t.status)].filter(Boolean).join(' · ')}</p>
        {t.partyName ? <p className="text-sm">Payments for <span className="font-medium">{t.partyName}</span></p> : null}
      </header>

      <section aria-labelledby="balance" className="space-y-3">
        <h2 id="balance" className="text-xl font-bold tracking-tight">What you owe</h2>
        {t.balanceCents > 0
          ? <div className="flex flex-wrap items-center gap-x-6 gap-y-3"><p><span className="text-3xl font-bold tracking-tight">{dollars(t.balanceCents, t.currencyCode)}</span>{t.nextDueAt ? <span className="text-sm text-slate-700"> · next payment due {date(t.nextDueAt)}</span> : null}</p>{firstOpen ? <a className="cta" href={`/invoice/${firstOpen.payToken}`}>Pay {firstOpen.number}</a> : null}</div>
          : <p className="text-sm text-slate-700">{t.status === 'cancelled' ? 'This trip was cancelled.' : 'Nothing is due right now.'}</p>}
        {t.invoices.length ? (
          <ul className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
            {t.invoices.map((i: any) => (
              <li key={i.number} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="min-w-0"><span className="block font-medium">{i.number}</span><span className="block text-slate-600">{i.status === 'paid' ? `${dollars(i.totalCents, i.currencyCode)} received${i.refundedCents > 0 ? `, ${dollars(i.refundedCents, i.currencyCode)} refunded` : ''}` : i.status === 'refunded' ? `${dollars(i.totalCents, i.currencyCode)} refunded` : `${dollars(i.totalCents - i.collectedCents, i.currencyCode)} due ${date(i.dueAt)}`}</span></span>
                {i.payToken ? <a className="link inline-flex min-h-11 items-center font-medium" href={`/invoice/${i.payToken}`}>Pay {i.number}</a> : <span className="text-slate-600">{i.status === 'refunded' ? 'Refunded' : i.refundedCents > 0 ? 'Partly refunded' : 'Paid'}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-600">No invoices yet.</p>}
      </section>

      {t.rooms?.length ? (
        <section aria-labelledby="rooms" className="space-y-3">
          <h2 id="rooms" className="text-xl font-bold tracking-tight">Rooms</h2>
          <ul className="divide-y divide-slate-200 border-y border-slate-200 text-sm">{t.rooms.map((r: any, n: number) => <li key={n} className="py-3">{[r.label, r.roomType, `${r.guests} guest${r.guests === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</li>)}</ul>
        </section>
      ) : null}

      <section aria-labelledby="itinerary" className="space-y-3">
        <h2 id="itinerary" className="text-xl font-bold tracking-tight">Itinerary</h2>
        <Days days={t.days} />
      </section>
      <p className="text-sm text-slate-600 print:hidden">Use your browser&apos;s print option for a paper copy.</p>
    </div>
  )
}
