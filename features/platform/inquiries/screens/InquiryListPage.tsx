import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { StatusTabs } from '../../components/StatusTabs'
import { ActionButton } from '../../components/ActionButton'
import { EntryDialog } from '../../components/EntryDialog'

const TABS = ['all', 'new', 'qualifying', 'proposal', 'won', 'lost']

export async function InquiryListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'all' } = await searchParams
  const active = TABS.includes(status) ? status : 'all'
  const where = active === 'all' ? '{}' : `{ status: { equals: ${active} } }`
  const d = await query(`{
    inquiries(where: ${where}, orderBy: { createdAt: desc }, take: 100) { id name email tripType destinations travelWindowStart partySize budgetCents status source lostReason assignedAdvisor { name } trips { id status } }
    ${TABS.slice(1).map((t) => `${t}: inquiriesCount(where: { status: { equals: ${t} } })`).join('\n')}
  }`)
  return (
    <PlatformPage title="Inquiries" subtitle="Lead pipeline">
      <StatusTabs active={active} hrefFor={(k) => `/dashboard/platform/inquiries?status=${k}`} tabs={TABS.map((k) => ({ key: k, label: label(k), count: k === 'all' ? null : d[k] }))} />
      <Panel>
        {d.inquiries.length ? <RowList>{d.inquiries.map((i: any) => (
          <Row key={i.id}>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{i.name}</span><StatusLabel status={i.status} /></p>
              <p className="truncate text-xs text-muted-foreground">{label(i.tripType)} · {i.destinations || 'Destination open'} · {i.partySize} travelers · {i.budgetCents ? money(i.budgetCents) : 'No budget'} · from {day(i.travelWindowStart)}</p>
              <p className="truncate text-xs text-muted-foreground">{i.email} · {i.assignedAdvisor?.name || 'Unassigned'}</p>
              {i.status === 'lost' && i.lostReason ? <p className="truncate text-xs text-muted-foreground">Lost: {i.lostReason}</p> : null}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {i.trips.length ? <a className="inline-flex min-h-11 items-center text-sm underline" href={`/dashboard/platform/trips/${i.trips[0].id}`}>Open trip</a> : ['new', 'qualifying', 'proposal'].includes(i.status) ? <ActionButton operator="createTripFromInquiry" input={{ inquiryId: i.id }}>Create trip</ActionButton> : null}
              {i.status === 'new' ? <ActionButton operator="moveInquiry" input={{ inquiryId: i.id, status: 'qualifying' }}>Qualify</ActionButton> : null}
              {['new', 'qualifying', 'proposal'].includes(i.status) && !i.trips.some((t: any) => !['planning', 'proposal_sent', 'cancelled'].includes(t.status)) ? <EntryDialog title={`Mark lost · ${i.name}`} trigger="Mark lost" operator="moveInquiry" base={{ inquiryId: i.id, status: 'lost' }} fields={[{ name: 'reason', label: 'Why was it lost' }]} /> : null}
              {i.status === 'lost' ? <ActionButton operator="moveInquiry" input={{ inquiryId: i.id, status: 'qualifying' }}>Reopen</ActionButton> : null}
            </div>
          </Row>))}</RowList> : <Empty>No inquiries</Empty>}
      </Panel>
    </PlatformPage>
  )
}
