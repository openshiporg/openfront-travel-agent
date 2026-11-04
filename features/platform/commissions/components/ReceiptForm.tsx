'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'
import { toCents } from '../../lib/cents'
import { planReceipt, type OpenComponent } from '../../lib/receipt-plan'

const fmt = (cents: number, cur: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100)

/** Record a supplier commission receipt and allocate it across that supplier's open components. */
export function ReceiptForm({ components }: { components: OpenComponent[] }) {
  const [open, setOpen] = useState(false)
  const suppliers = useMemo(() => [...new Map(components.map((c) => [c.supplierId, c.supplierName])).entries()], [components])
  const [supplierId, setSupplierId] = useState(''), [reference, setReference] = useState(''), [amounts, setAmounts] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const rows = components.filter((c) => c.supplierId === supplierId)
  const submit = () => start(async () => {
    setError('')
    const plan = planReceipt(rows, amounts, reference, toCents)
    if (!plan.ok) return setError(plan.error)
    const r = await runOperator('recordCommissionReceipt', { supplierId, reference: plan.reference, amountCents: plan.amountCents, currencyCode: plan.currencyCode, allocations: plan.allocations })
    if (!r.success) return setError(r.error)
    setOpen(false); setAmounts({}); setReference(''); router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!components.length}>Record receipt</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>Record commission receipt</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="receipt-supplier">Supplier</Label><select id="receipt-supplier" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setAmounts({}) }}><option value="">Choose</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="receipt-reference">Reference (statement or deposit)</Label><Input id="receipt-reference" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        {rows.map((c) => <div key={c.id} className="space-y-1"><Label htmlFor={`alloc-${c.id}`}>{c.title} · {c.tripTitle} · {fmt(c.remainingCents, c.currencyCode)} outstanding</Label><Input id={`alloc-${c.id}`} inputMode="decimal" placeholder="0.00" value={amounts[c.id] || ''} onChange={(e) => setAmounts({ ...amounts, [c.id]: e.target.value })} /></div>)}
        {supplierId && !rows.length ? <p className="text-sm text-muted-foreground">No open commissions for this supplier.</p> : null}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={pending || !supplierId} onClick={submit}>{pending ? 'Saving' : 'Record receipt'}</Button>
      </div></DialogContent></Dialog></>
}
