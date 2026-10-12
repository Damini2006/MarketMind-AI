/**
 * Funnel stage invariants.
 *
 * Run with `npm test` (node's built-in runner — no test dependency to add).
 *
 * These pin the properties the page depends on and that its earlier version
 * broke: a stage can never be larger than the one above it, no conversion can
 * exceed 100%, and a stage's label matches the population it counts.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { FUNNEL_STAGES, buildFunnel, customerStats } from './funnel.js'

const CUSTOMERS = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, name: `Customer ${id}` }))

// Hand-built so every threshold is exercised from both sides, including the
// single-large-order case that used to break nesting:
//   c1  6 orders, ₹12,000  -> every stage, VIP included
//   c2  3 orders, ₹6,000   -> through High Value
//   c3  3 orders, ₹3,000   -> through Brand Promoter
//   c4  2 orders, ₹1,000   -> Repeat only
//   c5  1 order,  ₹50,000  -> First Purchase only, despite the huge spend
//   c6  4 orders, ₹1,500   -> Engaged only (frequency without the spend)
//   c7, c8  no orders      -> the top of the funnel only
const SALES = [
  ...Array.from({ length: 6 }, () => ({ customer_id: 1, total_amount: 2000 })),
  ...Array.from({ length: 3 }, () => ({ customer_id: 2, total_amount: 2000 })),
  ...Array.from({ length: 3 }, () => ({ customer_id: 3, total_amount: 1000 })),
  ...Array.from({ length: 2 }, () => ({ customer_id: 4, total_amount: 500 })),
  { customer_id: 5, total_amount: 50000 },
  ...Array.from({ length: 4 }, () => ({ customer_id: 6, total_amount: 375 })),
]

// visitors, first purchase, repeat, engaged, promoter, high value, VIP
const EXPECTED_COUNTS = [8, 6, 5, 4, 3, 2, 1]

/** Every property the page relies on, for any input. */
function assertFunnelInvariants(stages, label = '') {
  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i]
    const above = i > 0 ? stages[i - 1] : null

    assert.ok(stage.count >= 0, `${label} ${stage.key}: negative count`)
    assert.ok(Number.isInteger(stage.count), `${label} ${stage.key}: non-integer count`)
    assert.ok(stage.pctOfTotal <= 100, `${label} ${stage.key}: pctOfTotal > 100`)
    assert.ok(stage.pctOfPrevious <= 100, `${label} ${stage.key}: conversion > 100%`)
    assert.ok(stage.pctOfTotal >= 0 && stage.pctOfPrevious >= 0,
      `${label} ${stage.key}: negative rate`)
    assert.ok(Number.isFinite(stage.pctOfTotal) && Number.isFinite(stage.pctOfPrevious),
      `${label} ${stage.key}: non-finite rate`)

    if (above) {
      assert.ok(stage.count <= above.count,
        `${label} ${stage.key} (${stage.count}) is larger than ${above.key} (${above.count})`)
      assert.equal(stage.dropoff, above.count - stage.count, `${label} ${stage.key}: dropoff`)
      assert.ok(stage.dropoff >= 0, `${label} ${stage.key}: negative dropoff`)
      assert.ok(stage.dropoffPct >= 0 && stage.dropoffPct <= 100,
        `${label} ${stage.key}: dropoffPct out of range`)
    }
  }
}

test('each stage is exactly the intersection of its own and every earlier condition', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)
  const stats = customerStats(CUSTOMERS, SALES)

  stages.forEach((stage, i) => {
    const cumulative = stats.filter((s) =>
      FUNNEL_STAGES.slice(0, i + 1).every((definition) => definition.qualifier(s)))
    assert.equal(stage.count, cumulative.length,
      `${stage.key} is not a subset of the stage above it`)
  })
  assertFunnelInvariants(stages)
})

test('counts and rates on data that exercises every threshold', () => {
  const { stages, total } = buildFunnel(CUSTOMERS, SALES)

  assert.equal(total, 8)
  assert.deepEqual(stages.map((s) => s.count), EXPECTED_COUNTS)
  assert.deepEqual(stages.map((s) => s.key), FUNNEL_STAGES.map((d) => d.key))
  assert.equal(stages[0].pctOfTotal, 100)
  assert.equal(stages[stages.length - 1].pctOfTotal, 12.5) // 1 of 8
  // Each stage-to-stage rate is a share of the stage above it, so all <= 100.
  assert.deepEqual(stages.map((s) => s.pctOfPrevious), [100, 75, 83.3, 80, 75, 66.7, 50])
})

