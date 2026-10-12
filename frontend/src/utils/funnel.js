/**
 * The Funnel Analysis stage chain.
 *
 * A funnel only means something if each stage is a genuine subset of the stage
 * above it. When it is not, the page shows a conversion above 100% and a
 * negative drop-off — not a data anomaly to clamp, but a broken definition.
 *
 * So this chain is defined twice over:
 *
 *   1. every stage's condition *implies* the one above it (ordered by
 *      implication, not by which threshold reads as "bigger"), and
 *   2. `buildFunnel` filters the survivors of the previous stage rather than
 *      re-filtering the whole customer list, so nesting holds by construction
 *      and cannot drift when someone later edits a threshold.
 *
 * Both live bugs this replaces were label/logic mismatches of that kind:
 *
 *   * "Engaged Customers (3+ orders)" was counted with `orders >= 5`, so the
 *     number shown in the funnel was a different population from the one its
 *     label named (the monthly trend chart on the same page already used 3+).
 *   * "High Value (₹5000+)" and "VIP (₹10000+)" were independent spend
 *     thresholds: a customer with a single large order and no repeat business
 *     counted as High Value, so a stage could outgrow the one above it.
 *
 * The spend stages now carry the repeat-purchase requirement their position in
 * the funnel implies (3+ orders, i.e. the Engaged population), which is what
 * makes them subsets and what "high value customer" should have meant all along.
 */

/**
 * Stage definitions, in funnel order.
 *
 * `qualifier` receives one entry from `customerStats()` and answers "is this
 * customer still in the funnel at this stage?". Each is strictly narrower than
 * the one before it — see the tests in ./funnel.test.js, which pin that.
 */
export const FUNNEL_STAGES = [
  {
    key: 'visitors',
    label: 'Total Customers',
    // The base population is the customer list, not site traffic: this app
    // tracks no visitors, so calling them visitors was its own contradiction.
    qualifier: () => true,
  },
  {
    key: 'first_purchase',
    label: 'First Purchase (1+ orders)',
    qualifier: (s) => s.orders >= 1,
  },
  {
    key: 'repeat',
    label: 'Repeat Buyers (2+ orders)',
    qualifier: (s) => s.orders >= 2,
  },
  {
    key: 'engaged',
    label: 'Engaged Customers (3+ orders)',
    qualifier: (s) => s.orders >= 3,
  },
  {
    key: 'promoter',
    label: 'Brand Promoters (3+ orders, ₹2,000+)',
    qualifier: (s) => s.orders >= 3 && s.spend >= 2000,
  },
  {
    key: 'high_value',
    label: 'High Value (3+ orders, ₹5,000+)',
    qualifier: (s) => s.orders >= 3 && s.spend >= 5000,
  },
  {
    key: 'vip',
    label: 'VIP (3+ orders, ₹10,000+)',
    qualifier: (s) => s.orders >= 3 && s.spend >= 10000,
  },
]

/**
 * One pass over the sales, one entry per customer: { customer, orders, spend }.
 *
 * Every customer in the list gets an entry (even with no orders) because the
 * funnel's population is the customer list, and one pass replaces the previous
 * `sales.filter(...)` *per stage per customer* — which on a real tenant
 * (thousands of sales, hundreds of customers) was millions of comparisons per
 * render for the same answer.
 */
export function customerStats(customers, sales) {
  const byCustomer = new Map()
  for (const sale of sales || []) {
    const id = sale && sale.customer_id
    if (id == null) continue
    const rec = byCustomer.get(id) || { orders: 0, spend: 0 }
    rec.orders += 1
    // Amounts arrive as numbers from the API, but a CSV import can leave them
    // as strings; Number("") and Number(null) are both 0, and NaN is folded to 0
    // so a malformed row cannot poison a stage total into NaN.
    const amount = Number(sale.total_amount)
    rec.spend += Number.isFinite(amount) ? amount : 0
    byCustomer.set(id, rec)
  }

  return (customers || []).map((customer) => {
    const rec = byCustomer.get(customer.id)
    return {
      customer,
      orders: rec ? rec.orders : 0,
      spend: rec ? rec.spend : 0,
    }
  })
}

const pct = (part, whole) => (whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0)

/**
 * Build the funnel for a customer list and a set of sales.
 *
 * Returns `{ stages, total }`, where each stage carries its count plus the two
 * rates the page shows — `pctOfTotal` (share of the top of the funnel) and
 * `pctOfPrevious` (stage-to-stage conversion) — so the arithmetic lives in one
 * place instead of being repeated in the components.
 *
 * Guarantees, by construction rather than by inspection:
 *   count is non-increasing down the chain,
 *   dropoff = previous - count >= 0,
 *   pctOfPrevious <= 100 and pctOfTotal <= 100,
 *   and no rate is NaN when the funnel is empty.
 */
export function buildFunnel(customers, sales) {
  let population = customerStats(customers, sales)
  const total = population.length
  const stages = []

  for (const definition of FUNNEL_STAGES) {
    // Filter the survivors, never the original list: this is what makes each
    // stage a subset of the one above it.
    population = population.filter(definition.qualifier)
    const count = population.length
    const previous = stages.length > 0 ? stages[stages.length - 1].count : count

    stages.push({
      key: definition.key,
      label: definition.label,
      count,
      dropoff: stages.length > 0 ? previous - count : 0,
      dropoffPct: stages.length > 0 ? pct(previous - count, previous) : 0,
      pctOfTotal: pct(count, total),
      // The first stage converts 100% of itself; with an empty funnel there is
      // no rate to report, and 0 is honest where 100 would flatter it.
      pctOfPrevious: stages.length > 0 ? pct(count, previous) : total > 0 ? 100 : 0,
    })
  }

  return { stages, total }
}
