/**
 * Funnel stage invariants.
 *
 * Run with `npm test` (node's built-in runner — no test dependency to add).
 *
 * These pin the properties the page depends on and that its earlier version
 * broke: a stage can never be larger than the one above it, no conversion can
 * exceed 100%, and a stage's label matches the population it counts.
 *
 * The property test at the end checks them against thousands of generated
 * businesses, freshly drawn on every run so the sweep does not explore the same
 * corner forever. When one of those breaks an invariant, the input is minimised
 * to the smallest case that still breaks it before the test fails, so a failure
 * arrives with a reproduction (and the seed to replay the whole sweep with
 * FUNNEL_PROPERTY_SEED) rather than a wall of generator output.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { FUNNEL_STAGES, buildFunnel, customerStats } from './funnel.js'
import {
  dropoutRecordsForStage,
  dropoutRecordsForAllStages,
} from './funnel.js'

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

/** The generator addressed by seed, so a failure is one number away from being
 *  reproduced instead of a dataset that vanished with the run. */
function datasetFromSeed(seed) {
  return randomDataset(mulberry32(seed))
}

/**
 * The seed this run draws its businesses from.
 *
 * The property is claimed for *any* input, so checking it against the same 5,000
 * businesses on every run would quietly stop testing new ground the moment the
 * generator changed. Each run therefore draws fresh ones. The seed is printed
 * here and reported on any failure, so "it broke on a business I cannot see" is
 * never the end of the story: `FUNNEL_PROPERTY_SEED=<n> npm test` replays the
 * identical sweep.
 *
 * `FUNNEL_PROPERTY_SEED` overrides the draw, which is what makes a reported seed
 * reproducible rather than merely recorded.
 */
const RUN_SEED = (() => {
  const fromEnv = process.env.FUNNEL_PROPERTY_SEED
  if (fromEnv != null && fromEnv !== '') {
    const parsed = Number(fromEnv)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(
        `FUNNEL_PROPERTY_SEED must be a non-negative integer, got ${JSON.stringify(fromEnv)} ` +
        '(it seeds the same generator the failure report replays)',
      )
    }
    return parsed
  }
  // A fresh seed per run: the clock to the millisecond, mixed with a random draw
  // so two runs in the same millisecond still explore different businesses. Kept
  // as a uint32 so RUN_SEED + i addresses mulberry32 without colliding.
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0
})()

// Thousands of businesses, not hundreds. The invariants are claimed for *any*
// input, so how many inputs are tried is how strong the claim is, and each input
// is a dozen customers and a few dozen orders — the whole sweep stays well under
// a second, which is cheap enough to run on every `npm test`.
const GENERATED_DATASETS = 5000

// Say which businesses this run drew, so even a passing CI run's log records the
// seed a later failure can be reproduced from.
console.log(
  `funnel property test: ${GENERATED_DATASETS} businesses from seed ${RUN_SEED} ` +
  `(replay with FUNNEL_PROPERTY_SEED=${RUN_SEED} npm test)`,
)

/**
 * Every invariant the page relies on, checked against one dataset. Throws on the
 * first one broken, which is what makes it usable as the property a smaller
 * dataset has to keep breaking.
 */
function checkDataset(build, { customers, sales }, label = '') {
  const { stages, total } = build(customers, sales)
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
      `${label}: ${stage.key} (${stage.count}) is larger than ${above.key} (${above.count})`)
    assert.equal(stage.dropoff, above.count - stage.count,
      `${label} ${stage.key}: drop-off does not match the stages`)
    assert.ok(stage.dropoff >= 0, `${label} ${stage.key}: negative drop-off ${stage.dropoff}`)
    assert.ok(stage.pctOfTotal <= above.pctOfTotal,
      `${label}: ${stage.key} (${stage.pctOfTotal}%) outranks ${above.key} (${above.pctOfTotal}%)`)
  })

  return { stages, total }
}

/**
 * `checkDataset` as a value: the stages it accepted plus a `breach` of null, or
 * a null `stages` and the message of the invariant that failed. Reporting
 * instead of throwing is what lets the invariant be used as the predicate a
 * minimiser searches against.
 */
