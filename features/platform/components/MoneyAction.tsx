'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { runOperator } from '../actions/operators'
import { requestApproval } from '../actions/approvals'
import { matchingApproval, type ApprovalCandidate } from '../lib/approval-match'

type Kind = 'refund' | 'writeoff'

/** Refund a payment or write off a commission. Over the threshold (or always, for write-offs) it needs an approved request from another person. */
export function MoneyAction({ kind, targetId, maxCents, thresholdCents, approvedId: fixedApprovalId, approvals = [], actorId = '', label }: {
  kind: Kind; targetId: string; maxCents: number; thresholdCents?: number; approvedId?: string | null; approvals?: ApprovalCandidate[]; actorId?: string; label: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dollars, setDollars] = useState(kind === 'refund' ? '' : String(maxCents / 100))
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const cents = Math.round(Number(dollars || 0) * 100)
  const needsApproval = kind === 'writeoff' || cents > (thresholdCents ?? 50000)

  const approvedId = kind === 'refund' ? matchingApproval(approvals, { actionType: 'refund_payment', targetId, amountCents: cents, reason, actorId }) : fixedApprovalId

  const submit = () => start(async () => {
    setError(null); setNote(null)
    if (!reason.trim()) return setError('Reason required')
    if (kind === 'refund' && (!Number.isFinite(cents) || cents < 1 || cents > maxCents)) return setError('Enter an amount up to what is still refundable')
    const actionType = kind === 'refund' ? 'refund_payment' : 'commission_writeoff'
    if (needsApproval && !approvedId) {
      const r = await requestApproval({ actionType, targetId, amountCents: kind === 'refund' ? cents : maxCents, reason })
      if (!r.success) return setError(r.error)
      setNote('Approval requested. Another person must approve it on the Approvals page, then repeat this action.')
      return
    }
    const input = kind === 'refund'
      ? { paymentId: targetId, amountCents: cents, reason, approvalId: approvedId || undefined }
      : { componentId: targetId, reason, approvalId: approvedId }
    const r = await runOperator(kind === 'refund' ? 'refundClientPayment' : 'writeOffCommission', input)
    if (!r.success) return setError(r.error)
    if (kind === 'refund' && r.data?.status !== 'succeeded') {
      setNote(r.data?.status === 'failed' ? 'Refund failed. No refund was posted.' : 'Refund pending reconciliation. Do not submit another refund.')
      router.refresh()
      return
    }
    setOpen(false); router.refresh()
  })

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(26rem,calc(100vw-2rem))]">
          <DialogHeader><DialogTitle>{kind === 'refund' ? 'Refund payment' : 'Write off commission'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {kind === 'refund' ? (
              <div className="space-y-1"><Label htmlFor="amt">Amount (USD), up to {(maxCents / 100).toFixed(2)}</Label><Input id="amt" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} /></div>
            ) : <p className="text-sm">Gives up {(maxCents / 100).toFixed(2)} of expected commission.</p>}
            <div className="space-y-1"><Label htmlFor="why">Reason</Label><Input id="why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
            {needsApproval ? <p className="text-xs text-muted-foreground">{approvedId ? 'An approval is ready and will be used once.' : 'This needs approval from another person.'}</p> : null}
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            {note ? <p role="status" className="text-sm">{note}</p> : null}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button><Button disabled={pending} onClick={submit}>{pending ? 'Working' : needsApproval && !approvedId ? 'Request approval' : 'Confirm'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
