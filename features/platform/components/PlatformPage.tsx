import { PageContainer } from '@/features/dashboard/components/PageContainer'

export function PlatformPage({ title, subtitle, crumbs = [], actions, children }: { title: string; subtitle?: string; crumbs?: { label: string; href?: string }[]; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <PageContainer
      breadcrumbs={[{ type: 'link', label: 'Dashboard', href: '/dashboard' }, ...crumbs.map((c) => (c.href ? { type: 'link' as const, label: c.label, href: c.href } : { type: 'page' as const, label: c.label })), ...(crumbs.length ? [] : [{ type: 'page' as const, label: title }])]}
      header={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h1 className="truncate text-xl font-semibold md:text-2xl">{title}</h1>{subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}</div>
          {actions}
        </div>
      }
    >
      <div className="space-y-4 px-4 pb-6 pt-2 md:px-6">{children}</div>
    </PageContainer>
  )
}

export function Panel({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border bg-background">
      {title ? <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><h2 className="text-sm font-medium">{title}</h2>{action}</div> : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** Rows stack on phones: each row is a card, never a horizontally scrolling table. */
export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y">{children}</ul>
}
export function Row({ href, children }: { href?: string; children: React.ReactNode }) {
  const inner = <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">{children}</div>
  return <li>{href ? <a href={href} className="block hover:bg-muted/50">{inner}</a> : inner}</li>
}
