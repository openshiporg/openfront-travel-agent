import Link from 'next/link'
import { publicRequest } from '../lib/graphql'

export async function StorefrontHome() {
  const { publicDestinations: destinations } = await publicRequest<{ publicDestinations: any[] }>(`{ publicDestinations }`)
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Wayfarer &amp; Co.</h1>
        <p className="text-sm text-muted-foreground">Bespoke trips planned by an advisor.</p>
        <Link href="/inquiry" className="inline-block rounded-md border px-4 py-2 text-sm">Plan a trip</Link>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Destinations</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {destinations.map((d) => (
            <li key={d.slug}><Link href={`/destinations/${d.slug}`} className="block rounded-md border p-3"><span className="block font-medium">{d.name}</span><span className="block text-sm text-muted-foreground">{d.specialty}</span></Link></li>
          ))}
        </ul>
      </section>
    </div>
  )
}
