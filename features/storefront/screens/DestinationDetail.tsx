import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { publicRequest } from '../lib/graphql'
import { photoFor } from '../lib/look'
import { DestinationCard, type Destination } from '../components/DestinationCard'

export async function DestinationDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { publicDestination: d } = await publicRequest<{ publicDestination: Destination | null }>(`query($slug: String!) { publicDestination(slug: $slug) }`, { slug })
  if (!d) notFound()
  const { publicDestinations: all } = await publicRequest<{ publicDestinations: Destination[] }>(`{ publicDestinations }`)
  const others = all.filter((o) => o.slug !== d.slug).slice(0, 3)
  return (
    <div className="space-y-5">
      <section className="relative flex min-h-72 flex-col justify-end overflow-hidden rounded-3xl bg-slate-300 p-6 text-white md:min-h-96 md:p-10">
        <Image src={photoFor(d.slug)} alt="" fill priority sizes="(min-width: 1152px) 1104px, 100vw" className="object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        <div className="relative space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide">{[d.country, d.specialty].filter(Boolean).join(' · ')}</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{d.name}</h1>
          <Link href={`/inquiry?destination=${encodeURIComponent(d.name)}`} className="inline-flex min-h-11 items-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow hover:bg-blue-700">Plan a trip to {d.name} →</Link>
        </div>
      </section>
      {others.length ? (
        <section className="p-5 md:p-6">
          <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-bold">More destinations</h2><Link href="/destinations" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700">View All →</Link></div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{others.map((o) => <li key={o.slug}><DestinationCard d={o} /></li>)}</ul>
        </section>
      ) : null}
    </div>
  )
}
