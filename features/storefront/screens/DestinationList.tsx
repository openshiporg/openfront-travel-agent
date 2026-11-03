import Link from 'next/link'
import { publicRequest } from '../lib/graphql'

export async function DestinationList() {
  const { publicDestinations: destinations } = await publicRequest<{ publicDestinations: any[] }>(`{ publicDestinations }`)
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Destinations</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {destinations.map((d) => (
          <li key={d.slug}><Link href={`/destinations/${d.slug}`} className="block rounded-md border p-3"><span className="block font-medium">{d.name}</span><span className="block text-sm text-muted-foreground">{d.country} · {d.specialty}</span></Link></li>
        ))}
      </ul>
    </div>
  )
}
