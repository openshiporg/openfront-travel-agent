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
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Invoice {i.number}</h1>
      <p className="text-sm text-muted-foreground">{i.trip.title} · Trip code {i.trip.tripNumber} · due {date(i.dueAt)}</p>
      <ul className="divide-y rounded-md border">
        {i.lines.map((l: any, n: number) => <li key={n} className="flex justify-between gap-3 p-3 text-sm"><span>{l.description}</span><span>{dollars(l.amountCents, i.currencyCode)}</span></li>)}
        <li className="flex justify-between gap-3 p-3 font-medium"><span>{i.status === 'paid' ? 'Paid' : 'Balance'}</span><span>{i.status === 'paid' ? dollars(i.collectedCents, i.currencyCode) : dollars(due, i.currencyCode)}</span></li>
        {i.refundedCents > 0 ? <li className="flex justify-between gap-3 p-3 text-sm"><span>Refunded</span><span>{dollars(i.refundedCents, i.currencyCode)}</span></li> : null}
      </ul>
      {payment_intent ? <ConfirmPayment token={token} paymentIntentId={payment_intent} /> : null}
      {i.status === 'paid' ? <div className="space-y-1 rounded-md border p-3 text-sm"><p role="status">{i.refundedCents > 0 ? `Partially refunded: ${dollars(i.refundedCents, i.currencyCode)} of ${dollars(i.collectedCents, i.currencyCode)} returned.` : 'Paid in full.'}</p><p>Confirmation code: <span className="font-mono">{i.number}</span></p><p>Trip code: <span className="font-mono">{i.trip.tripNumber}</span></p></div> : i.status === 'refunded' ? <div className="rounded-md border p-3 text-sm"><p role="status">This payment was refunded.</p></div> : i.trip.status === 'cancelled' ? <div className="rounded-md border p-3 text-sm"><p role="status">This trip was cancelled, so this invoice can no longer be paid.</p></div> : !payment_intent && due > 0 ? <PayInvoice token={token} publishableKey={await stripePublishableKey()} /> : null}
    </div>
  )
}
