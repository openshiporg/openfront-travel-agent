'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

type Person = { id: string; name: string }
function Checks({ people, value, onChange, legend }: { people: Person[]; value: string[]; onChange: (v: string[]) => void; legend: string }) {
  if (!people.length) return <p className="text-sm text-muted-foreground">No travelers available.</p>
  return <fieldset className="space-y-1"><legend className="mb-1 text-sm font-medium">{legend}</legend>{people.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={value.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))} />{p.name}</label>)}</fieldset>
}
function useSave(run: () => Promise<{ success: boolean; error?: string }>, done: () => void) {
  const [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  return { error, pending, setError, save: () => start(async () => { setError(''); const r = await run(); if (!r.success) return setError(r.error || 'Failed'); done(); router.refresh() }) }
}

/** Create or edit a paying party and who is in it. `available` already excludes travelers who pay through another party. */
export function PartyEditor({ tripId, party, available }: { tripId: string; party?: { id: string; name: string; travelerIds: string[] }; available: Person[] }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(party?.name || ''), [ids, setIds] = useState<string[]>(party?.travelerIds || [])
  const s = useSave(() => runOperator(party ? 'editTripParty' : 'addTripParty', party ? { partyId: party.id, name, travelerIds: ids } : { tripId, name, travelerIds: ids }) as any, () => { setOpen(false); if (!party) { setName(''); setIds([]) } })
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{party ? 'Edit party' : 'Add party'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>{party ? `Edit ${party.name}` : 'Add paying party'}</DialogTitle><DialogDescription className="sr-only">A paying party receives its own invoices and portal link.</DialogDescription></DialogHeader>
      <div className="space-y-3"><div className="space-y-1"><Label htmlFor="party-name">Party name</Label><Input id="party-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
        <Checks legend="Travelers in this party" people={available} value={ids} onChange={setIds} />
        {s.error ? <p role="alert" className="text-sm text-red-600">{s.error}</p> : null}<Button onClick={s.save} disabled={s.pending}>{s.pending ? 'Saving' : 'Save'}</Button></div></DialogContent></Dialog></>
}

export function RoomEditor({ tripId, room, parties, travelers }: { tripId: string; room?: { id: string; label: string; roomType: string; partyId: string; guestIds: string[] }; parties: { id: string; name: string; travelerIds: string[] }[]; travelers: Person[] }) {
  const [open, setOpen] = useState(false), [label, setLabel] = useState(room?.label || ''), [roomType, setType] = useState(room?.roomType || ''), [partyId, setParty] = useState(room?.partyId || ''), [ids, setIds] = useState<string[]>(room?.guestIds || [])
  const pool = partyId ? travelers.filter((t) => parties.find((p) => p.id === partyId)?.travelerIds.includes(t.id)) : travelers
  const s = useSave(() => runOperator('saveTripRoom', { tripId, roomId: room?.id, label, roomType, partyId: partyId || undefined, guestIds: ids }) as any, () => { setOpen(false); if (!room) { setLabel(''); setType(''); setIds([]) } })
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{room ? 'Edit room' : 'Add room'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>{room ? `Edit ${room.label}` : 'Add room'}</DialogTitle><DialogDescription className="sr-only">Rooming list entry with its guests.</DialogDescription></DialogHeader>
      <div className="space-y-3"><div className="space-y-1"><Label htmlFor="room-label">Room</Label><Input id="room-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="room-type">Type (optional)</Label><Input id="room-type" value={roomType} maxLength={60} onChange={(e) => setType(e.target.value)} /></div>
        {parties.length ? <div className="space-y-1"><Label htmlFor="room-party">Party</Label><select id="room-party" className="h-11 w-full rounded-md border bg-background px-2 text-sm" value={partyId} onChange={(e) => { setParty(e.target.value); setIds([]) }}><option value="">Any party</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div> : null}
        <Checks legend="Guests" people={pool} value={ids} onChange={setIds} />
        {s.error ? <p role="alert" className="text-sm text-red-600">{s.error}</p> : null}<Button onClick={s.save} disabled={s.pending}>{s.pending ? 'Saving' : 'Save'}</Button></div></DialogContent></Dialog></>
}