function examine(build, dataset, label = '') {
  try {
    return { ...checkDataset(build, dataset, label), breach: null }
  } catch (error) {
    return { stages: null, total: 0, breach: error.message }
  }
}

const breaksInvariant = (build, dataset, label) =>
  examine(build, dataset, label).breach !== null

/** Amounts to try when looking for a smaller case, smallest first: no spend, a
 *  token spend, then each spend threshold in the chain, and finally the
 *  unusable values the generator also produces (kept last, so a number is always
 *  preferred whenever one keeps the breach alive). */
const SIMPLER_AMOUNTS = [0, 1, 2000, 5000, 10000, null, 'abc', '']

/**
 * A well-founded measure of "smaller dataset": fewer orders, then fewer
 * customers, then less money, then smaller customer ids. Every move below
 * returns candidates strictly below their input on this measure, which is what
 * makes the search terminate instead of circling.
 */
function sizeOf({ customers, sales }) {
  const amount = (value) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }
  return [
    sales.length,
    customers.length,
    sales.reduce((sum, sale) => sum + amount(sale.total_amount), 0),
    customers.reduce((sum, customer) => sum + amount(customer.id), 0),
  ]
}

function strictlySmaller(candidate, current) {
  for (let i = 0; i < candidate.length; i += 1) {
    if (candidate[i] !== current[i]) return candidate[i] < current[i]
  }
  return false
}

function cloneDataset({ customers, sales }) {
  return {
    customers: customers.map((customer) => ({ ...customer })),
    sales: sales.map((sale) => ({ ...sale })),
  }
}

/** Give up rather than grind forever — and say so, since a minimiser that
 *  quietly returns a half-shrunk case would be worse than a slow one. */
const MAX_CANDIDATES = 200000

/**
 * The moves the minimiser may make, each one strictly shrinking the dataset:
 * drop orders nothing counts, drop a customer (with its orders, which then count
 * nothing), drop a single order, lower a single amount, and renumber the
 * customers from 1 so the reported case reads the same every time.
 *
 * Smaller is only half of it: a candidate is kept only when the invariant still
 * breaks, so a reported minimal case always reproduces the failure it was found
 * for. Shrinking can lose detail, never the bug.
 */
const MOVES = [
  (dataset) => {
    const listed = new Set(dataset.customers.map((customer) => customer.id))
    // Orders for a customer outside the list cannot move any stage (every stage
    // is built from the customer list), so they are noise in a reported case.
    if (dataset.sales.every((sale) => listed.has(sale.customer_id))) return []
    return [{ ...dataset, sales: dataset.sales.filter((sale) => listed.has(sale.customer_id)) }]
  },
  (dataset) => dataset.customers.map((customer, i) => ({
    customers: dataset.customers.filter((_, j) => j !== i),
    // That customer's orders go with it; keeping them would leave orders nothing
    // counts, i.e. noise again.
    sales: dataset.sales.filter((sale) => sale.customer_id !== customer.id),
  })),
  (dataset) => dataset.sales.map((_, i) => ({
    ...dataset,
    sales: dataset.sales.filter((__, j) => j !== i),
  })),
  (dataset) => dataset.sales.flatMap((sale, i) => SIMPLER_AMOUNTS.map((amount) => ({
    ...dataset,
    sales: dataset.sales.map((other, j) => (j === i ? { ...other, total_amount: amount } : other)),
  }))),
  (dataset) => {
    const renumbered = new Map(dataset.customers.map((customer, i) => [customer.id, i + 1]))
    return [{
      customers: dataset.customers.map((customer, i) => ({ ...customer, id: i + 1 })),
      sales: dataset.sales.map((sale) => ({
        ...sale,
        customer_id: renumbered.get(sale.customer_id) ?? sale.customer_id,
      })),
    }]
  },
]

