'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { runOperator } from '../../actions/operators'

const KINDS = ['passport', 'visa', 'insurance', 'supplier_confirmation', 'signed_terms']
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,text/plain'
const MAX_BYTES = 25 * 1024 * 1024
const words = (v: string) => v.replace(/_/g, ' ')

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Private document upload straight to object storage with a checksum the server verifies afterwards. */
export function DocumentUploader({ tripId, travelers, storageConfigured }: { tripId: string; travelers: { id: string; name: string }[]; storageConfigured: boolean }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState('passport'), [title, setTitle] = useState(''), [travelerId, setTravelerId] = useState('')
  const [file, setFile] = useState<File | null>(null), [error, setError] = useState(''), [step, setStep] = useState(''), [pending, start] = useTransition(), router = useRouter()
  if (!storageConfigured) return <span className="text-xs text-muted-foreground" role="status">Storage not configured. Set the S3 environment variables to upload documents.</span>
  const submit = () => start(async () => {
    setError('')
    if (!file) return setError('Choose a file')
    if (!title.trim()) return setError('Title is required')
    if (file.size < 1 || file.size > MAX_BYTES) return setError('File must be between 1 byte and 25 MB')
    setStep('Preparing')
    const checksumSha256 = await sha256Hex(file)
    const req = await runOperator('requestDocumentUpload', { tripId, travelerId: travelerId || undefined, kind, title: title.trim(), fileName: file.name, mimeType: file.type, byteSize: file.size, checksumSha256 })
    if (!req.success) { setStep(''); return setError(req.error) }
    const { documentId, uploadUrl, headers } = req.data as { documentId: string; uploadUrl: string; headers: { name: string; value: string }[] }
    setStep('Uploading')
    try {
      const put = await fetch(uploadUrl, { method: 'PUT', headers: Object.fromEntries(headers.map((h) => [h.name, h.value])), body: file })
      if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`)
    } catch (e) { setStep(''); return setError(`${e instanceof Error ? e.message : 'Upload failed'}. The document stays unverified; try again.`) }
    setStep('Verifying')
    const done = await runOperator('completeDocumentUpload', { documentId })
    setStep('')
    if (!done.success) return setError(done.error)
    setOpen(false); setFile(null); setTitle(''); router.refresh()
  })
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Upload document</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto"><DialogHeader><DialogTitle>Upload document</DialogTitle><DialogDescription className="sr-only">Upload a private trip document such as a passport scan or supplier confirmation.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="doc-kind">Kind</Label><select id="doc-kind" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{words(k)}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="doc-title">Title</Label><Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        {travelers.length ? <div className="space-y-1"><Label htmlFor="doc-traveler">Traveler (optional)</Label><select id="doc-traveler" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={travelerId} onChange={(e) => setTravelerId(e.target.value)}><option value="">Whole trip</option>{travelers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div> : null}
        <div className="space-y-1"><Label htmlFor="doc-file">File (PDF, JPEG, PNG, WebP or text, up to 25 MB)</Label><Input id="doc-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        {step ? <p role="status" className="text-sm">{step}</p> : null}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={pending} onClick={submit}>{pending ? step || 'Working' : 'Upload'}</Button>
      </div></DialogContent></Dialog></>
}
