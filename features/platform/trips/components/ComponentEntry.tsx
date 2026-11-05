'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

const KINDS = ['hotel', 'cruise', 'tour', 'flight', 'transfer', 'rail', 'insurance', 'activity', 'fee']
const MODELS = [{ value: 'client_pays_supplier', label: 'Client pays supplier' }, { value: 'agency_collects', label: 'Agency collects' }]
const cents = (v: string) => (/^\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(Number(v) * 100) : null)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const asLocal = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d) }

function Pick({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><div className="flex gap-2"><Popover><PopoverTrigger asChild><Button variant="outline">{value ? format(asLocal(value), 'MMM d, yyyy') : 'Choose date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={value ? asLocal(value) : undefined} onSelect={(d) => onChange(d ? ymd(d) : '')} /></PopoverContent></Popover>{value ? <Button variant="ghost" onClick={() => onChange('')}>Clear</Button> : null}</div></div>
}

/** Enter a reservation on the trip directly. It starts quoted, then Hold and Book move it on. */
export function ComponentEntry({ tripId, suppliers }: { tripId: string; suppliers: { id: string; name: string; defaultCommissionBps: number }[] }) {
  const blank = { title: '', kind: 'hotel', supplierId: '', paymentModel: 'client_pays_supplier', sell: '', net: '', commission: '', startAt: '', endAt: '' }
  const [open, setOpen] = useState(false), [v, setV] = useState(blank), [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const set = (k: keyof typeof blank) => (x: string) => setV((o) => ({ ...o, [k]: x, ...(k === 'supplierId' && !o.commission ? { commission: String((suppliers.find((s) => s.id === x)?.defaultCommissionBps || 0) / 100) } : {}) }))
  const submit = () => start(async () => {
    setError('')
    if (!v.title.trim()) return setError('Title is required')
    const sellCents = cents(v.sell); if (sellCents === null) return setError('Sell price: enter an amount with at most two decimals')
    const netCostCents = v.net.trim() ? cents(v.net) : 0; if (netCostCents === null) return setError('Net cost: enter an amount with at most two decimals')
    const pct = v.commission.trim() ? v.commission.trim() : '0'; if (!/^\d+(\.\d{1,2})?$/.test(pct) || Number(pct) > 100) return setError('Commission must be 0 to 100 percent with at most two decimals')
    const r = await runOperator('addTripComponent', { tripId, title: v.title, kind: v.kind, supplierId: v.supplierId || null, paymentModel: v.paymentModel, sellCents, netCostCents, commissionBps: Math.round(Number(pct) * 100), startAt: v.startAt || null, endAt: v.endAt || null })
    if (!r.success) return setError(r.error)
    setOpen(false); setV(blank); router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Add component</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(30rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>Add component</DialogTitle><DialogDescription className="sr-only">Enter a reservation on this trip.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="comp-title">Title</Label><Input id="comp-title" value={v.title} onChange={(e) => set('title')(e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Pick id="comp-kind" label="Kind" value={v.kind} onChange={set('kind')} options={KINDS.map((k) => ({ value: k, label: k.replace(/^./, (c) => c.toUpperCase()) }))} /><Pick id="comp-model" label="Payment" value={v.paymentModel} onChange={set('paymentModel')} options={MODELS} /></div>
        <Pick id="comp-supplier" label="Supplier" value={v.supplierId} onChange={set('supplierId')} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1"><Label htmlFor="comp-sell">Sell price</Label><Input id="comp-sell" inputMode="decimal" value={v.sell} onChange={(e) => set('sell')(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="comp-net">Net cost</Label><Input id="comp-net" inputMode="decimal" value={v.net} onChange={(e) => set('net')(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="comp-commission">Commission %</Label><Input id="comp-commission" inputMode="decimal" value={v.commission} onChange={(e) => set('commission')(e.target.value)} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><DateField label="Starts" value={v.startAt} onChange={set('startAt')} /><DateField label="Ends" value={v.endAt} onChange={set('endAt')} /></div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={pending} onClick={submit}>{pending ? 'Saving' : 'Save'}</Button>
      </div></DialogContent></Dialog></>
}