/**
 * Shrink a dataset that breaks an invariant down to a 1-minimal one: a case
 * where dropping any customer, dropping any order, lowering any amount or
 * numbering the customers differently makes the breach disappear — nothing left
 * to remove.
 *
 * `build` is the funnel under test rather than `buildFunnel` itself, so the same
 * minimiser can be shown working against a deliberately broken chain. The
 * invariant is re-checked for every candidate, never reasoned about, so whatever
 * comes back is guaranteed to reproduce the failure.
 */
function minimiseBreach(build, dataset, label = '') {
  if (!breaksInvariant(build, dataset, label)) {
    throw new Error(`${label || 'dataset'} breaks no invariant, so there is nothing to minimise`)
  }

  let smallest = cloneDataset(dataset)
  let examined = 1
  let changed = true

  // Restart the whole move list after every accepted candidate, and stop when a
  // full sweep finds nothing smaller: that fixpoint *is* 1-minimality.
  while (changed) {
    changed = false
    for (const move of MOVES) {
      for (const candidate of move(smallest)) {
        examined += 1
        if (examined > MAX_CANDIDATES) {
          throw new Error(`minimising ${label || 'the dataset'} examined ${examined} candidates without settling`)
        }
        if (!strictlySmaller(sizeOf(candidate), sizeOf(smallest))) continue
        if (breaksInvariant(build, candidate, label)) {
          smallest = candidate
          changed = true
          break
        }
      }
      if (changed) break
    }
  }

  return { dataset: smallest, breach: examine(build, smallest, label).breach, examined }
}

/** Fail with the smallest reproduction. An assertion message alone would leave
 *  the reader to find the trigger somewhere inside a generator's output. */
function reportBreach(build, dataset, label) {
  const minimal = minimiseBreach(build, dataset, label)
  assert.fail([
    `${label} breaks a funnel invariant, so the chain in funnel.js is not`,
    'non-increasing for that input:',
    `  ${examine(build, dataset, label).breach}`,
    '',
    `Reduced from ${dataset.customers.length} customers and ${dataset.sales.length} orders to the`,
    `smallest case that still breaks it (${minimal.examined} candidates tried; there is no`,
    'customer to drop, no order to drop, no amount to lower and no other numbering',
    'that keeps the breach alive):',
    `  ${JSON.stringify(minimal.dataset)}`,
    `  which breaks it with: ${minimal.breach}`,
    '',
    dataset.seed == null
      ? `The input is the hand-built case labelled "${label}".`
      : [
        `Reproduce the original input with: datasetFromSeed(${dataset.seed})`,
        `Re-run this whole sweep from seed ${RUN_SEED} with: FUNNEL_PROPERTY_SEED=${RUN_SEED} npm test`,
      ].join('\n  '),
  ].join('\n'))
}

/**
 * The property the page exists to show: every stage is a subset of the one above
 * it, so counts can only shrink, no conversion can exceed 100% and no drop-off
 * can be negative — for any input, not just the hand-picked ones.
 *
 * The hand-built cases come first (each one says why it is interesting), then
 * `GENERATED_DATASETS` seeded businesses. A failure is reported with its seed and
 * with the smallest dataset that still breaks the invariant, so the test hands
 * over a reproduction rather than an assertion.
 */

/** Stage dropouts and their reason, formatted for the page and for the export.
 *
 * `buildFunnel` fills `stages[i].dropped_to_next` and `has_dropdown`; the
 * helpers below expose those records with a reason attached. The tests pin that
 * a dropout list is always a subset of the stage above, that it shrinks when the
 * funnel narrows, and that an export never includes customers who are still in
 * the funnel.
 */