test('the Engaged stage counts 3+ orders, which is what its label says', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)
  const engaged = stages.find((s) => s.key === 'engaged')
  const repeat = stages.find((s) => s.key === 'repeat')

  const threePlusOrders = [1, 2, 3, 6] // c6 has 4 orders, so a >= 5 rule would drop it
  assert.equal(engaged.count, threePlusOrders.length)
  assert.ok(engaged.count <= repeat.count)
  assert.match(engaged.label, /3\+ orders/)
  // The old logic (`orders >= 5`) counted only customer 1 here. This pins the fix.
  assert.notEqual(engaged.count, 1)
})

test('one huge single order cannot outgrow the stage above it', () => {
  const customers = [{ id: 1 }, { id: 2 }]
  const sales = [
    { customer_id: 1, total_amount: 100000 }, // one ₹1,00,000 order, no repeat business
    { customer_id: 2, total_amount: 100000 },
    { customer_id: 2, total_amount: 100000 },
    { customer_id: 2, total_amount: 100000 },
  ]
  const { stages } = buildFunnel(customers, sales)

  assertFunnelInvariants(stages, 'boom-and-bust')
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s.count]))
  assert.equal(byKey.first_purchase, 2)
  assert.equal(byKey.engaged, 1) // only customer 2 repeats
  assert.equal(byKey.high_value, 1) // customer 1's ₹1,00,000 does not count here
  assert.equal(byKey.vip, 1)
})

test('nesting is enforced by construction, not by the thresholds', () => {
  // A deliberately non-nested stage — the shape of the original bug — must still
  // come out as a subset, because each stage filters the survivors above it.
  const repeatQualifier = FUNNEL_STAGES[2].qualifier
  FUNNEL_STAGES.push({ key: 'broken', label: 'Broken', qualifier: (s) => s.spend >= 999999 })
  FUNNEL_STAGES[2].qualifier = () => true
  try {
    const { stages } = buildFunnel(CUSTOMERS, SALES)
    assertFunnelInvariants(stages, 'non-nested definitions')
    assert.equal(stages[stages.length - 1].count, 0)
  } finally {
    FUNNEL_STAGES.pop()
    FUNNEL_STAGES[2].qualifier = repeatQualifier
  }
})

test('dirty sales rows cannot poison a stage', () => {
  const customers = [{ id: 1 }, { id: 2 }]
  const sales = [
    { customer_id: 1, total_amount: '2000.50' }, // string, as a CSV import can leave it
    { customer_id: 1, total_amount: null }, // amount unknown
    { customer_id: 1, total_amount: 'not-a-number' }, // malformed
    { customer_id: 1, total_amount: 2000 },
    { customer_id: 99, total_amount: 999999 }, // not in the customer list
    { customer_id: null, total_amount: 500 }, // no customer at all
    { total_amount: 500 }, // field missing entirely
  ]
  const { stages, total } = buildFunnel(customers, sales)

  assert.equal(total, 2)
  assertFunnelInvariants(stages, 'dirty sales')
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s.count]))
  // Four purchase events for customer 1; the unusable amounts contribute no
  // spend, which is why 2000.50 + 0 + 0 + 2000 = 4000.50 stops short of High Value.
  assert.equal(byKey.first_purchase, 1)
  assert.equal(byKey.engaged, 1)
  assert.equal(byKey.promoter, 1) // 4000.50 clears ₹2,000
  assert.equal(byKey.high_value, 0) // ...but not ₹5,000
  assert.equal(byKey.vip, 0)
})

test('an empty funnel reports zeroes rather than NaN or 100%', () => {
  const cases = [
    // nothing at all: no denominator, so no rate — 0, never a flattering 100%
    { customers: [], sales: [], total: 0, visitors: 0, firstRate: 0 },
    // customers but no sales: the top of the funnel is real, everything below is 0
    { customers: CUSTOMERS, sales: [], total: 8, visitors: 8, firstRate: 100 },
    // sales that belong to nobody in the list: the population is still empty
    { customers: [], sales: SALES, total: 0, visitors: 0, firstRate: 0 },
  ]

  for (const testCase of cases) {
    const { stages, total } = buildFunnel(testCase.customers, testCase.sales)
    assertFunnelInvariants(stages, 'empty-ish')
    assert.equal(total, testCase.total)
    assert.equal(stages[0].count, testCase.visitors)
    assert.equal(stages[0].pctOfPrevious, testCase.firstRate)
    assert.equal(stages[1].pctOfPrevious, 0)
    stages.forEach((s) => {
      assert.ok(Number.isFinite(s.pctOfTotal) && Number.isFinite(s.pctOfPrevious))
      assert.ok(s.pctOfTotal <= 100 && s.pctOfPrevious <= 100)
    })
  }
})

