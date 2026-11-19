import Link from 'next/link'
import { placeLine } from '../lib/format'

export type Destination = { slug: string; name: string; country?: string | null; specialty?: string | null; photo?: { url: string; width?: number; height?: number } | null }

// The photo the agency uploaded for the destination. One without a photo says so on a plain panel.
export function DestinationPhoto({ d, className = '', eager = false }: { d: Destination; className?: string; eager?: boolean }) {
  if (!d.photo?.url) return <div className={`grid place-items-center bg-slate-200 p-4 text-center text-sm text-slate-600 ${className}`}>No photo yet</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={d.photo.url} alt={d.name} width={d.photo.width || undefined} height={d.photo.height || undefined} loading={eager ? 'eager' : 'lazy'} className={`bg-slate-200 object-cover ${className}`} />
}

export function DestinationCard({ d }: { d: Destination }) {
  return (
    <Link href={`/destinations/${d.slug}`} className="group block">
      <DestinationPhoto d={d} className="aspect-[4/3] w-full rounded-xl" />
      <span className="mt-3 block text-base font-semibold text-slate-900 group-hover:underline">{d.name}</span>
      <span className="block text-sm text-slate-600">{placeLine(d)}</span>
    </Link>
  )
}
