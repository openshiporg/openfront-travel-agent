import { query, money, day } from '../../lib/data'
import { joinParts } from '../../lib/text'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { StatusTabs } from '../../components/StatusTabs'

const TABS = ['all', 'sent', 'partially_paid', 'paid', 'refunded', 'void']

export async function InvoiceListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'all' } = await searchParams
  const active = TABS.includes(status) ? status : 'all'
  const where = active === 'all' ? '{}' : `{ status: { equals: ${active} } }`
  const d = await query(`{ clientInvoices(where: ${where}, orderBy: { dueAt: desc }, take: 100) { id number status totalCents collectedCents currencyCode dueAt trip { id title client { name } } } }`)
  return (
    <PlatformPage title="Invoices" subtitle="Client invoices and collection status">
      <StatusTabs active={active} hrefFor={(k) => `/dashboard/platform/invoices?status=${k}`} tabs={TABS.map((k) => ({ key: k, label: k === 'all' ? 'All' : k.replace(/_/g, ' ') }))} />
      <Panel>{d.clientInvoices.length ? <RowList>{d.clientInvoices.map((i: any) => (
        <Row key={i.id} href={`/dashboard/platform/trips/${i.trip?.id}?tab=payments`}>
          <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium">{i.number}<StatusLabel status={i.status} /></p><p className="truncate text-xs text-muted-foreground">{joinParts([i.trip?.title, i.trip?.client?.name, i.dueAt ? `due ${day(i.dueAt)}` : ''])}</p></div>
          <span className="text-sm">{money(i.collectedCents, i.currencyCode)} of {money(i.totalCents, i.currencyCode)}</span>
        </Row>))}</RowList> : <Empty>No invoices</Empty>}</Panel>
    </PlatformPage>
  )
}
