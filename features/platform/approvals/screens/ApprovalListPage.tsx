import { query, money, day, label } from '../../lib/data'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { StatusTabs } from '../../components/StatusTabs'
import { ApprovalButtons } from '../components/ApprovalButtons'

const TABS = ['requested', 'approved', 'rejected', 'consumed']

export async function ApprovalListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'requested' } = await searchParams
  const active = TABS.includes(status) ? status : 'requested'
  const d = await query(`{
    me: authenticatedItem { ... on User { id } }
    managerApprovals(where: { status: { equals: ${active} } }, orderBy: { requestedAt: desc }, take: 100) { id actionType targetId amountCents reason status requestedAt expiresAt requestedBy { id name } approvedBy { name } }
    ${TABS.map((t) => `${t}: managerApprovalsCount(where: { status: { equals: ${t} } })`).join('\n')}
  }`)
  return (
    <PlatformPage title="Approvals" subtitle="Refunds, commission over-payments and write-offs need a second person">
      <StatusTabs active={active} hrefFor={(k) => `/dashboard/platform/approvals?status=${k}`} tabs={TABS.map((k) => ({ key: k, label: label(k), count: d[k] }))} />
      <Panel>{d.managerApprovals.length ? <RowList>{d.managerApprovals.map((a: any) => {
        const own = a.requestedBy?.id === d.me?.id
        const expired = new Date(a.expiresAt) <= new Date()
        return (
          <Row key={a.id}>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{label(a.actionType)}</span><StatusLabel status={a.status} /></p>
              <p className="truncate text-xs text-muted-foreground">{a.amountCents != null ? `${money(a.amountCents)} · ` : ''}{a.reason}</p>
              <p className="truncate text-xs text-muted-foreground">Requested by {a.requestedBy?.name} {day(a.requestedAt)}{a.approvedBy ? ` · decided by ${a.approvedBy.name}` : ''}{expired && a.status === 'requested' ? ' · expired' : ''}</p>
            </div>
            {a.status === 'requested' && !expired ? (own ? <span className="text-xs text-muted-foreground">Waiting for another person</span> : <ApprovalButtons id={a.id} />) : null}
          </Row>
        )
      })}</RowList> : <Empty>No approvals in this status</Empty>}</Panel>
    </PlatformPage>
  )
}
