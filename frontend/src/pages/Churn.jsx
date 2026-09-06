// import { useEffect, useMemo, useState } from 'react'
// import api from '../services/api'
// import { Loading, PageHeader, StatCard, EmptyState, Badge } from '../components/ui.jsx'
// import { UserMinus, Users, AlertTriangle, CheckCircle, Search } from 'lucide-react'

// const RISK_TONE = {
//   High: 'red',
//   Medium: 'amber',
//   Low: 'green',
// }

// export default function Churn() {
//   const [data, setData] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState('')
//   const [riskFilter, setRiskFilter] = useState('All')
//   const [search, setSearch] = useState('')

//   useEffect(() => {
//     api
//       .get('/ai/churn')
//       .then((res) => {
//         setData(res.data)
//       })
//       .catch((err) => {
//         console.error('Churn API error:', err)
//         setError('Unable to load churn predictions.')
//       })
//       .finally(() => setLoading(false))
//   }, [])

//   const rows = data?.rows || []

//   const stats = useMemo(() => {
//     return {
//       total: rows.length,
//       high: rows.filter((r) => r.churn_risk === 'High').length,
//       medium: rows.filter((r) => r.churn_risk === 'Medium').length,
//       low: rows.filter((r) => r.churn_risk === 'Low').length,
//     }
//   }, [rows])

//   const filteredRows = rows.filter((r) => {
//     const risk = r.churn_risk || ''

//     const matchesRisk =
//       riskFilter === 'All' || risk === riskFilter

//     const matchesSearch =
//       (r.customer_name || '')
//         .toLowerCase()
//         .includes(search.toLowerCase())

//     return matchesRisk && matchesSearch
//   })

//   if (loading) {
//     return <Loading label="Running churn prediction model..." />
//   }

//   if (error) {
//     return (
//       <div>
//         <PageHeader
//           title="Churn Prediction"
//           subtitle="Customer retention risk analysis."
//         />

//         <div className="card text-center py-10">
//           <AlertTriangle
//             size={32}
//             className="mx-auto mb-3 text-red-500"
//           />
//           <p className="text-sm text-red-500">{error}</p>
//         </div>
//       </div>
//     )
//   }

//   if (!data || rows.length === 0) {
//     return (
//       <div>
//         <PageHeader
//           title="Churn Prediction"
//           subtitle="Customer retention risk analysis."
//         />

//         <EmptyState message="Not enough customer history to predict churn yet." />
//       </div>
//     )
//   }

//   return (
//     <div>
//       <PageHeader
//         title="Churn Prediction"
//         subtitle="AI-powered customer retention risk analysis based on purchasing behaviour and inactivity."
//       />

//       {/* Summary Cards */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

//         <StatCard
//           label="Customers Analyzed"
//           value={data.customers_analyzed ?? stats.total}
//           icon={Users}
//         />

//         <StatCard
//           label="High-Risk Customers"
//           value={stats.high}
//           icon={UserMinus}
//           tone="red"
//         />

//         <StatCard
//           label="Medium-Risk Customers"
//           value={stats.medium}
//           icon={AlertTriangle}
//           tone="amber"
//         />

//         <StatCard
//           label="Low-Risk Customers"
//           value={stats.low}
//           icon={CheckCircle}
//           tone="green"
//         />

//       </div>

//       {/* Customer Risk Table */}
//       <div className="card">

//         <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-5">

//           <div>
//             <h3 className="font-semibold text-slate-800 dark:text-slate-100">
//               Customer Churn Risk
//             </h3>

//             <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
//               {filteredRows.length} customers shown
//             </p>
//           </div>

//           <div className="flex flex-wrap items-center gap-2">

//             {/* Search */}
//             <div className="relative w-full sm:w-52">
//               <Search
//                 size={14}
//                 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
//               />

//               <input
//                 type="text"
//                 placeholder="Search customer..."
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 className="input text-xs pl-8 py-2 w-full"
//               />
//             </div>

//             {/* Risk Filter */}
//             <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">

//               {['All', 'High', 'Medium', 'Low'].map((level) => (
//                 <button
//                   key={level}
//                   onClick={() => setRiskFilter(level)}
//                   className={`px-3 py-1.5 rounded-md transition-all ${
//                     riskFilter === level
//                       ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold'
//                       : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
//                   }`}
//                 >
//                   {level}
//                 </button>
//               ))}

//             </div>

//           </div>
//         </div>

//         {/* Table */}
//         <div className="overflow-x-auto">

//           <table className="w-full text-sm">

//             <thead>
//               <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">

//                 <th className="py-3 pr-4">
//                   Customer
//                 </th>

//                 <th className="py-3 pr-4">
//                   Risk
//                 </th>

//                 <th className="py-3 pr-4">
//                   Probability
//                 </th>

//                 <th className="py-3 pr-4">
//                   Recent Orders
//                 </th>

//                 <th className="py-3 pr-4">
//                   Total Orders
//                 </th>

//                 <th className="py-3 pr-4">
//                   AI Recommendation
//                 </th>

//               </tr>
//             </thead>

//             <tbody>

//               {filteredRows.map((r) => (

//                 <tr
//                   key={r.customer_id}
//                   className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
//                 >

//                   <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">
//                     {r.customer_name}
//                   </td>

//                   <td className="py-3 pr-4">
//                     <Badge tone={RISK_TONE[r.churn_risk] || 'gray'}>
//                       {r.churn_risk}
//                     </Badge>
//                   </td>

//                   <td className="py-3 pr-4 font-medium">
//                     {(Number(r.churn_probability || 0) * 100).toFixed(1)}%
//                   </td>

//                   <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
//                     {r.recent_orders ?? 0}
//                   </td>

//                   <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
//                     {r.total_orders ?? 0}
//                   </td>

