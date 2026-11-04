'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../actions/operators'
import { toCents } from '../lib/cents'

export type EntryField = { name: string; label: string; kind?: 'text' | 'money' | 'date' | 'select'; options?: { value: string; label: string }[]; initial?: string; optional?: boolean; sendEmpty?: boolean }

/** Generic operator entry form in a dialog: money fields become cents, errors stay in the dialog. */
export function EntryDialog({ title, trigger, operator, fields, base, lineFields, redirectTo }: { title: string; trigger: string; operator: string; fields: EntryField[]; base: Record<string, unknown>; lineFields?: string[]; redirectTo?: string }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ''])))
  const [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  const submit = () => start(async () => {
    setError('')
    const out: Record<string, any> = {}
    for (const f of fields) {
      const v = (values[f.name] || '').trim()
      if (!v) { if (f.optional) { if (f.sendEmpty) out[f.name] = null; continue } return setError(`${f.label} is required`) }
      if (f.kind === 'money') { const c = toCents(v); if (c === null) return setError(`${f.label}: enter an amount above zero with at most two decimals`); out[f.name] = c } else out[f.name] = v
    }
    const r = await runOperator(operator, { ...base, ...(lineFields ? { ...Object.fromEntries(Object.entries(out).filter(([k]) => !lineFields.includes(k))), lines: [Object.fromEntries(lineFields.filter((k) => k in out).map((k) => [k, out[k]]))] } : out) })
    if (!r.success) return setError(r.error)
    setOpen(false)
    const newId = (r.data as any)?.id
    if (redirectTo && newId) router.push(redirectTo.replace('{id}', String(newId))); else router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>{trigger}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-[min(28rem,calc(100vw-2rem))]"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">{title}</DialogDescription></DialogHeader>
      <div className="space-y-4">{fields.map((f) => <div key={f.name} className="space-y-1"><Label htmlFor={`entry-${operator}-${f.name}`}>{f.label}</Label>
        {f.kind === 'select'
          ? <select id={`entry-${operator}-${f.name}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}><option value="">Choose</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          : <Input id={`entry-${operator}-${f.name}`} type={f.kind === 'date' ? 'date' : 'text'} inputMode={f.kind === 'money' ? 'decimal' : undefined} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />}
      </div>)}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={pending} onClick={submit}>{pending ? 'Saving' : 'Save'}</Button></div></DialogContent></Dialog></>
}
