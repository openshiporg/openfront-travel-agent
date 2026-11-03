import Link from 'next/link'

/** Raised pill in a recessed track; URL-driven so it works from server pages. */
export function StatusTabs({ tabs, active, hrefFor }: { tabs: { key: string; label: string; count?: number | null }[]; active: string; hrefFor: (key: string) => string }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <Link key={tab.key} href={hrefFor(tab.key)} scroll={false}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active === tab.key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}{typeof tab.count === 'number' ? <span className="ml-1.5 font-mono text-xs text-muted-foreground">{tab.count}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  )
}
