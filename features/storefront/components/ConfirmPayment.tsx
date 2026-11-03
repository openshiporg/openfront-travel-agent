'use client'

import { useEffect, useState } from 'react'
import { confirmInvoicePaymentAction } from '../actions'

export function ConfirmPayment({ token, paymentIntentId }: { token: string; paymentIntentId: string }) {
  const [state, setState] = useState<{ status: string; number?: string; error?: string } | null>(null)
  useEffect(() => {
    let tries = 0
    const attempt = async () => {
      const r = await confirmInvoicePaymentAction(token, paymentIntentId)
      if (!r.ok) return setState({ status: 'error', error: r.error })
      if (r.data.status === 'succeeded') return setState({ status: 'succeeded', number: r.data.number })
      if (++tries < 8) setTimeout(attempt, 1500); else setState({ status: r.data.status })
    }
    attempt()
  }, [token, paymentIntentId])
  if (!state) return <p role="status" className="text-sm">Confirming payment</p>
  if (state.status === 'succeeded') return <p role="status" className="rounded-md border p-3 text-sm">Payment received.</p>
  return <p role="alert" className="text-sm text-red-600">{state.error || `Payment is ${state.status}. Refresh in a moment or contact your advisor.`}</p>
}
