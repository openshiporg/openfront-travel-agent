'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

type Celebration = { label: string; date: string | null }
export type ProfileValue = { seat: string; room: string; dietary: string; notes: string; celebrations: Celebration[] }

export function ProfileEditor({ clientId, clientName, profile }: { clientId: string; clientName: string; profile: ProfileValue }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState<ProfileValue>(profile)
  const [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const set = (k: 'seat' | 'room' | 'dietary' | 'notes', value: string) => setV((p) => ({ ...p, [k]: value }))
  const setCel = (i: number, patch: Partial<Celebration>) => setV((p) => ({ ...p, celebrations: p.celebrations.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const save = () => start(async () => {
    setError('')
    const r = await runOperator('saveClientProfile', { clientId, ...v, celebrations: v.celebrations.filter((c) => c.label.trim()).map((c) => ({ label: c.label, date: c.date || null })) })
    if (!r.success) return setError(r.error)
    setOpen(false); router.refresh()
  })
  const field = (id: 'seat' | 'room' | 'dietary' | 'notes', label: string, max: number) => <div key={id} className="space-y-1"><Label htmlFor={`pf-${id}`}>{label}</Label><Input id={`pf-${id}`} value={v[id]} maxLength={max} onChange={(e) => set(id, e.target.value)} /></div>
  return <>
    <Button size="sm" variant="outline" onClick={() => { setV(profile); setOpen(true) }}>Edit preferences</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto">
      <DialogHeader><DialogTitle>Preferences · {clientName}</DialogTitle><DialogDescription className="sr-only">Seat, room, dietary needs and celebrations kept for this client across trips.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        {field('seat', 'Seat', 120)}{field('room', 'Room', 120)}{field('dietary', 'Dietary', 200)}{field('notes', 'Other notes', 500)}
        <div className="space-y-2"><Label>Celebrations</Label>
          {v.celebrations.map((c, i) => <div key={i} className="flex flex-wrap items-center gap-2"><Input aria-label={`Celebration ${i + 1}`} className="min-w-0 flex-1" placeholder="Anniversary" maxLength={80} value={c.label} onChange={(e) => setCel(i, { label: e.target.value })} /><Input aria-label={`Celebration ${i + 1} date`} type="date" className="w-40" value={c.date || ''} onChange={(e) => setCel(i, { date: e.target.value || null })} /><Button size="sm" variant="outline" onClick={() => setV((p) => ({ ...p, celebrations: p.celebrations.filter((_, j) => j !== i) }))}>Remove</Button></div>)}
          {v.celebrations.length < 10 ? <Button size="sm" variant="outline" onClick={() => setV((p) => ({ ...p, celebrations: [...p.celebrations, { label: '', date: null }] }))}>Add celebration</Button> : null}
        </div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button onClick={save} disabled={pending}>{pending ? 'Saving' : 'Save'}</Button>
      </div>
    </DialogContent></Dialog>
  </>
}
