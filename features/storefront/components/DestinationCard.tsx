import Link from 'next/link'
import Image from 'next/image'
import { photoFor } from '../lib/look'

export type Destination = { slug: string; name: string; country?: string | null; specialty?: string | null }

export function DestinationCard({ d }: { d: Destination }) {
  return (
    <Link href={`/destinations/${d.slug}`} className="group relative flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-2xl bg-slate-300 p-4 text-white shadow-sm sm:aspect-[4/3]">
      <Image src={photoFor(d.slug)} alt="" fill sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <span className="relative text-xl font-semibold drop-shadow">{d.name}</span>
      <span className="relative text-xs opacity-95 drop-shadow">{[d.country, d.specialty].filter(Boolean).join(' · ')}</span>
    </Link>
  )
}
