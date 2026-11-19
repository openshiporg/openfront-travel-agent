import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { dollars, date } from '../lib/format'
import { PayInvoice } from '../components/PayInvoice'
import { ConfirmPayment } from '../components/ConfirmPayment'
import { stripePublishableKey } from '../actions'

export async function InvoicePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ payment_intent?: string }> }) {
  const [{ token }, { payment_intent }] = await Promise.all([params, searchParams])
  let i: any = null
  try { i = (await publicRequest(`query($token: String!) { viewInvoice(token: $token) }`, { token })).viewInvoice } catch {}
  if (!i) notFound()
  const due = i.totalCents - i.collectedCents
  const box = 'space-y-1 border-t border-slate-200 pt-4 text-sm'
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Invoice {i.number}</h1>
        <p className="text-sm text-slate-700">{[i.trip.title, `Trip code ${i.trip.tripNumber}`, i.dueAt ? `Due ${date(i.dueAt)}` : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <ul className="divide-y divide-slate-200 border-y border-slate-200">
        {i.lines.map((l: any, n: number) => <li key={n} className="flex justify-between gap-3 py-3 text-sm"><span>{l.description}</span><span>{dollars(l.amountCents, i.currencyCode)}</span></li>)}
        {i.collectedCents > 0 && i.status !== 'paid' ? <li className="flex justify-between gap-3 py-3 text-sm"><span>Already paid</span><span>{dollars(i.collectedCents, i.currencyCode)}</span></li> : null}
        <li className="flex justify-between gap-3 py-3 text-lg font-bold"><span>{i.status === 'paid' ? 'Paid' : 'Balance due'}</span><span>{i.status === 'paid' ? dollars(i.collectedCents, i.currencyCode) : dollars(due, i.currencyCode)}</span></li>
        {i.refundedCents > 0 ? <li className="flex justify-between gap-3 py-3 text-sm"><span>Refunded</span><span>{dollars(i.refundedCents, i.currencyCode)}</span></li> : null}
      </ul>
      {payment_intent ? <ConfirmPayment token={token} paymentIntentId={payment_intent} /> : null}
      {i.status === 'paid' ? <div className={box}><p role="status" className="text-base font-semibold">{i.refundedCents > 0 ? `Partially refunded: ${dollars(i.refundedCents, i.currencyCode)} of ${dollars(i.collectedCents, i.currencyCode)} returned.` : 'Paid in full.'}</p><p>Confirmation code: <span className="font-medium">{i.number}</span></p><p>Trip code: <span className="font-medium">{i.trip.tripNumber}</span></p><p className="text-slate-600">Keep these codes. With your email they find this booking under Find my booking.</p></div> : i.status === 'refunded' ? <div className={box}><p role="status">This payment was refunded.</p></div> : i.trip.status === 'cancelled' ? <div className={box}><p role="status">This trip was cancelled, so this invoice can no longer be paid.</p></div> : !payment_intent && due > 0 ? <PayInvoice token={token} publishableKey={await stripePublishableKey()} amount={dollars(due, i.currencyCode)} /> : null}
    </div>
  )
}
