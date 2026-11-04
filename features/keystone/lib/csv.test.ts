import test from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv, centsDecimal } from './csv'
import { commissionForecast, receivableDueAt } from './commission-forecast'

test('formula starters are neutralised, including after whitespace, and quotes are doubled', () => {
  for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x', ' =HYPERLINK("x")', '\r=x'])
    assert.ok(csvCell(evil).startsWith(`"'`), evil)
  assert.equal(csvCell('=1+1'), `"'=1+1"`)
  assert.equal(csvCell(' =x'), `"' =x"`)
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"')
  assert.equal(csvCell('a\nb\r\nc'), '"a b c"')
  assert.equal(csvCell(null), '""')
})
test('numbers and money cells are unquoted and not guarded; negatives stay numeric', () => {
  assert.equal(csvCell(centsDecimal(-1250)), '-12.50')
  assert.equal(csvCell(centsDecimal(5)), '0.05')
  assert.equal(csvCell(centsDecimal(123456)), '1234.56')
  assert.equal(csvCell(42), '42')
  assert.ok(!csvCell({ num: '=1+1' } as any).includes('=1+1'), 'a forged num object never reaches the file raw')
})
test('rows are CRLF separated', () => { assert.equal(toCsv(['a', 'b'], [['x', centsDecimal(100)]]), '"a","b"\r\n"x",1.00\r\n') })

const NOW = Date.parse('2026-11-10T12:00:00Z')
const comp = (o: any) => ({ id: o.id || 'c', title: 'T', bookingStatus: 'booked', commissionStatus: 'expected', commissionCents: 10000, currencyCode: 'USD', endAt: '2026-09-01T12:00:00Z', supplier: { id: 's1', name: 'Alpha', commissionPaymentTermsDays: 30 }, trip: { title: 'Trip' }, allocations: [], ...o })
test('due date is end plus the supplier terms, falling back to start and then none', () => {
  assert.equal(receivableDueAt(comp({}) as any), '2026-10-01T12:00:00.000Z')
  assert.equal(receivableDueAt(comp({ endAt: null, startAt: '2026-09-01T12:00:00Z', supplier: { id: 's', name: 'S', commissionPaymentTermsDays: 45 } }) as any), '2026-10-16T12:00:00.000Z')
  assert.equal(receivableDueAt(comp({ endAt: null, startAt: null }) as any), null)
})
test('forecast: totals per supplier and month, overdue only when outstanding and past due', () => {
  const f = commissionForecast([
    comp({ id: 'a', commissionCents: 10000, allocations: [{ amountCents: 4000 }] }),                       // due Oct 1, 6000 outstanding, late 40d
    comp({ id: 'b', commissionCents: 5000, allocations: [{ amountCents: 5000 }] }),                         // fully received: not overdue
    comp({ id: 'c', commissionCents: 8000, endAt: '2026-12-20T12:00:00Z', supplier: { id: 's2', name: 'Beta', commissionPaymentTermsDays: 30 } }), // due Jan, future
    comp({ id: 'd', bookingStatus: 'quoted' }), comp({ id: 'e', bookingStatus: 'cancelled' }), comp({ id: 'f', commissionStatus: 'written_off' }), comp({ id: 'g', commissionCents: 0 }),
    comp({ id: 'h', commissionCents: 2000, endAt: null, startAt: null }),                                    // no date
  ] as any, NOW)
  assert.equal(f.excluded, 4)
  const alpha = f.bySupplier.find((r) => r.label === 'Alpha')!
  assert.deepEqual([alpha.expectedCents, alpha.receivedCents, alpha.outstandingCents, alpha.overdueCents, alpha.count], [17000, 9000, 8000, 6000, 3])
  assert.deepEqual(f.byMonth.map((r) => r.key), ['2026-10', '2027-01', 'none'])
  assert.deepEqual(f.overdue.map((r) => [r.id, r.outstandingCents, r.daysLate]), [['a', 6000, 40]])
})
test('due today is not late; currencies never mix', () => {
  const f = commissionForecast([comp({ id: 'a', endAt: '2026-10-11T12:00:00Z' }), comp({ id: 'b', currencyCode: 'EUR', commissionCents: 300 })] as any, NOW)
  assert.equal(f.overdue.find((r) => r.id === 'a'), undefined)
  assert.equal(f.bySupplier.filter((r) => r.label === 'Alpha').length, 2)
})