test('each stage carries the customers that dropped off to the next one', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)

  // The last stage has nobody to drop to.
  assert.equal(stages[stages.length - 1].dropped_to_next, null)
  assert.equal(stages[stages.length - 1].has_dropdown, false)

  // A stage with no dropoff has an empty dropout set, not null.
  for (const stage of stages) {
    assert.ok(stage.dropped_to_next == null || Array.isArray(stage.dropped_to_next))
    assert.ok(typeof stage.has_dropdown === 'boolean')
  }

  // Every customer in dropouts[i] reached stage i (survived above it) and then
  // failed the qualifier at i + 1.
  for (let i = 0; i < stages.length - 1; i += 1) {
    const stage = stages[i]
    if (!stage.dropped_to_next) continue
    for (const r of stage.dropped_to_next) {
      for (let j = 0; j <= i; j += 1) {
        assert.ok(FUNNEL_STAGES[j].qualifier(r), `${r.customer.name} should have reached stage ${stage.key}`)
      }
      assert.ok(!FUNNEL_STAGES[i + 1].qualifier(r),
        `${r.customer.name} should have dropped at ${stages[i + 1].key}`)
    }
  }

  // Dropouts(i) is a subset of the population that reached stage i, which is a
  // subset of the population that reached stage i - 1 — so no customer appears in
  // two different dropout lists.
  const seen = new Set()
  for (let i = 0; i < stages.length - 1; i += 1) {
    for (const r of stages[i].dropped_to_next || []) {
      assert.ok(!seen.has(r.customer.id), `${r.customer.name} appears in two dropout lists`)
      seen.add(r.customer.id)
    }
  }
})

test('a stage shows dropouts only when its list is small enough', () => {
  // A funnel with many customers whose survivors reach stage 1 are FEW: the
  // first stage's dropout set should be small and listed. (The top stage itself
  // should NOT be listed because it is large — revisit that separately once
  // ENUMERABLE_THRESHOLD supports top-stage enumeration.)
  const manyCustomers = Array.from({ length: 500 }, (_, i) => ({
    id: i + 1, name: `Customer ${i + 1}`,
  }))
  const salesForThose = [
    { customer_id: 1, total_amount: 2000 },
    { customer_id: 1, total_amount: 4000 },
    { customer_id: 1, total_amount: 6000 },
    { customer_id: 2, total_amount: 500 },
  ]
  const { stages: manyStages } = buildFunnel(manyCustomers, salesForThose)
  // Stage 0 (visitors) has many dropouts — not listed.
  assert.equal(manyStages[0].has_dropdown, false,
    'the top stage of a large funnel should not expose a dropdown')
  // Stage 1 (first_purchase) has a small dropout set (the customers who only
  // had one order) — should be listed.
  assert.ok(manyStages[1].has_dropdown,
    'a small dropout set should still be listed even when the funnel is big')
})

test('dropout records carry a meaningful reason', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)
  const allRecords = dropoutRecordsForAllStages(stages)
  const records = allRecords.filter((r) => r.length > 0)
  assert.ok(records.length > 0, 'expected at least one stage to carry dropouts in the hand-built set')

  for (const stageRecords of records) {
    for (const record of stageRecords) {
      assert.equal(typeof record.reason, 'string', 'reason must be a string')
      assert.ok(record.reason.length > 0, 'reason must not be empty')
      // The page renders these two numbers next to the reason, so an export row
      // that carries no orders/spend would print "₹NaN" — the record has to
      // carry the same figures the qualifier judged the customer on.
      assert.ok(Number.isFinite(record.orders), 'orders must be a finite number')
      assert.ok(Number.isFinite(record.spend), 'spend must be a finite number')
    }
  }

  // Reason clauses are deterministic: the same customer and the same dropout
  // stage should produce the same reason every time.
  const firstStageWithDropouts = allRecords.find((r) => r.length > 0)
  if (firstStageWithDropouts) {
    const first = firstStageWithDropouts[0]
    const firstStageIndex = stages.findIndex((stage) => stage.dropped_to_next && stage.dropped_to_next.length > 0)
    const again = dropoutRecordsForStage(stages[firstStageIndex], firstStageIndex).find(
      (r) => r.customer.id === first.customer.id,
    )
    assert.ok(again)
    assert.equal(again.reason, first.reason,
      'the same dropout should produce the same reason every time')
  }
})

