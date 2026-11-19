import Link from 'next/link'
import { publicRequest } from '../lib/graphql'
import { getAgency } from '../lib/agency'
import { placeLine } from '../lib/format'
import { DestinationCard, DestinationPhoto, type Destination } from '../components/DestinationCard'

export async function StorefrontHome() {
  const [{ publicDestinations: destinations }, agency] = await Promise.all([publicRequest<{ publicDestinations: Destination[] }>(`{ publicDestinations }`), getAgency()])
  const [lead, ...rest] = destinations
  return (
    <div className="space-y-14">
      <section className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Plan a trip with {agency.name || 'an advisor'}</h1>
        <p className="text-base text-slate-700">Tell us where you want to go and when. An advisor writes back with trip options and prices. You pick one, pay the deposit online, and follow your itinerary and balance on one page.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/inquiry" className="cta">Plan a trip</Link>
          <Link href="/lookup" className="link inline-flex min-h-11 items-center text-sm font-medium">Find my booking</Link>
        </div>
      </section>

      {lead ? (
        <section aria-labelledby="where" className="space-y-6">
          <h2 id="where" className="text-2xl font-bold tracking-tight">Where we plan trips</h2>
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-8">
            <Link href={`/destinations/${lead.slug}`}><DestinationPhoto d={lead} eager className="aspect-[3/2] w-full rounded-xl" /></Link>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{placeLine(lead)}</p>
              <h3 className="text-3xl font-bold tracking-tight"><Link href={`/destinations/${lead.slug}`} className="hover:underline">{lead.name}</Link></h3>
              <p className="pt-2"><Link href={`/inquiry?destination=${encodeURIComponent(lead.name)}`} className="cta">Plan a trip to {lead.name}</Link></p>
            </div>
          </div>
          <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">{rest.map((d) => <li key={d.slug}><DestinationCard d={d} /></li>)}</ul>
          <p className="text-sm text-slate-700">Going somewhere else? <Link href="/inquiry" className="link font-medium">Tell us where</Link> and an advisor will plan it.</p>
        </section>
      ) : <p className="text-sm text-slate-700">No destinations are listed yet. <Link href="/inquiry" className="link font-medium">Tell us where you want to go</Link>.</p>}
    </div>
  )
}
