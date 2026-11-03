'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { startInvoicePayment } from '../actions'

declare global { interface Window { Stripe?: any } }

function loadStripe(): Promise<any> {
  if (window.Stripe) return Promise.resolve(window.Stripe)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3'
    s.onload = () => resolve(window.Stripe)
    s.onerror = () => reject(new Error('Payment form could not load'))
    document.head.appendChild(s)
  })
}

export function PayInvoice({ token, publishableKey }: { token: string; publishableKey: string }) {
  const mount = useRef<HTMLDivElement>(null)
  const state = useRef<{ stripe: any; elements: any } | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!publishableKey) throw new Error('Payments are not configured')
        const started = await startInvoicePayment(token)
        if (!started.ok) throw new Error(started.error)
        const Stripe = await loadStripe()
        const stripe = Stripe(publishableKey)
        const elements = stripe.elements({ clientSecret: started.data.clientSecret })
        if (cancelled || !mount.current) return
        elements.create('payment').mount(mount.current)
        state.current = { stripe, elements }
        setReady(true)
      } catch (e: any) { if (!cancelled) setError(e?.message || 'Payment form could not load') }
    })()
    return () => { cancelled = true }
  }, [token, publishableKey])

  return (
    <div className="space-y-3">
      <div ref={mount} />
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {ready ? (
        <Button disabled={busy} onClick={async () => {
          if (!state.current) return
          setBusy(true); setError(null)
          const { stripe, elements } = state.current
          const res = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/invoice/${token}` } })
          if (res?.error) { setError(res.error.message || 'Payment failed'); setBusy(false) }
        }}>{busy ? 'Paying' : 'Pay now'}</Button>
      ) : null}
    </div>
  )
}