test('a dropout reason names the requirement the customer actually missed', () => {
  // One customer with plenty of orders but ₹6,000 of spend: it clears every
  // stage through High Value and fails only VIP's ₹10,000 threshold, so the
  // reason has to name that threshold rather than a generic fallback.
  const customers = [{ id: 1, name: 'Spender' }]
  const sales = Array.from({ length: 3 }, () => ({ customer_id: 1, total_amount: 2000 }))
  const { stages } = buildFunnel(customers, sales)

  const highValue = stages.find((s) => s.key === 'high_value')
  const records = dropoutRecordsForStage(highValue, stages.indexOf(highValue))

  assert.equal(records.length, 1)
  assert.equal(records[0].orders, 3)
  assert.equal(records[0].spend, 6000)
  assert.equal(records[0].reason, 'spend below 10,000')
  assert.equal(records[0].stageFrom, highValue.label)
  assert.equal(records[0].stageTo, stages.find((s) => s.key === 'vip').label)

  // The reason is derived from each stage's declared `requires`, not from the
  // qualifier's source text: a bundler rewrites the literal `10000` as `1e4`,
  // which used to turn every spend clause into the generic fallback while the
  // numbers next to it stayed correct.
  for (const definition of FUNNEL_STAGES) {
    assert.ok(Array.isArray(definition.requires), `${definition.key} must declare its requirements`)
  }

  // A frequency shortfall reads as a count, not a threshold, and throws the
  // "only 1 order" singular in.
  const oneOrder = buildFunnel(
    [{ id: 1, name: 'One' }],
    [{ customer_id: 1, total_amount: 50 }],
  ).stages
  const firstPurchase = oneOrder.find((s) => s.key === 'first_purchase')
  const firstRecords = dropoutRecordsForStage(firstPurchase, oneOrder.indexOf(firstPurchase))
  assert.equal(firstRecords[0].reason, 'only 1 order')
})

test('dropout exports never include customers still in the funnel', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)

  // Every dropout at every stage should not be in the final stage.
  for (const stage of stages.slice(0, stages.length - 1)) {
    if (!stage.dropped_to_next) continue
    for (const r of stage.dropped_to_next) {
      assert.ok(!FUNNEL_STAGES[FUNNEL_STAGES.length - 1].qualifier(r),
        `${r.customer.name} should not be in the final stage`)
    }
  }

  // Also: the total of all dropout counts should not exceed the total number of
  // customers, because each customer can only be in one dropout list.
  const allDropouts = new Set()
  for (const stage of stages.slice(0, -1)) {
    if (!stage.dropped_to_next) continue
    for (const r of stage.dropped_to_next) {
      assert.ok(!allDropouts.has(r.customer.id))
      allDropouts.add(r.customer.id)
    }
  }
  assert.ok(allDropouts.size <= CUSTOMERS.length,
    `total dropouts ${allDropouts.size} should not exceed ${CUSTOMERS.length}`)

  // Dropdowns come from the adjacent-stage lists, which populate from the same
  // survivors that buildFunnel uses.
  for (const stage of stages.slice(0, -1)) {
    const stageIndex = stages.indexOf(stage)
    const exported = dropoutRecordsForStage(stage, stageIndex)
    assert.equal(exported.length, stage.dropped_to_next?.length ?? 0,
      `dropoutRecordsForStage(${stage.key}, ${stageIndex}) length ` +
      `should match stage.dropped_to_next length`)
    for (let i = 0; i < exported.length; i += 1) {
      assert.equal(exported[i].customer.id, stage.dropped_to_next[i].customer.id,
        `dropoutRecordsForStage(${stage.key}, ${stageIndex})[${i}] ` +
        `customer.id should match stage.dropped_to_next[${i}].customer.id`)
    }
  }

  // The combined set of all dropout records from all adjacent-stage lists should
  // be the same set as if you called dropoutRecordsForAllStages(stages).
  const allExported = dropoutRecordsForAllStages(stages)
  const expectedIds = new Set(
    stages
      .slice(0, -1)
      .flatMap((s) => s.dropped_to_next ?? [])
      .map((r) => r.customer.id),
  )
  const actualIds = new Set(
    allExported.flatMap((records) => records.map((r) => r.customer.id)),
  )
  assert.equal(actualIds.size, expectedIds.size,
    'dropoutRecordsForAllStages should produce the same set of customers as ' +
    'the union of all dropoutLists')
  for (const id of actualIds) {
    assert.ok(expectedIds.has(id),
      `unexpected customer id ${id} in dropoutRecordsForAllStages output`)
  }
})