/**
 * A small deterministic generator (mulberry32), so a failure names a seed that
 * reproduces it rather than a dataset that vanished with the run.
 */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One arbitrary business: few or many customers, orders that may belong to
 *  nobody in the list, amounts straddling every threshold and the odd malformed
 *  value, all of which the real inputs contain. */
function randomDataset(rand) {
  const customerCount = Math.floor(rand() * 12)
  const customers = Array.from({ length: customerCount }, (_, i) => ({ id: i + 1 }))
  const sales = []
  const orderCount = Math.floor(rand() * 40)

  for (let i = 0; i < orderCount; i += 1) {
    const roll = rand()
    // 10% of orders have no customer, and some name an id the list does not
    // hold: both are real, and neither may move a stage.
    const customerId = roll < 0.1 ? null : Math.floor(rand() * (customerCount + 2)) || null
    let amount
    if (roll < 0.05) {
      amount = [null, 'abc', ''][Math.floor(rand() * 3)]
    } else if (roll < 0.5) {
      amount = Math.round(rand() * 12000) // spans ₹2,000 / ₹5,000 / ₹10,000
    } else {
      amount = rand() * 500
    }
    sales.push({ customer_id: customerId, total_amount: amount })
  }

  return { customers, sales }
}

/**
 * The property the page exists to show: every stage is a subset of the one
 * above it, so counts can only shrink, no conversion can exceed 100% and no
 * drop-off can be negative — for any input, not just the hand-picked ones.
 */
test('stages are monotonically non-increasing, so no conversion exceeds 100%', () => {
  const datasets = [
    { label: 'empty', customers: [], sales: [] },
    { label: 'customers without sales', customers: CUSTOMERS, sales: [] },
    { label: 'sales for customers not in the list', customers: [], sales: SALES },
    { label: 'hand-built thresholds', customers: CUSTOMERS, sales: SALES },
    // One customer with one enormous order: the shape that produced >100%.
    { label: 'single big spender', customers: [{ id: 1 }, { id: 2 }],
      sales: [{ customer_id: 1, total_amount: 1000000 }, { customer_id: 2, total_amount: 10 }] },
    // Everyone identical: the funnel should be flat, never inverted.
    { label: 'twins', customers: [{ id: 1 }, { id: 2 }, { id: 3 }],
      sales: [{ customer_id: 1, total_amount: 2000 }, { customer_id: 2, total_amount: 2000 }, { customer_id: 3, total_amount: 2000 }] },
  ]

  const rand = mulberry32(20261012)
  for (let i = 0; i < 300; i += 1) {
    datasets.push({ label: `random dataset #${i}`, ...randomDataset(rand) })
  }

  for (const { label, customers, sales } of datasets) {
    const { stages, total } = buildFunnel(customers, sales)
    assert.equal(stages.length, FUNNEL_STAGES.length, `${label}: unexpected stage count`)
    assertFunnelInvariants(stages, label)

    stages.forEach((stage, i) => {
      assert.ok(stage.count <= total, `${label} ${stage.key}: stage larger than the funnel`)
      assert.ok(stage.pctOfPrevious <= 100,
        `${label} ${stage.key}: conversion ${stage.pctOfPrevious}% exceeds 100%`)
      assert.ok(stage.pctOfTotal <= 100,
        `${label} ${stage.key}: share of funnel ${stage.pctOfTotal}% exceeds 100%`)

      if (i === 0) return
      const above = stages[i - 1]
      assert.ok(stage.count <= above.count,
        `${label}: ${stage.key} (${stage.count}) exceeds ${above.key} (${above.count})`)
      assert.equal(stage.dropoff, above.count - stage.count,
        `${label} ${stage.key}: drop-off does not match the stages`)
      assert.ok(stage.dropoff >= 0, `${label} ${stage.key}: negative drop-off ${stage.dropoff}`)
      assert.ok(stage.pctOfTotal <= above.pctOfTotal,
        `${label}: ${stage.key} (${stage.pctOfTotal}%) outranks ${above.key} (${above.pctOfTotal}%)`)
    })
  }

  // A guard on the test itself: if the generator ever produced nothing but empty
  // funnels, the loop above would pass while proving nothing.
  const nonEmpty = datasets.filter(({ customers, sales }) => {
    const { stages } = buildFunnel(customers, sales)
    return stages[0].count > 0 && stages[stages.length - 1].count > 0
  })
  assert.ok(nonEmpty.length >= 20,
    `only ${nonEmpty.length} datasets reached the bottom of the funnel; the property was barely exercised`)
  const inverted = datasets.some(({ customers, sales }) => {
    const { stages } = buildFunnel(customers, sales)
    return stages.some((s, i) => i > 0 && s.count > stages[i - 1].count)
  })
  assert.equal(inverted, false, 'some dataset produced an inverted funnel')
})
