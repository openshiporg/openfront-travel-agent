import { publicRequest } from '../lib/graphql'
import { DestinationCard } from '../components/DestinationCard'

export async function DestinationList() {
  const { publicDestinations: destinations } = await publicRequest<{ publicDestinations: any[] }>(`{ publicDestinations }`)
  return (
    <div className="space-y-4 rounded-3xl bg-slate-50 p-5 shadow-sm ring-1 ring-slate-200/60 md:p-6">
      <h1 className="text-2xl font-bold">Destinations</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => <li key={d.slug}><DestinationCard d={d} /></li>)}
      </ul>
    </div>
  )
}
