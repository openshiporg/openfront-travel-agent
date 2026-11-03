'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { decideApproval } from '../../actions/approvals'

export function ApprovalButtons({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const decide = (d: 'approved' | 'rejected') => start(async () => { setError(null); const r = await decideApproval(id, d); if (r.success) router.refresh(); else setError(r.error) })
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide('approved')}>Approve</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide('rejected')}>Reject</Button>
      </span>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  )
}
