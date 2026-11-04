'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

const CHOICES = [['offered', 'Offered, awaiting answer'], ['accepted', 'Accepted'], ['declined', 'Declined (waiver)']] as const

/** Records one insurance answer for a traveler. A decline needs a waiver note, and each answer is kept as history. */
export function InsuranceEditor({ tripId, travelerId, name, current }: { tripId: string; travelerId: string; name: string; current: string }) {
  const [open, setOpen] = useState(false), [decision, setDecision] = useState(current === 'not_offered' ? 'offered' : current), [note, setNote] = useState('')
  const [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const save = () => start(async () => {
    setError('')
    const r = await runOperator('recordInsuranceOffer', { tripId, travelerId, decision, waiverNote: decision === 'declined' ? note : undefined })
    if (!r.success) return setError(r.error || 'Failed')
    setOpen(false); setNote(''); router.refresh()
  })
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Insurance</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>Travel insurance for {name}</DialogTitle><DialogDescription>Each answer is kept with its date. A decline is stored as a waiver.</DialogDescription></DialogHeader>
      <div className="space-y-3"><fieldset className="space-y-1"><legend className="mb-1 text-sm font-medium">Answer</legend>{CHOICES.map(([v, l]) => <label key={v} className="flex items-center gap-2 text-sm"><input type="radio" name={`ins-${travelerId}`} className="h-4 w-4" checked={decision === v} onChange={() => setDecision(v)} />{l}</label>)}</fieldset>
        {decision === 'declined' ? <div className="space-y-1"><Label htmlFor={`waiver-${travelerId}`}>Waiver note</Label><textarea id={`waiver-${travelerId}`} className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why the traveler declined, for example existing annual cover" /></div> : null}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}<Button onClick={save} disabled={pending}>{pending ? 'Saving' : 'Save'}</Button></div></DialogContent></Dialog></>
}
