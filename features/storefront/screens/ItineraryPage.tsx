import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { date } from '../lib/format'

export async function ItineraryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let t: any = null
  try { t = (await publicRequest(`query($token: String!) { viewItinerary(token: $token) }`, { token })).viewItinerary } catch {}
  if (!t) notFound()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-sm text-muted-foreground">{t.tripNumber} · {date(t.startDate)} to {date(t.endDate)}</p>
      {t.days.map((d: any, i: number) => (
        <section key={i} className="space-y-1 rounded-md border p-3">
          <h2 className="font-medium">{date(d.date)} · {d.title}</h2>
          <ul className="space-y-1 text-sm">{d.items.map((it: any, j: number) => <li key={j}>{it.time} {it.title}{it.location ? <span className="text-muted-foreground"> · {it.location}</span> : null}</li>)}</ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground print:hidden">Use your browser's print option for a paper copy.</p>
    </div>
  )
}
