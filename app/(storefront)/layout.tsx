import Link from 'next/link'
import { StoreLogoMark } from '@/features/storefront/components/StoreLogoMark'

export const metadata = { title: 'Wayfarer & Co.' }

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold"><StoreLogoMark />Wayfarer &amp; Co.</Link>
        <nav className="flex flex-wrap gap-x-4 text-sm">
          <Link className="inline-flex min-h-11 items-center" href="/destinations">Destinations</Link>
          <Link className="inline-flex min-h-11 items-center" href="/inquiry">Plan a trip</Link>
          <Link className="inline-flex min-h-11 items-center" href="/lookup">Find my booking</Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