test('dropout exports never include customers still in the funnel', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)

  // Every dropout at every stage should not be in the final stage.
  for (const stage of stages.slice(0, stages.length - 1)) {
    if (!stage.dropped_to_next) continue
    for (const r of stage.dropped_to_next) {
      assert.ok(!FUNNEL_STAGES[FUNNEL_STAGES.length - 1].qualifier(r),
        `${r.customer.name} should not be in the final stage`)
    }
  }
})

test('dropout exports never include customers still in the funnel', () => {
  const { stages } = buildFunnel(CUSTOMERS, SALES)

  // Every dropout at every stage should not be in the final stage.
  for (const stage of stages.slice(0, stages.length - 1)) {
    if (!stage.dropped_to_next) continue
    for (const r of stage.dropped_to_next) {
      assert.ok(!FUNNEL_STAGES[FUNNEL_STAGES.length - 1].qualifier(r),
        `${r.customer.name} should not be in the final stage`)
    }
  }
})


test('stages are monotonically non-increasing, so no conversion exceeds 100%', () => {
  const datasets = [
    { label: 'empty customers', customers: [], sales: [] },
    { label: 'customers without orders', customers: CUSTOMERS, sales: [] },
    { label: 'orders for strangers', customers: [], sales: SALES },
    { label: 'hand-built', customers: CUSTOMERS, sales: SALES },
    { label: 'single big spender', customers: [{ id: 1 }, { id: 2 }],
      sales: [{ customer_id: 1, total_amount: 1000000 }, { customer_id: 2, total_amount: 10 }] },
    { label: 'identical twins', customers: [{ id: 1 }, { id: 2 }, { id: 3 }],
      sales: [{ customer_id: 1, total_amount: 2000 }, { customer_id: 2, total_amount: 2000 }, { customer_id: 3, total_amount: 2000 }] },
  ]

  for (let i = 0; i < GENERATED_DATASETS; i += 1) {
    const seed = RUN_SEED + i
    datasets.push({ label: `generated ${i} (seed ${seed})`, seed, ...datasetFromSeed(seed) })
  }

  const reachedBottom = []
  const withOrdersForStrangers = []
  const withUnusableAmounts = []
  for (const dataset of datasets) {
    const { stages, breach } = examine(buildFunnel, dataset, dataset.label)
    if (breach) reportBreach(buildFunnel, dataset, dataset.label)

    if (stages[0].count > 0 && stages[stages.length - 1].count > 0) reachedBottom.push(dataset.label)

    const ids = new Set(dataset.customers.map((customer) => customer.id))
    if (dataset.sales.some((sale) => !ids.has(sale.customer_id))) withOrdersForStrangers.push(dataset.label)
    if (dataset.sales.some((sale) => !Number.isFinite(Number(sale.total_amount)))) {
      withUnusableAmounts.push(dataset.label)
    }
  }

  const tenth = Math.ceil(datasets.length / 10)
  assert.ok(reachedBottom.length >= tenth, `only ${reachedBottom.length} of ${datasets.length} reached the bottom`)
  assert.ok(withOrdersForStrangers.length >= tenth, `only ${withOrdersForStrangers.length} had orders for strangers`)
  assert.ok(withUnusableAmounts.length >= tenth, `only ${withUnusableAmounts.length} had unusable amounts`)
})

/**
 * The bug this file exists to prevent, put back on purpose: the spend stages
 * re-filter the *whole* customer list with their own independent threshold, and
 * "Engaged" counts the 5+ orders its label never claimed. A customer with ₹2,000
 * of spend but fewer than five orders then makes Brand Promoters outgrow Engaged
 * — exactly the inversion that was on screen.
 *
 * It exists because the shipped chain cannot break: a shrinker tested only
 * against it would be tested against nothing.
 */
