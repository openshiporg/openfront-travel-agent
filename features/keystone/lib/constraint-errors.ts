import { GraphQLError } from 'graphql'

type Rule = { code: string; message: string; fields?: string[] }
const AMOUNT = 'TRAVEL_INVALID_AMOUNT'
const CURRENCY = { code: 'TRAVEL_INVALID_CURRENCY', message: 'Currency must be a three-letter code, such as USD.' }
const TIME = 'TRAVEL_INVALID_TIME_RANGE'

/** Database rules (migrations/20261108130000_concerts_invariants) and what a person should read when one refuses a write. */
export const CONSTRAINT_MESSAGES: Record<string, Rule> = {
  AgencySettings_amounts_valid: { code: AMOUNT, message: 'Fees and thresholds can’t be negative, and the host agency split must be between 0% and 100%.' },
  Supplier_rates_valid: { code: 'TRAVEL_INVALID_RATE', message: 'A supplier’s commission must be between 0% and 100%, and payment terms can’t be negative.' },
  Inquiry_amounts_valid: { code: AMOUNT, message: 'A budget can’t be negative.' },
  Inquiry_window_order: { code: TIME, message: 'The travel window must end on or after it starts.' },
  Trip_amounts_valid: { code: AMOUNT, message: 'The planning fee can’t be negative.' },
  Trip_date_order: { code: TIME, message: 'A trip must end on or after its start date.' },
  TripComponent_amounts_valid: { code: AMOUNT, message: 'Sell price, net cost, deposit and commission can’t be negative, and the commission rate must be between 0% and 100%.' },
  TripComponent_deposit_within_sell: { code: AMOUNT, message: 'A deposit can’t be more than the sell price.' },
  TripComponent_time_order: { code: TIME, message: 'A booking must end on or after it starts.' },
  TripComponent_due_order: { code: TIME, message: 'The deposit must be due on or before the final payment.' },
  ProposalItem_amounts_valid: { code: AMOUNT, message: 'A price can’t be negative, and the estimated commission must be between 0% and 100%.' },
  Proposal_deposit_valid: { code: 'TRAVEL_INVALID_RATE', message: 'The deposit must be between 0% and 100%.' },
  ClientInvoice_amounts_valid: { code: AMOUNT, message: 'Invoice amounts can’t be negative.' },
  ClientInvoice_collected_within_total: { code: 'TRAVEL_INVOICE_OVERPAID', message: 'An invoice can’t collect more than its total.' },
  ClientInvoiceLine_amounts_valid: { code: AMOUNT, message: 'Invoice line amounts can’t be negative and the quantity must be at least one.' },
  PaymentSchedule_amount_valid: { code: AMOUNT, message: 'A scheduled payment can’t be negative.' },
  CommissionReceipt_amount_valid: { code: AMOUNT, message: 'A commission receipt must be a positive amount.' },
  CommissionAllocation_amounts_valid: { code: 'TRAVEL_INVALID_ALLOCATION', message: 'An allocation must be positive, and an overpayment can’t exceed it.' },
  SupplierPayment_amount_valid: { code: AMOUNT, message: 'A supplier payment must be a positive amount.' },
  SupplierPayment_within_net_cost: { code: 'TRAVEL_SUPPLIER_OVERPAID', message: 'Supplier payments can’t exceed the booking’s net cost.' },
  ClientFundsEntry_amount_valid: { code: AMOUNT, message: 'A client funds entry can’t be zero.' },
  ClientFundsEntry_balance_non_negative: { code: 'TRAVEL_FUNDS_OVERDRAWN', message: 'A trip’s client funds can’t go below zero. Reload the balance and try again.' },
  AdvisorCommissionLedger_amount_valid: { code: AMOUNT, message: 'A ledger entry can’t be zero.' },
  ManagerApproval_amounts_valid: { code: AMOUNT, message: 'An approval amount can’t be negative.' },
  ManagerApproval_time_order: { code: TIME, message: 'An approval can’t expire before it is requested.' },
  Traveler_passport_valid: { code: TIME, message: 'A passport can’t expire before the traveler was born.' },
  Payment_amounts_valid: { code: AMOUNT, message: 'A payment must be positive, and refunds can’t exceed it.' },
  Refund_amount_positive: { code: AMOUNT, message: 'A refund must be a positive amount.' },
  Refund_within_payment: { code: 'TRAVEL_REFUND_EXCEEDS_PAYMENT', message: 'Refunds can’t exceed what was paid, and must be in the payment’s currency.' },
  PaymentCollection_amounts_valid: { code: AMOUNT, message: 'Payment collection amounts can’t be negative.' },
  PaymentSession_amount_valid: { code: AMOUNT, message: 'A payment amount can’t be negative.' },
  Trip_currency_code: CURRENCY,
  TripComponent_currency_code: CURRENCY,
  ClientInvoice_currency_code: CURRENCY,
  ClientInvoiceLine_currency_code: CURRENCY,
  PaymentSchedule_currency_code: CURRENCY,
  CommissionReceipt_currency_code: CURRENCY,
  CommissionAllocation_currency_code: CURRENCY,
  SupplierPayment_currency_code: CURRENCY,
  ClientFundsEntry_currency_code: CURRENCY,
  AdvisorCommissionLedger_currency_code: CURRENCY,
  Payment_currency_code: CURRENCY,
  Refund_currency_code: CURRENCY,
  AgencySettings_currency_code: CURRENCY,
  Inquiry_currency_code: CURRENCY,
  ProposalItem_currency_code: CURRENCY,
  PaymentSession_currency_code: CURRENCY,
  PaymentCollection_currency_code: CURRENCY,
  Proposal_trip_version_key: { code: 'TRAVEL_DUPLICATE_PROPOSAL', message: 'That proposal version already exists. Reload and try again.', fields: ['trip', 'version'] },
  Proposal_one_accepted_per_trip: { code: 'TRAVEL_DUPLICATE_ACCEPTANCE', message: 'A proposal has already been accepted for this trip.', fields: ['trip'] },
  CommissionAllocation_receipt_component_key: { code: 'TRAVEL_DUPLICATE_ALLOCATION', message: 'That receipt is already allocated to this booking.', fields: ['component', 'receipt'] },
  Supplier_name_key: { code: 'TRAVEL_DUPLICATE_NAME', message: 'A supplier with that name already exists.', fields: ['name'] },
}

