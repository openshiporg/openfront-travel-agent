import Link from 'next/link'
import { publicRequest } from '../lib/graphql'
import { DestinationCard } from '../components/DestinationCard'

const panel = 'rounded-3xl bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200/60 md:p-6'
const viewAll = 'text-sm font-semibold text-blue-700'

export async function StorefrontHome() {
  const { publicDestinations: destinations } = await publicRequest<{ publicDestinations: any[] }>(`{ publicDestinations }`)
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-100 via-sky-300 to-blue-600 p-8 md:p-12">
        <div className="absolute -right-10 -top-10 size-72 rounded-full bg-white/30 blur-2xl" />
        <div className="relative max-w-md space-y-4 py-6 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Explore the world</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">Your Next Great Journey Awaits</h1>
          <p className="text-sm text-slate-700">Bespoke trips planned by an advisor, from first idea to final payment.</p>
          <Link href="/inquiry" className="inline-flex min-h-11 items-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow hover:bg-blue-700">Plan Your Trip →</Link>
        </div>
      </section>

      <section className={panel}>
        <h2 className="mb-4 text-xl font-bold">Find Your Perfect Trip</h2>
        <form action="/inquiry" className="grid gap-3 md:grid-cols-[1.3fr_1fr_auto]">
          <select name="destination" aria-label="Where to?" defaultValue="" className="h-12 rounded-full bg-white px-5 text-sm shadow-sm ring-1 ring-slate-200">
            <option value="">Where to?</option>
            {destinations.map((d) => <option key={d.slug} value={d.name}>{d.name}</option>)}
          </select>
          <input name="travelers" type="number" min={1} max={99} placeholder="Travelers" aria-label="Travelers" className="h-12 rounded-full bg-white px-5 text-sm shadow-sm ring-1 ring-slate-200" />
          <button type="submit" className="h-12 rounded-full bg-blue-600 px-8 text-sm font-semibold text-white shadow hover:bg-blue-700">Search</button>
        </form>
      </section>

      <section className={panel}>
        <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-bold">Popular Destinations</h2><Link href="/destinations" className={viewAll}>View All →</Link></div>
        {destinations.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.slice(0, 6).map((d) => <li key={d.slug}><DestinationCard d={d} /></li>)}
          </ul>
        ) : <p className="text-sm text-slate-600">Destinations are coming soon.</p>}
      </section>

      <section className={panel}>
        <h2 className="mb-4 text-xl font-bold">Why Travel With Us</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[['Expert Planning', 'Tailored trips by travel specialists'], ['Travel with Confidence', 'Clear invoices and secure payment'], ['Your Trip Portal', 'Itinerary and balance in one link']].map(([t, b]) => (
            <div key={t} className="flex gap-3"><span className="mt-1 size-10 shrink-0 rounded-xl bg-blue-100" /><div><h3 className="text-sm font-bold">{t}</h3><p className="text-sm text-slate-600">{b}</p></div></div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-gradient-to-b from-orange-100 via-rose-100 to-sky-200 p-10 text-center">
        <h2 className="text-2xl font-bold">Ready to go?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-700">Tell an advisor where you want to go, or find a booking you already have.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/inquiry" className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700">Plan a trip</Link>
          <Link href="/lookup" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow">Find my booking</Link>
        </div>
      </section>
    </div>
  )
}
