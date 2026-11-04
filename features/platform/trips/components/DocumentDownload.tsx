'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { runOperator } from '../../actions/operators'

/** Fetches a two-minute signed link on click, so no durable file URL is ever rendered into the page. */
export function DocumentDownload({ documentId }: { documentId: string }) {
  const [error, setError] = useState(''), [pending, start] = useTransition()
  return <span className="inline-flex flex-col items-start gap-1"><Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
    setError('')
    const r = await runOperator('documentDownloadUrl', { documentId })
    if (!r.success) return setError(r.error)
    window.open((r.data as { url: string }).url, '_blank', 'noopener,noreferrer')
  })}>{pending ? 'Working' : 'Download'}</Button>{error ? <span className="text-xs text-red-600">{error}</span> : null}</span>
}