const NON_NESTED_STAGES = [
  { key: 'visitors', label: 'Total Customers', qualifier: () => true },
  { key: 'first_purchase', label: 'First Purchase (1+ orders)', qualifier: (s) => s.orders >= 1 },
  { key: 'repeat', label: 'Repeat Buyers (2+ orders)', qualifier: (s) => s.orders >= 2 },
  { key: 'engaged', label: 'Engaged Customers (3+ orders)', qualifier: (s) => s.orders >= 5 },
  { key: 'promoter', label: 'Brand Promoters (₹2,000+)', qualifier: (s) => s.spend >= 2000 },
  { key: 'high_value', label: 'High Value (₹5,000+)', qualifier: (s) => s.spend >= 5000 },
  { key: 'vip', label: 'VIP (₹10,000+)', qualifier: (s) => s.spend >= 10000 },
]

/** `buildFunnel`'s arithmetic over the non-nested definitions above. */
function nonNestedBuildFunnel(customers, sales) {
  const population = customerStats(customers, sales)
  const total = population.length
  const stages = []

  for (const definition of NON_NESTED_STAGES) {
    const count = population.filter(definition.qualifier).length
    const previous = stages.length > 0 ? stages[stages.length - 1].count : count
    stages.push({
      key: definition.key,
      label: definition.label,
      count,
      dropoff: stages.length > 0 ? previous - count : 0,
      dropoffPct: stages.length > 0 && previous > 0
        ? Number((((previous - count) / previous) * 100).toFixed(1))
        : 0,
      pctOfTotal: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      pctOfPrevious: stages.length > 0
        ? (previous > 0 ? Number(((count / previous) * 100).toFixed(1)) : 0)
        : (total > 0 ? 100 : 0),
    })
  }

  return { stages, total }
}

/** A business with plenty to remove: repeat business for everyone, one huge
 *  single order, orders for customers who are not in the list at all, and an
 *  amount that cannot be spent. */
const BLOATED_FAILURE = {
  customers: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
  sales: [
    ...Array.from({ length: 3 }, () => ({ customer_id: 1, total_amount: 1000 })),
    { customer_id: 2, total_amount: 60000 },
    { customer_id: 3, total_amount: 4000 },
    { customer_id: 4, total_amount: 'abc' },
    { customer_id: 5, total_amount: 2000 },
    { customer_id: 77, total_amount: 90000 },
    { customer_id: null, total_amount: 500 },
  ],
}

/**
 * "Smallest case" means 1-minimal, and it is checked here from the definition
 * rather than by asking the minimiser: every way of making the case smaller has
 * to make the breach disappear.
 */
function assertNothingSmallerBreaks(build, dataset, label) {
  const stillBreaks = (candidate, what) => assert.ok(
    !breaksInvariant(build, candidate, label),
    `${label}: ${what} still breaks the invariant, so ${JSON.stringify(dataset)} was not minimal`,
  )

  dataset.customers.forEach((customer, i) => stillBreaks({
    customers: dataset.customers.filter((_, j) => j !== i),
    sales: dataset.sales.filter((sale) => sale.customer_id !== customer.id),
  }, `dropping customer ${JSON.stringify(customer)}`))

  dataset.sales.forEach((sale, i) => stillBreaks({
    ...dataset,
    sales: dataset.sales.filter((_, j) => j !== i),
  }, `dropping order ${JSON.stringify(sale)}`))

  dataset.sales.forEach((sale, i) => {
    const current = Number(sale.total_amount)
    SIMPLER_AMOUNTS
      .filter((amount) => !(Number(amount) >= current))
      .forEach((amount) => stillBreaks({
        ...dataset,
        sales: dataset.sales.map((other, j) => (j === i ? { ...other, total_amount: amount } : other)),
      }, `lowering order ${JSON.stringify(sale)} to ${JSON.stringify(amount)}`))
  })

  // The numberings are canonical too, so the same failure always prints the same
  // case rather than depending on which ids the generator happened to pick.
  assert.deepEqual(dataset.customers.map((customer) => customer.id),
    dataset.customers.map((_, i) => i + 1), `${label}: customers are not numbered from 1`)
}

