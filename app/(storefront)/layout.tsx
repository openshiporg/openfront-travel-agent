import Link from 'next/link'
import type { Metadata } from 'next'
import { StoreLogoMark } from '@/features/storefront/components/StoreLogoMark'
import { getAgency } from '@/features/storefront/lib/agency'
import '@/features/storefront/storefront.css'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAgency()).name || 'Trips' }
}

const nav = 'inline-flex min-h-11 items-center hover:underline underline-offset-4'

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const agency = await getAgency()
  return (
    <div className="shop min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-x-6 py-4">
          <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight"><StoreLogoMark />{agency.name}</Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 text-sm font-medium text-slate-700">
            <Link href="/destinations" className={nav}>Destinations</Link>
            <Link href="/inquiry" className={nav}>Plan a trip</Link>
            <Link href="/lookup" className={nav}>Find my booking</Link>
          </nav>
        </header>
        <main className="flex-1 pb-16 pt-6 md:pt-10">{children}</main>
        <footer className="flex flex-wrap justify-between gap-x-8 gap-y-2 border-t border-slate-200 py-6 text-sm text-slate-600">
          <p><span className="font-medium text-slate-900">{agency.name}</span>{agency.address ? <> · {agency.address}</> : null}</p>
          <p className="flex flex-wrap gap-x-5">
            {agency.phone ? <a className="link" href={`tel:${agency.phone.replace(/[^+\d]/g, '')}`}>{agency.phone}</a> : null}
            {agency.email ? <a className="link" href={`mailto:${agency.email}`}>{agency.email}</a> : null}
          </p>
        </footer>
      </div>
    </div>
  )
}
