import { toCents } from './cents'

export type DraftItem = { title: string; kind: string; sell: string; commissionPct: string }
export type DraftOption = { title: string; items: DraftItem[] }
export const ITEM_KINDS = ['hotel', 'cruise', 'tour', 'flight', 'transfer', 'rail', 'insurance', 'activity', 'fee']

type Built = { ok: true; introNote: string; options: { title: string; items: { title: string; kind: string; sellCents: number; estimatedCommissionBps: number }[] }[] } | { ok: false; error: string }

/** Validates the proposal form and converts dollars and percentages to the integer cents and basis points buildProposal expects. */
export function buildProposalPayload(introNote: string, options: DraftOption[]): Built {
  if (!options.length) return { ok: false, error: 'Add at least one option' }
  const out: { title: string; items: { title: string; kind: string; sellCents: number; estimatedCommissionBps: number }[] }[] = []
  for (const [oi, option] of options.entries()) {
    const label = option.title.trim() || `Option ${oi + 1}`
    if (!option.title.trim()) return { ok: false, error: `${label}: title is required` }
    if (!option.items.length) return { ok: false, error: `${label}: add at least one item` }
    const items = []
    for (const [ii, item] of option.items.entries()) {
      const where = `${label}, item ${ii + 1}`
      if (!item.title.trim()) return { ok: false, error: `${where}: title is required` }
      if (!ITEM_KINDS.includes(item.kind)) return { ok: false, error: `${where}: choose a kind` }
      const sellCents = toCents(item.sell)
      if (sellCents === null) return { ok: false, error: `${where}: enter a price above zero with at most two decimals` }
      const pct = item.commissionPct.trim() === '' ? 0 : Number(item.commissionPct)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100 || Math.round(pct * 100) / 100 !== pct) return { ok: false, error: `${where}: commission must be 0 to 100 with at most two decimals` }
      items.push({ title: item.title.trim(), kind: item.kind, sellCents, estimatedCommissionBps: Math.round(pct * 100) })
    }
    out.push({ title: option.title.trim(), items })
  }
  return { ok: true, introNote: introNote.trim(), options: out }
}