//                   <td className="py-3 pr-4 text-slate-500 dark:text-slate-400 max-w-sm">
//                     <div>
//                       <p className="font-medium text-slate-700 dark:text-slate-200">
//                         {r.recommended_action}
//                       </p>

//                       <p className="text-xs mt-1">
//                         {r.reason}
//                       </p>
//                     </div>
//                   </td>

//                 </tr>

//               ))}

//             </tbody>

//           </table>

//           {filteredRows.length === 0 && (
//             <div className="text-center py-10 text-sm text-slate-400">
//               No customers match your search/filter.
//             </div>
//           )}

//         </div>

//       </div>
//     </div>
//   )
// }


import { useEffect, useState } from 'react'
import api from '../services/api'
import {
  Loading,
  PageHeader,
  StatCard,
  EmptyState,
  Badge,
} from '../components/ui.jsx'
import {
  UserMinus,
  Percent,
  Search,
  ShoppingCart,
  Clock,
  TrendingDown,
} from 'lucide-react'

const RISK_TONE = {
  High: 'red',
  Medium: 'amber',
  Low: 'green',
}

export default function Churn() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [riskFilter, setRiskFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .get('/ai/churn')
      .then((res) => setData(res.data))
      .catch(() => setData({ rows: [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loading label="Running churn prediction model..." />
  }

  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div>
        <PageHeader
          title="Churn Prediction"
          subtitle="Identify customers who may be at risk of becoming inactive."
        />
        <EmptyState message="Not enough customer history to predict churn yet." />
      </div>
    )
  }

  const rows = data.rows

  const highRisk = rows.filter(
    (r) => (r.risk_category || r.churn_risk) === 'High'
  ).length

  const mediumRisk = rows.filter(
    (r) => (r.risk_category || r.churn_risk) === 'Medium'
  ).length

  const lowRisk = rows.filter(
    (r) => (r.risk_category || r.churn_risk) === 'Low'
  ).length

  const filteredRows = rows.filter((r) => {
    const risk = r.risk_category || r.churn_risk

    const matchesRisk =
      riskFilter === 'All' || risk === riskFilter

    const matchesSearch =
      (r.customer_name || '')
        .toLowerCase()
        .includes(search.toLowerCase())

    return matchesRisk && matchesSearch
  })

  return (
    <div>
      <PageHeader
        title="Churn Prediction"
        subtitle="AI-powered customer retention risk analysis based on purchasing behaviour."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <StatCard
          label="High-Risk Customers"
          value={highRisk}
          icon={UserMinus}
          tone="red"
        />

        <StatCard
          label="Medium Risk"
          value={mediumRisk}
          icon={TrendingDown}
          tone="amber"
        />

        <StatCard
          label="Low Risk"
          value={lowRisk}
          icon={ShoppingCart}
          tone="green"
        />

        <StatCard
          label="Customers Analyzed"
          value={data.customers_analyzed ?? rows.length}
          icon={Percent}
        />

      </div>

      {/* Customer Risk Table */}
      <div className="card">

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">

          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              Customer Churn Risk
            </h3>

            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Customers ranked by predicted churn probability
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />

              <input
                type="text"
                placeholder="Search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input text-xs pl-8 py-1.5"
              />
            </div>

            {/* Risk Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">

              {['All', 'High', 'Medium', 'Low'].map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskFilter(level)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    riskFilter === level
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {level}
                </button>
              ))}

            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">

                <th className="py-2 pr-4">
                  Customer
                </th>

                <th className="py-2 pr-4">
                  Risk
                </th>

                <th className="py-2 pr-4">
                  Probability
                </th>

                <th className="py-2 pr-4">
                  Recency
                </th>

                <th className="py-2 pr-4">
                  Orders
                </th>

                <th className="py-2 pr-4">
                  Frequency Change
                </th>

                <th className="py-2 pr-4">
                  AI Recommendation
                </th>

              </tr>
            </thead>

            <tbody>

              {filteredRows.map((r) => {

                const risk = r.risk_category || r.churn_risk

                return (
                  <tr
                    key={r.customer_id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800"
                  >

                    {/* Customer */}
                    <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">
                      {r.customer_name}
                    </td>

                    {/* Risk */}
                    <td className="py-3 pr-4">
                      <Badge tone={RISK_TONE[risk]}>
                        {risk}
                      </Badge>
                    </td>

                    {/* Probability */}
                    <td className="py-3 pr-4">
                      <span className="font-medium">
                        {(r.churn_probability * 100).toFixed(0)}%
                      </span>
                    </td>

                    {/* Recency */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Clock size={14} />
                        {r.recency_days} days
                      </div>
                    </td>

                    {/* Orders */}
                    <td className="py-3 pr-4">
                      {r.total_orders}
                    </td>

                    {/* Frequency change */}
                    <td className="py-3 pr-4">
                      <span
                        className={
                          r.frequency_change < 0
                            ? 'text-red-500 font-medium'
                            : r.frequency_change > 0
                              ? 'text-green-500 font-medium'
                              : 'text-slate-400'
                        }
                      >
                        {r.frequency_change > 0 ? '+' : ''}
                        {r.frequency_change}
                      </span>
                    </td>

                    {/* Recommendation */}
                    <td className="py-3 pr-4 text-slate-500 max-w-md dark:text-slate-400">
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {r.recommendation || r.recommended_action}
                      </div>

                      {r.reason && (
                        <div className="text-xs mt-1 text-slate-400 dark:text-slate-500">
                          {r.reason}
                        </div>
                      )}
                    </td>

                  </tr>
                )
              })}

            </tbody>

          </table>

          {filteredRows.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">
              No customers match your search or risk filter.
            </div>
          )}

        </div>
      </div>
    </div>
  )
}