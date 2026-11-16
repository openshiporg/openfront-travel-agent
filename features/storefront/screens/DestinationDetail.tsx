import Link from 'next/link'
import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'

export async function DestinationDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { publicDestination: d } = await publicRequest<{ publicDestination: any }>(`query($slug: String!) { publicDestination(slug: $slug) }`, { slug })
  if (!d) notFound()
  return (
    <div className="rounded-3xl bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200/60 md:p-6 space-y-3">
      <h1 className="text-2xl font-bold">{d.name}</h1>
      <p className="text-sm text-muted-foreground">{d.country} · {d.specialty}</p>
      <Link href={`/inquiry?destination=${encodeURIComponent(d.name)}`} className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm">Plan a trip to {d.name}</Link>
    </div>
  )
}
