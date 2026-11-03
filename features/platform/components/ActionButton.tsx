'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { runOperator } from '../actions/operators'

export function ActionButton({ operator, input, children, variant = 'outline', confirm }: { operator: string; input: Record<string, unknown>; children: React.ReactNode; variant?: 'outline' | 'default'; confirm?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="sm" variant={variant} disabled={pending} onClick={() => {
        if (confirm && !window.confirm(confirm)) return
        setError(null)
        start(async () => { const r = await runOperator(operator, input); if (!r.success) setError(r.error); else router.refresh() })
      }}>{pending ? 'Working' : children}</Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  )
}