test('a failing funnel is minimised to the smallest case that still breaks it', () => {
  assert.ok(breaksInvariant(nonNestedBuildFunnel, BLOATED_FAILURE, 'bloated'),
    'the fixture has to break the non-increasing invariant, or the minimiser is being tested on nothing')

  const minimal = minimiseBreach(nonNestedBuildFunnel, BLOATED_FAILURE, 'bloated')

  // One customer with one ₹2,000 order: the least a breach can need. ₹2,000 is
  // the first spend threshold, so a penny less cannot promote anyone, and the
  // orders nothing counts have to be gone.
  assert.deepEqual(minimal.dataset, {
    customers: [{ id: 1 }],
    sales: [{ customer_id: 1, total_amount: 2000 }],
  })
  // ...and the breach it reports is the non-increasing one, not some other
  // failure the smaller case happened to fall into.
  assert.match(minimal.breach, /is larger than/)
  assert.match(minimal.breach, /promoter|high_value|vip/)
  assertNothingSmallerBreaks(nonNestedBuildFunnel, minimal.dataset, 'bloated')

  // The boundary itself, both sides: the threshold promotes, a penny less does
  // not — which is what makes 2,000 the smallest amount that reproduces this.
  const below = { customers: [{ id: 1 }], sales: [{ customer_id: 1, total_amount: 1999.99 }] }
  assert.ok(!breaksInvariant(nonNestedBuildFunnel, below, 'one penny short'))
  assert.ok(breaksInvariant(nonNestedBuildFunnel, minimal.dataset, 'at the threshold'))
})

test('a dataset drawn from the generator is minimised the same way', () => {
  // Take the first generated business that breaks the deliberately broken chain:
  // the minimiser has to work from a random starting point, not just a fixture
  // written to suit it.
  let seed = null
  for (let i = 0; i < GENERATED_DATASETS && seed === null; i += 1) {
    const candidate = RUN_SEED + i
    if (breaksInvariant(nonNestedBuildFunnel, datasetFromSeed(candidate), `seed ${candidate}`)) {
      seed = candidate
    }
  }
  assert.notEqual(seed, null,
    'no generated dataset broke the non-nested chain, so the generator is not reaching the spend stages')

  const failing = { seed, ...datasetFromSeed(seed) }
  const minimal = minimiseBreach(nonNestedBuildFunnel, failing, `seed ${seed}`)

  assert.deepEqual(minimal.dataset.customers, [{ id: 1 }], 'one customer is enough to break this chain')
  assert.ok(minimal.dataset.sales.length >= 1, 'a breach needs at least one counted order')
  assert.ok(minimal.dataset.sales.length < failing.sales.length,
    'the generated case has to shrink, or the minimiser is not searching')
  // No single order can be dropped and no amount lowered, so the spend left is
  // the smallest that still promotes someone: above the ₹2,000 threshold and
  // below the ₹5,000 one it would otherwise shrink past.
  const spend = minimal.dataset.sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
  assert.ok(spend >= 2000 && spend < 5000, `minimal spend is ${spend}, expected ₹2,000-₹4,999`)
  assert.match(minimal.breach, /is larger than/)
  assertNothingSmallerBreaks(nonNestedBuildFunnel, minimal.dataset, `seed ${seed}`)
})

test('minimising refuses a dataset that breaks nothing', () => {
  // A minimiser that returns a case for a healthy input would "minimise" a
  // passing run into a reported failure that reproduces nothing.
  assert.throws(() => minimiseBreach(nonNestedBuildFunnel, { customers: [{ id: 1 }], sales: [] }, 'clean'),
    /breaks no invariant/)
})

test('minimising the same failure twice reports the same case', () => {
  const first = minimiseBreach(nonNestedBuildFunnel, BLOATED_FAILURE, 'bloated')
  const second = minimiseBreach(nonNestedBuildFunnel, BLOATED_FAILURE, 'bloated')

  assert.deepEqual(first.dataset, second.dataset)
  assert.equal(first.breach, second.breach)
})
