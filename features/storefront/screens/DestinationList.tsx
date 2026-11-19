import Link from 'next/link'
import { publicRequest } from '../lib/graphql'
import { DestinationCard, type Destination } from '../components/DestinationCard'

export async function DestinationList() {
  const { publicDestinations: destinations } = await publicRequest<{ publicDestinations: Destination[] }>(`{ publicDestinations }`)
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Destinations</h1>
      {destinations.length
        ? <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{destinations.map((d) => <li key={d.slug}><DestinationCard d={d} /></li>)}</ul>
        : <p className="text-sm text-slate-700">No destinations are listed yet.</p>}
      <p className="text-sm text-slate-700">Going somewhere else? <Link href="/inquiry" className="link font-medium">Tell us where</Link> and an advisor will plan it.</p>
    </div>
  )
}
