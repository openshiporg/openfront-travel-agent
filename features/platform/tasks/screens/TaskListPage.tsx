import { query, day, label } from '../../lib/data'
import { joinParts } from '../../lib/text'
import { daysOverdue, isOverdue, taskStatus } from '../../lib/task-state'
import { PlatformPage, Panel, Empty, RowList, Row } from '../../components/PlatformPage'
import { StatusLabel } from '../../components/StatusLabel'
import { TaskActions } from '../components/TaskActions'

export async function TaskListPage() {
  const d = await query(`{ tasks(where: { status: { equals: open } }, orderBy: { dueAt: asc }, take: 200) { id title type dueAt status assignee { name } trip { id title } } }`)
  const overdue = d.tasks.filter((t: any) => isOverdue(t)).length
  return (
    <PlatformPage title="Tasks" subtitle={joinParts([`${d.tasks.length} open`, overdue ? `${overdue} overdue` : ''])}>
      <Panel>{d.tasks.length ? <RowList>{d.tasks.map((t: any) => (
        <Row key={t.id}>
          <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium">{t.trip ? <a href={`/dashboard/platform/trips/${t.trip.id}?tab=tasks`} className="truncate hover:underline">{t.title}</a> : <span className="truncate">{t.title}</span>}<StatusLabel status={taskStatus(t)} /></p><p className="truncate text-xs text-muted-foreground">{joinParts([label(t.type), t.trip?.title, t.assignee?.name || 'Unassigned'])}</p></div>
          <span className="flex items-center gap-3"><span className="text-sm">{day(t.dueAt)}{daysOverdue(t) ? <span className="text-xs text-red-600"> · {daysOverdue(t)}d late</span> : null}</span><TaskActions taskId={t.id} title={t.title} status={t.status} /></span>
        </Row>))}</RowList> : <Empty>No open tasks</Empty>}</Panel>
    </PlatformPage>
  )
}
