'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'
import { buildProposalPayload, depositBpsFromPercent, draftFromProposal, ITEM_KINDS, type DraftOption } from '../../lib/proposal-draft'

const blankItem = () => ({ title: '', kind: 'hotel', sell: '', commissionPct: '' })
const blankOption = (): DraftOption => ({ title: '', items: [blankItem()] })

/** Authors a new draft proposal version: options with priced items and estimated commission. */
export function ProposalBuilder({ tripId, currencyCode, draft }: { tripId: string; currencyCode: string; draft?: { id: string; version: number; introNote: string; depositBps?: number; options: Parameters<typeof draftFromProposal>[0]['options'] } }) {
  const [open, setOpen] = useState(false), [deposit, setDeposit] = useState(draft?.depositBps ? String(draft.depositBps / 100) : ''), [intro, setIntro] = useState(draft?.introNote || ''), [options, setOptions] = useState<DraftOption[]>(draft ? draftFromProposal(draft) : [blankOption()])
  const [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const patchOption = (i: number, fn: (o: DraftOption) => DraftOption) => setOptions(options.map((o, k) => (k === i ? fn(o) : o)))
  const submit = () => start(async () => {
    setError('')
    const payload = buildProposalPayload(intro, options)
    if (!payload.ok) return setError(payload.error)
    const depositBps = depositBpsFromPercent(deposit)
    if (depositBps === null) return setError('Deposit must be 0 to 100 percent with at most two decimals')
    const r = await runOperator(draft ? 'updateProposalDraft' : 'buildProposal', draft ? { proposalId: draft.id, currencyCode, introNote: payload.introNote, depositBps, options: payload.options } : { tripId, currencyCode, introNote: payload.introNote, depositBps, options: payload.options })
    if (!r.success) return setError(r.error)
    setOpen(false); if (!draft) { setIntro(''); setOptions([blankOption()]) }; router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>{draft ? 'Edit draft' : 'New proposal'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(36rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>{draft ? `Edit draft version ${draft.version}` : 'New proposal draft'}</DialogTitle><DialogDescription className="sr-only">Create a draft proposal with options and priced items.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="proposal-intro">Introduction for the client</Label><Textarea id="proposal-intro" value={intro} onChange={(e) => setIntro(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="proposal-deposit">Deposit invoiced on acceptance (% of chosen option)</Label><Input id="proposal-deposit" inputMode="decimal" placeholder="0 for none" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
        {options.map((o, oi) => <div key={oi} className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1"><Label htmlFor={`option-${oi}`}>Option {oi + 1} title</Label><Input id={`option-${oi}`} value={o.title} onChange={(e) => patchOption(oi, (x) => ({ ...x, title: e.target.value }))} /></div>
          {o.items.map((it, ii) => <div key={ii} className="space-y-2 border-t pt-3">
            <Input aria-label={`Option ${oi + 1} item ${ii + 1} title`} placeholder="Item title" value={it.title} onChange={(e) => patchOption(oi, (x) => ({ ...x, items: x.items.map((y, k) => (k === ii ? { ...y, title: e.target.value } : y)) }))} />
            <select aria-label={`Option ${oi + 1} item ${ii + 1} kind`} className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={it.kind} onChange={(e) => patchOption(oi, (x) => ({ ...x, items: x.items.map((y, k) => (k === ii ? { ...y, kind: e.target.value } : y)) }))}>{ITEM_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label={`Option ${oi + 1} item ${ii + 1} price`} placeholder={`Price (${currencyCode})`} inputMode="decimal" value={it.sell} onChange={(e) => patchOption(oi, (x) => ({ ...x, items: x.items.map((y, k) => (k === ii ? { ...y, sell: e.target.value } : y)) }))} />
              <Input aria-label={`Option ${oi + 1} item ${ii + 1} commission percent`} placeholder="Commission %" inputMode="decimal" value={it.commissionPct} onChange={(e) => patchOption(oi, (x) => ({ ...x, items: x.items.map((y, k) => (k === ii ? { ...y, commissionPct: e.target.value } : y)) }))} />
            </div>
            {o.items.length > 1 ? <Button variant="ghost" size="sm" onClick={() => patchOption(oi, (x) => ({ ...x, items: x.items.filter((_, k) => k !== ii) }))}>Remove item</Button> : null}
          </div>)}
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => patchOption(oi, (x) => ({ ...x, items: [...x.items, blankItem()] }))}>Add item</Button>{options.length > 1 ? <Button variant="ghost" size="sm" onClick={() => setOptions(options.filter((_, k) => k !== oi))}>Remove option</Button> : null}</div>
        </div>)}
        <Button variant="outline" size="sm" onClick={() => setOptions([...options, blankOption()])}>Add option</Button>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <div><Button disabled={pending} onClick={submit}>{pending ? 'Saving' : draft ? 'Save changes' : 'Save draft'}</Button></div>
      </div></DialogContent></Dialog></>
}
