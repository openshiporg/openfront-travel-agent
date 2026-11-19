import Link from 'next/link'
import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { placeLine } from '../lib/format'
import { DestinationCard, DestinationPhoto, type Destination } from '../components/DestinationCard'

export async function DestinationDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { publicDestination: d } = await publicRequest<{ publicDestination: Destination | null }>(`query($slug: String!) { publicDestination(slug: $slug) }`, { slug })
  if (!d) notFound()
  const { publicDestinations: all } = await publicRequest<{ publicDestinations: Destination[] }>(`{ publicDestinations }`)
  const others = all.filter((o) => o.slug !== d.slug)
  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <div className="space-y-1">
          <p className="text-sm text-slate-600">{placeLine(d)}</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{d.name}</h1>
        </div>
        <DestinationPhoto d={d} eager className="aspect-[3/2] w-full rounded-xl md:aspect-[21/9]" />
        <div className="max-w-2xl space-y-4">
          <p className="text-base text-slate-700">An advisor plans each {d.name} trip around your dates, party and budget, then sends options with prices for you to choose from.</p>
          <Link href={`/inquiry?destination=${encodeURIComponent(d.name)}`} className="cta">Plan a trip to {d.name}</Link>
        </div>
      </section>
      {others.length ? (
        <section aria-labelledby="more" className="space-y-6">
          <h2 id="more" className="text-2xl font-bold tracking-tight">Other destinations</h2>
          <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{others.map((o) => <li key={o.slug}><DestinationCard d={o} /></li>)}</ul>
        </section>
      ) : null}
    </div>
  )
}
