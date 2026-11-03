import Link from 'next/link'

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <Link href="/" className="font-semibold">Wayfarer &amp; Co.</Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/destinations">Destinations</Link>
          <Link href="/inquiry">Plan a trip</Link>
          <Link href="/lookup">Find my booking</Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
