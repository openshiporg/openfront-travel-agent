'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { runOperator } from '../../actions/operators'

/** The file is built and audited on the server; the browser only saves what came back. */
export function ForecastExport() {
  const [pending, start] = useTransition(), [error, setError] = useState('')
  const run = () => start(async () => {
    setError('')
    const r = await runOperator('exportCommissionForecast', {})
    if (!r.success) return setError(r.error)
    const { filename, csv } = r.data as { filename: string; csv: string }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  })
  return <span className="inline-flex flex-col items-start gap-1"><Button size="sm" variant="outline" disabled={pending} onClick={run}>{pending ? 'Preparing' : 'Export CSV'}</Button>{error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}</span>
}