type ErrorLink = {
  message?: unknown; meta?: { target?: unknown }; code?: unknown; originalError?: unknown; cause?: unknown
  // Keystone returns uncoded Prisma failures (CHECK and trigger violations) as "Prisma error" with the text here.
  extensions?: { debug?: { message?: unknown }; prisma?: { meta?: unknown } }
} | null | undefined

function chain(error: unknown) {
  const out: ErrorLink[] = []
  let current = error as ErrorLink
  for (let depth = 0; current && depth < 6; depth++) { out.push(current); current = (current.originalError ?? current.cause) as ErrorLink }
  return out
}

/** The readable, coded refusal for a known constraint violation anywhere in the error's cause chain, or null. */
export function constraintRefusal(error: unknown): { code: string; message: string } | null {
  for (const link of chain(error)) {
    const text = [
      link?.message, typeof link?.meta === 'object' ? JSON.stringify(link.meta) : '',
      link?.extensions?.debug?.message ?? '', link?.extensions?.prisma?.meta ? JSON.stringify(link.extensions.prisma.meta) : '',
    ].join(' ')
    for (const [name, rule] of Object.entries(CONSTRAINT_MESSAGES)) if (text.includes(name)) return rule
    // Prisma sometimes reports a unique violation by its fields instead of the index name.
    const listed = /Unique constraint failed on the fields: \((.*?)\)(?:\s|$)/.exec(String(link?.message || ''))?.[1]?.match(/`([^`]+)`/g)?.map(field => field.slice(1, -1))
    // Raw SQL writes surface Postgres's own detail instead: Key (event, artist)=(…) already exists.
    const keyed = /Key \((.*?)\)=\(.*\) already exists/.exec(text)?.[1]?.split(',').map(field => field.trim().replace(/^"|"$/g, ''))
    const unwrap = (field: unknown) => String(field).replace(/^lower\((.*)\)$/, '$1')
    const fields = (link?.code === 'P2002' && Array.isArray(link?.meta?.target) ? link.meta.target : listed ?? keyed)?.map(unwrap)
    if (fields?.length) {
      const target = [...fields].map(String).sort().join(',')
      const matches = Object.values(CONSTRAINT_MESSAGES).filter(rule => rule.fields && [...rule.fields].sort().join(',') === target)
      if (matches.length === 1) return matches[0]
      // Prisma names fields, not the index: when two rules share a field list, do not guess which one refused.
      if (matches.length > 1) return { code: 'TRAVEL_DUPLICATE_RECORD', message: 'That record already exists. Reload and check before adding it again.' }
    }
  }
  return null
}

export function constraintGraphQLError(error: GraphQLError, refusal: { code: string; message: string }): GraphQLError {
  return new GraphQLError(refusal.message, { nodes: error.nodes, source: error.source, positions: error.positions, path: error.path, extensions: { code: refusal.code } })
}
