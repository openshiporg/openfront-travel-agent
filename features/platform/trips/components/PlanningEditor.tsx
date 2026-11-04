'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><div className="flex gap-2"><Popover><PopoverTrigger asChild><Button variant="outline">{value ? format(new Date(value), 'MMM d, yyyy') : 'Choose date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={value ? new Date(value) : undefined} onSelect={d => onChange(d ? d.toISOString() : '')} /></PopoverContent></Popover><Button variant="ghost" onClick={() => onChange('')}>Clear</Button></div></div>
}
export function PlanningEditor({ tripId, feeCents, currencyCode, component }: { tripId: string; feeCents: number; currencyCode: string; component?: { id: string; depositCents: number; depositDueAt: string | null; finalDueAt: string | null } }) {
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(String((component?.depositCents ?? feeCents) / 100))
  const [deposit, setDeposit] = useState(component?.depositDueAt || ''), [final, setFinal] = useState(component?.finalDueAt || '')
  const [error, setError] = useState(''), [pending, start] = useTransition(); const router = useRouter()
  const save = () => start(async () => {
    setError('')
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) return setError('Enter an amount with at most two decimal places')
    const cents = Math.round(Number(amount) * 100)
    const r = await runOperator(component ? 'updateComponentTerms' : 'updateTripPlanning', component ? { tripId, componentId: component.id, depositCents: cents, depositDueAt: deposit || null, finalDueAt: final || null } : { tripId, planningFeeCents: cents })
    if (!r.success) return setError(r.error)
    setOpen(false); router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>{component ? 'Edit payment terms' : 'Edit planning fee'}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-[min(28rem,calc(100vw-2rem))]"><DialogHeader><DialogTitle>{component ? 'Component payment terms' : 'Planning fee'}</DialogTitle><DialogDescription className="sr-only">Edit the amount and due dates used to build the payment schedule.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-1"><Label htmlFor="planning-amount">{component ? 'Deposit' : 'Planning fee'} ({currencyCode})</Label><Input id="planning-amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" /></div>{component ? <><DateField label="Deposit due" value={deposit} onChange={setDeposit} /><DateField label="Final payment due" value={final} onChange={setFinal} /></> : null}{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}<Button disabled={pending} onClick={save}>{pending ? 'Saving' : 'Save'}</Button></div></DialogContent></Dialog></>
}
