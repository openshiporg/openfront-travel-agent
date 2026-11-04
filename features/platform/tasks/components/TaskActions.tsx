'use client'
import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

/** Complete (optional note) or reopen (reason required) one task. Unique ids so many rows can share a page. */
export function TaskActions({ taskId, title, status }: { taskId: string; title: string; status: string }) {
  const reopen = status === 'completed'
  const id = useId()
  const [open, setOpen] = useState(false), [note, setNote] = useState(''), [error, setError] = useState(''), [pending, start] = useTransition(), router = useRouter()
  if (status !== 'open' && !reopen) return null
  const submit = () => start(async () => {
    setError('')
    if (reopen && !note.trim()) return setError('Say why this task is being reopened')
    const r = await runOperator(reopen ? 'reopenTask' : 'completeTask', { taskId, note: note.trim() })
    if (!r.success) return setError(r.error)
    setOpen(false); setNote(''); router.refresh()
  })
  const verb = reopen ? 'Reopen' : 'Complete'
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`${verb} task: ${title}`}>{verb}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-[min(28rem,calc(100vw-2rem))]"><DialogHeader><DialogTitle>{verb} task</DialogTitle><DialogDescription className="sr-only">{verb} the task {title}, optionally with a note.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <p className="text-sm font-medium">{title}</p>
        <div className="space-y-1"><Label htmlFor={`${id}-note`}>{reopen ? 'Reason for reopening' : 'Note (optional)'}</Label><Textarea id={`${id}-note`} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={pending} onClick={submit}>{pending ? 'Saving' : verb}</Button>
      </div></DialogContent></Dialog></>
}
