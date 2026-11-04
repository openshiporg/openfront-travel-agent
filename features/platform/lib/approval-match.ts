export type ApprovalCandidate = {
  id: string; actionType: string; targetId: string; amountCents: number | null;
  reason: string; status: string; expiresAt: string; requestedBy?: { id: string } | null;
  approvedBy?: { id: string } | null;
}

/** UI discovery only; the command still fingerprints and consumes under its transaction. */
export function matchingApproval(rows: ApprovalCandidate[], input: { actionType: string; targetId: string; amountCents: number; reason: string; actorId: string }, now = Date.now()) {
  return rows.find(a => a.status === 'approved' && a.actionType === input.actionType &&
    a.targetId === input.targetId && a.amountCents === input.amountCents &&
    a.reason.trim() === input.reason.trim() && a.requestedBy?.id === input.actorId &&
    Boolean(a.approvedBy?.id) && a.approvedBy?.id !== input.actorId && Date.parse(a.expiresAt) > now)?.id ?? null
}
