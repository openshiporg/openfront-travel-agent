import Link from 'next/link'
import { gradientFor } from '../lib/look'

export function DestinationCard({ d }: { d: any }) {
  return (
    <Link href={`/destinations/${d.slug}`} className={`group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br ${gradientFor(d.slug)} p-4 text-white shadow-sm`}>
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <span className="relative text-xl font-semibold drop-shadow">{d.name}</span>
      <span className="relative text-xs opacity-90">{[d.country, d.specialty].filter(Boolean).join(' · ')}</span>
    </Link>
  )
}
