import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { date } from '../lib/format'
import { Days } from '../components/Days'

export async function ItineraryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let t: any = null
  try { t = (await publicRequest(`query($token: String!) { viewItinerary(token: $token) }`, { token })).viewItinerary } catch {}
  if (!t) notFound()
  const when = [date(t.startDate), date(t.endDate)].filter(Boolean).join(' to ')
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-slate-700">{[`Trip code ${t.tripNumber}`, when].filter(Boolean).join(' · ')}</p>
      </div>
      <Days days={t.days} />
      <p className="text-sm text-slate-600 print:hidden">Use your browser&apos;s print option for a paper copy.</p>
    </div>
  )
}
