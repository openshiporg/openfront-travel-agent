import { query, day, label } from '../../lib/data'
import { joinParts } from '../../lib/text'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { ActionButton } from '../../components/ActionButton'
import { StatusLabel } from '../../components/StatusLabel'

export async function TaskListPage() {
  const d = await query(`{ tasks(where: { status: { equals: open } }, orderBy: { dueAt: asc }, take: 200) { id title type dueAt status assignee { name } trip { id title } } }`)
  return (
    <PlatformPage title="Tasks" subtitle={`${d.tasks.length} open`}>
      <Panel>{d.tasks.length ? <RowList>{d.tasks.map((t: any) => (
        <Row key={t.id}>
          <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium">{t.trip ? <a href={`/dashboard/platform/trips/${t.trip.id}?tab=tasks`} className="truncate hover:underline">{t.title}</a> : <span className="truncate">{t.title}</span>}<StatusLabel status={t.status} /></p><p className="truncate text-xs text-muted-foreground">{joinParts([label(t.type), t.trip?.title, t.assignee?.name || 'Unassigned'])}</p></div>
          <span className="flex items-center gap-3"><span className="text-sm">{day(t.dueAt)}</span><ActionButton operator="completeTask" input={{ taskId: t.id }}>Complete</ActionButton></span>
        </Row>))}</RowList> : <Empty>No open tasks</Empty>}</Panel>
    </PlatformPage>
  )
}
