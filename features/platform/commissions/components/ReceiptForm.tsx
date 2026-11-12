'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'
import { requestApproval } from '../../actions/approvals'
import { toCents } from '../../lib/cents'
import { planReceipt, type OpenComponent } from '../../lib/receipt-plan'
import { matchingApproval, pendingApproval, type ApprovalCandidate } from '../../lib/approval-match'

const fmt = (cents: number, cur: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100)

/** Record a supplier commission receipt and allocate it across that supplier's open components. Over-payments need a manager approval. */
export function ReceiptForm({ components, approvals = [], actorId = '' }: { components: OpenComponent[]; approvals?: ApprovalCandidate[]; actorId?: string }) {
  const [open, setOpen] = useState(false)
  const suppliers = useMemo(() => [...new Map(components.map((c) => [c.supplierId, c.supplierName])).entries()], [components])
  const [supplierId, setSupplierId] = useState(''), [reference, setReference] = useState(''), [reason, setReason] = useState(''), [amounts, setAmounts] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const rows = components.filter((c) => c.supplierId === supplierId)
  const preview = planReceipt(rows, amounts, reference || 'preview', toCents, reason || 'preview')
  const needsApproval = preview.ok && preview.overages.length > 0
  const submit = () => start(async () => {
    setError(''); setNotice('')
    const plan = planReceipt(rows, amounts, reference, toCents, reason)
    if (!plan.ok) return setError(plan.error)
    const allocations: { componentId: string; amountCents: number; approvalId?: string; reason?: string }[] = []
    const requested: string[] = [], waiting: string[] = []
    for (const a of plan.allocations) {
      if (a.overCents === 0) { allocations.push({ componentId: a.componentId, amountCents: a.amountCents }); continue }
      const probe = { actionType: 'commission_overpayment', targetId: a.componentId, amountCents: a.overCents, reason: plan.reason, actorId }
      const approvalId = matchingApproval(approvals, probe)
      const title = plan.overages.find((o) => o.componentId === a.componentId)!.title
      if (approvalId) { allocations.push({ componentId: a.componentId, amountCents: a.amountCents, approvalId, reason: plan.reason }); continue }
      if (pendingApproval(approvals, probe)) { waiting.push(title); continue }
      const res = await requestApproval({ actionType: 'commission_overpayment', targetId: a.componentId, amountCents: a.overCents, reason: plan.reason })
      if (!res.success) return setError(`${title}: ${res.error}`)
      requested.push(title)
    }
    if (requested.length || waiting.length) {
      setNotice(`${requested.length ? `Approval requested for ${requested.join(', ')}. ` : ''}${waiting.length ? `Still waiting for approval on ${waiting.join(', ')}. ` : ''}Record the receipt again once a manager approves.`)
      return router.refresh()
    }
    const r = await runOperator('recordCommissionReceipt', { supplierId, reference: plan.reference, amountCents: plan.amountCents, currencyCode: plan.currencyCode, allocations })
    if (!r.success) return setError(r.error)
    setOpen(false); setAmounts({}); setReference(''); setReason(''); router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!components.length}>Record receipt</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>Record commission receipt</DialogTitle><DialogDescription className="sr-only">Record a supplier commission payment and allocate it to open commissions.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="receipt-supplier">Supplier</Label><select id="receipt-supplier" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setAmounts({}) }}><option value="">Choose</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="receipt-reference">Reference (statement or deposit)</Label><Input id="receipt-reference" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        {rows.map((c) => <div key={c.id} className="space-y-1"><Label htmlFor={`alloc-${c.id}`}>{c.title} · {c.tripTitle} · {fmt(c.remainingCents, c.currencyCode)} outstanding</Label><Input id={`alloc-${c.id}`} inputMode="decimal" placeholder="0.00" value={amounts[c.id] || ''} onChange={(e) => setAmounts({ ...amounts, [c.id]: e.target.value })} /></div>)}
        {needsApproval ? <div className="space-y-1"><p className="text-sm">{preview.overages.map((o) => `${o.title}: ${fmt(o.overCents, rows[0]?.currencyCode || 'USD')} over`).join(' · ')}. A manager must approve the over-payment.</p><Label htmlFor="receipt-reason">Reason for the over-payment</Label><Input id="receipt-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div> : null}
        {supplierId && !rows.length ? <p className="text-sm text-muted-foreground">No open commissions for this supplier.</p> : null}
        {notice ? <p role="status" className="text-sm">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={pending || !supplierId} onClick={submit}>{pending ? 'Working' : needsApproval ? 'Record or request approval' : 'Record receipt'}</Button>
      </div></DialogContent></Dialog></>
}
