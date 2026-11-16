import Link from 'next/link'
import { StoreLogoMark } from '@/features/storefront/components/StoreLogoMark'

export const metadata = { title: 'Wayfarer & Co.' }

const theme = {
  '--primary': 'oklch(0.52 0.22 264)',
  '--primary-foreground': 'oklch(0.99 0 0)',
  '--ring': 'oklch(0.6 0.16 264)',
} as React.CSSProperties

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={theme} className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 p-3 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 px-5 py-3 shadow-sm ring-1 ring-slate-200/60">
          <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight"><StoreLogoMark />Wayfarer<span className="font-normal text-slate-600">&nbsp;&amp; Co.</span></Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium text-slate-700">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-4 hover:bg-blue-50 hover:text-blue-700">Home</Link>
            <Link href="/destinations" className="inline-flex min-h-11 items-center rounded-full px-4 hover:bg-blue-50 hover:text-blue-700">Destinations</Link>
            <Link href="/inquiry" className="inline-flex min-h-11 items-center rounded-full px-4 hover:bg-blue-50 hover:text-blue-700">Plan a trip</Link>
            <Link href="/lookup" className="inline-flex min-h-11 items-center rounded-full px-4 hover:bg-blue-50 hover:text-blue-700">Find my booking</Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-600 ring-1 ring-slate-200/60">Wayfarer &amp; Co. · Bespoke trips planned by an advisor.</footer>
      </div>
    </div>
  )
}
