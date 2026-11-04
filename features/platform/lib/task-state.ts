export type TaskLike = { status?: string | null; dueAt?: string | null }

/** Overdue is derived, never stored: an open task whose due moment has passed. */
export function isOverdue(task: TaskLike, now = Date.now()): boolean {
  if (task.status !== 'open' || !task.dueAt) return false
  const due = Date.parse(task.dueAt)
  return Number.isFinite(due) && due < now
}

/** Whole days past due (at least 1) for overdue tasks, otherwise 0. */
export function daysOverdue(task: TaskLike, now = Date.now()): number {
  return isOverdue(task, now) ? Math.max(1, Math.floor((now - Date.parse(task.dueAt as string)) / 86_400_000)) : 0
}

/** Label shown instead of the plain status when a task is overdue. */
export function taskStatus(task: TaskLike, now = Date.now()): string {
  return isOverdue(task, now) ? 'overdue' : task.status || 'open'
}
