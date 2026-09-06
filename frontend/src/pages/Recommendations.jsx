// // import { useEffect, useState } from 'react'
// // import { Sparkles, User, ShoppingBag, Brain, RefreshCw } from 'lucide-react'
// // import api from '../services/api'

// // export default function Recommendations() {
// //   const [rows, setRows] = useState([])
// //   const [loading, setLoading] = useState(true)
// //   const [error, setError] = useState('')

// //   const fetchRecommendations = async () => {
// //     try {
// //       setLoading(true)
// //       setError('')

// //       const response = await api.get('/ai/recommendations')

// //       setRows(response.data?.rows || [])
// //     } catch (err) {
// //       console.error('Recommendation API error:', err)
// //       setError(
// //         // err.response?.data?.error ||
// //         // 'Unable to load product recommendations.'
// //         err.response?.data?.detail ||
// //       err.response?.data?.error ||
// //       'Unable to load product recommendations.'
// //       )
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   useEffect(() => {
// //     fetchRecommendations()
// //   }, [])

// //   return (
// //     <div className="space-y-6">

// //       {/* Header */}
// //       <div className="flex items-center justify-between">
// //         <div>
// //           <div className="flex items-center gap-3">
// //             <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-indigo-950/50 flex items-center justify-center">
// //               <Sparkles
// //                 size={22}
// //                 className="text-brand-600 dark:text-indigo-400"
// //               />
// //             </div>

// //             <div>
// //               <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
// //                 Product Recommendations
// //               </h1>

// //               <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
// //                 AI-powered product suggestions based on customer purchasing behaviour
// //               </p>
// //             </div>
// //           </div>
// //         </div>

// //         <button
// //           onClick={fetchRecommendations}
// //           disabled={loading}
// //           className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
// //         >
// //           <RefreshCw
// //             size={16}
// //             className={loading ? 'animate-spin' : ''}
// //           />
// //           Refresh
// //         </button>
// //       </div>

// //       {/* Summary Card */}
// //       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
// //         <div className="flex items-center gap-4">

// //           <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-indigo-950/50 flex items-center justify-center">
// //             <Brain
// //               size={24}
// //               className="text-brand-600 dark:text-indigo-400"
// //             />
// //           </div>

// //           <div>
// //             <p className="text-sm text-slate-500 dark:text-slate-400">
// //               Customers analyzed
// //             </p>

// //             <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
// //               {rows.length}
// //             </p>
// //           </div>

// //         </div>
// //       </div>

// //       {/* Loading */}
// //       {loading && (
// //         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
// //           <RefreshCw
// //             size={28}
// //             className="animate-spin mx-auto text-brand-600"
// //           />

// //           <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
// //             Generating recommendations...
// //           </p>
// //         </div>
// //       )}

// //       {/* Error */}
// //       {!loading && error && (
// //         <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-5">
// //           <p className="font-semibold text-red-700 dark:text-red-400">
// //             Recommendation service unavailable
// //           </p>

// //           <p className="text-sm text-red-600 dark:text-red-400 mt-1">
// //             {error}
// //           </p>
// //         </div>
// //       )}

// //       {/* Empty */}
// //       {!loading && !error && rows.length === 0 && (
// //         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
// //           <ShoppingBag
// //             size={32}
// //             className="mx-auto text-slate-400"
// //           />

// //           <p className="mt-3 font-medium text-slate-700 dark:text-slate-300">
// //             No recommendations available
// //           </p>

// //           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
// //             There is not enough purchase history to generate recommendations.
// //           </p>
// //         </div>
// //       )}

// //       {/* Recommendation Cards */}
// //       {!loading && !error && rows.length > 0 && (
// //         <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

// //           {rows.map((customer) => (
// //             <div
// //               key={customer.customer_id}
// //               className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
// //             >

// //               {/* Customer Header */}
// //               <div className="p-5 border-b border-slate-100 dark:border-slate-800">

// //                 <div className="flex items-center justify-between">

// //                   <div className="flex items-center gap-3">

// //                     <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-slate-800 flex items-center justify-center">
// //                       <User
// //                         size={18}
// //                         className="text-brand-700 dark:text-indigo-400"
// //                       />
// //                     </div>

// //                     <div>
// //                       <h2 className="font-semibold text-slate-800 dark:text-slate-100">
// //                         {customer.customer_name}
// //                       </h2>

// //                       <p className="text-xs text-slate-400 dark:text-slate-500">
// //                         Customer #{customer.customer_id}
// //                       </p>
// //                     </div>

// //                   </div>

// //                   <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-indigo-950/50 text-brand-700 dark:text-indigo-400 text-xs font-medium">
// //                     <Sparkles size={12} />
// //                     AI
// //                   </span>

// //                 </div>

// //               </div>

// //               {/* Products */}
// //               <div className="p-5">

// //                 <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">
// //                   Recommended Products
// //                 </p>

// //                 <div className="space-y-3">

// //                   {(customer.recommended_products || []).map(
// //                     (product, index) => (
// //                       <div
// //                         key={index}
// //                         className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"
// //                       >

// //                         <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
// //                           <ShoppingBag
// //                             size={17}
// //                             className="text-brand-600 dark:text-indigo-400"
// //                           />
// //                         </div>

// //                         <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
// //                           {product}
// //                         </p>

// //                       </div>
// //                     )
// //                   )}

// //                 </div>

// //                 {/* Reason */}
// //                 <div className="mt-5 p-4 rounded-lg bg-brand-50 dark:bg-indigo-950/30 border border-brand-100 dark:border-indigo-900/50">

// //                   <div className="flex items-center gap-2 mb-2">
// //                     <Brain
// //                       size={15}
// //                       className="text-brand-600 dark:text-indigo-400"
// //                     />

// //                     <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-indigo-400">
// //                       Why these products?
// //                     </p>
// //                   </div>

// //                   <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
// //                     {customer.reason}
// //                   </p>

// //                 </div>

// //               </div>

// //             </div>
// //           ))}

// //         </div>
// //       )}

// //     </div>
// //   )
// // }

// import { useEffect, useMemo, useState } from 'react'
// import {
//   Sparkles,
//   User,
//   ShoppingBag,
//   Brain,
//   RefreshCw,
//   Search,
//   Package,
//   TrendingUp,
//   Clock3,
//   ChevronDown,
//   ChevronUp,
//   Target,
//   WandSparkles,
// } from 'lucide-react'
// import api from '../services/api'

// const TYPE_CONFIG = {
//   cross_sell: {
//     label: 'Cross-sell',
//     className:
//       'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
//   },
//   personalized: {
//     label: 'Personalized',
//     className:
//       'bg-brand-50 text-brand-700 border-brand-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50',
//   },
//   popular: {
//     label: 'Popular',
//     className:
//       'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
//   },
// }

// function formatCurrency(value) {
//   if (value == null || Number.isNaN(Number(value))) return '—'

//   return new Intl.NumberFormat('en-IN', {
//     style: 'currency',
//     currency: 'INR',
//     maximumFractionDigits: 2,
//   }).format(Number(value))
// }

// function formatPercent(value) {
//   if (value == null || Number.isNaN(Number(value))) return '—'
//   return `${(Number(value) * 100).toFixed(0)}%`
// }

// function getTypeConfig(type) {
//   return (
//     TYPE_CONFIG[type] || {
//       label: type ? type.replaceAll('_', ' ') : 'Recommendation',
//       className:
//         'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
//     }
//   )
// }

// function SignalBar({ label, value }) {
//   const percentage = Math.max(
//     0,
//     Math.min(100, Number(value || 0) * 100)
//   )

//   return (
//     <div>
//       <div className="flex items-center justify-between mb-1">
//         <span className="text-xs text-slate-500 dark:text-slate-400">
//           {label}
//         </span>

//         <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
//           {percentage.toFixed(0)}%
//         </span>
//       </div>

//       <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
//         <div
//           className="h-full rounded-full bg-brand-500 dark:bg-indigo-500 transition-all"
//           style={{ width: `${percentage}%` }}
//         />
//       </div>
//     </div>
//   )
// }

// function RecommendationCard({ recommendation }) {
//   const [showSignals, setShowSignals] = useState(false)

//   const typeConfig = getTypeConfig(recommendation.recommendation_type)

//   const score = Number(recommendation.score || 0)
//   const scorePercent = Math.max(0, Math.min(100, score * 100))

//   const signals = recommendation.signals || {}

//   const hasPersonalizedSignal =
//     Number(signals.collaborative_score || 0) > 0 ||
//     Number(signals.association_score || 0) > 0

//   return (
//     <div className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-brand-200 dark:hover:border-indigo-900">
//       {/* Product top section */}
//       <div className="p-5">
//         <div className="flex items-start gap-4">
//           <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-indigo-950/50 border border-brand-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0">
//             <ShoppingBag
//               size={21}
//               className="text-brand-600 dark:text-indigo-400"
//             />
//           </div>

//           <div className="min-w-0 flex-1">
//             <div className="flex items-start justify-between gap-3">
//               <div className="min-w-0">
//                 <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">
//                   {recommendation.product_name}
//                 </h3>

//                 {recommendation.category && (
//                   <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
//                     {recommendation.category}
//                   </p>
//                 )}
//               </div>

//               <div className="text-right shrink-0">
//                 <p className="font-bold text-slate-800 dark:text-slate-100">
//                   {formatCurrency(recommendation.price)}
//                 </p>

//                 <div className="flex items-center justify-end gap-1 mt-1">
//                   <Target size={12} className="text-brand-500" />

//                   <span className="text-xs font-semibold text-brand-600 dark:text-indigo-400">
//                     {scorePercent.toFixed(0)}% match
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="flex flex-wrap items-center gap-2 mt-3">
//               <span
//                 className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold capitalize ${typeConfig.className}`}
//               >
//                 <Sparkles size={11} />
//                 {typeConfig.label}
//               </span>

//               {hasPersonalizedSignal && (
//                 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40 text-[11px] font-semibold">
//                   <Brain size={11} />
//                   Personalized
//                 </span>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Score */}
//         <div className="mt-5">
//           <div className="flex items-center justify-between mb-2">
//             <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
//               Recommendation strength
//             </span>

//             <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
//               {scorePercent.toFixed(0)}%
//             </span>
//           </div>

//           <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
//             <div
//               className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all"
//               style={{ width: `${scorePercent}%` }}
//             />
//           </div>
//         </div>

//         {/* Product metadata */}
//         <div className="grid grid-cols-2 gap-3 mt-4">
//           <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
//             <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
//               <Package size={14} />

//               <span className="text-[11px] uppercase tracking-wide font-semibold">
//                 Stock
//               </span>
//             </div>

//             <p
//               className={`text-sm font-semibold mt-1 ${
//                 Number(recommendation.inventory_available || 0) > 0
//                   ? 'text-emerald-600 dark:text-emerald-400'
//                   : 'text-red-600 dark:text-red-400'
//               }`}
//             >
//               {recommendation.inventory_available ?? 0} available
//             </p>
//           </div>

//           <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
//             <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
//               <WandSparkles size={14} />

//               <span className="text-[11px] uppercase tracking-wide font-semibold">
//                 Product ID
//               </span>
//             </div>

//             <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
//               #{recommendation.product_id}
//             </p>
//           </div>
//         </div>

//         {/* Why */}
//         <div className="mt-4 rounded-xl bg-brand-50/70 dark:bg-indigo-950/30 border border-brand-100 dark:border-indigo-900/50 p-4">
//           <div className="flex items-center gap-2 mb-2">
//             <Brain
//               size={15}
//               className="text-brand-600 dark:text-indigo-400"
//             />

//             <span className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-indigo-300">
//               Why this product?
//             </span>
//           </div>

//           <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
//             {recommendation.reason ||
//               'Recommended based on customer purchasing behaviour.'}
//           </p>
//         </div>

//         {/* Signals toggle */}
//         <button
//           type="button"
//           onClick={() => setShowSignals((value) => !value)}
//           className="w-full mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-indigo-400 transition-colors"
//         >
//           <span>View recommendation signals</span>

//           {showSignals ? (
//             <ChevronUp size={15} />
//           ) : (
//             <ChevronDown size={15} />
//           )}
//         </button>

//         {showSignals && (
//           <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
//             <SignalBar
//               label="Collaborative"
//               value={signals.collaborative_score}
//             />

//             <SignalBar
//               label="Association"
//               value={signals.association_score}
//             />

//             <SignalBar
//               label="Popularity"
//               value={signals.popularity_score}
//             />

//             <SignalBar
//               label="Price fit"
//               value={signals.price_score}
//             />

//             {signals.signal_sources?.length > 0 && (
//               <div className="pt-2">
//                 <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mb-2">
//                   Active signals
//                 </p>

//                 <div className="flex flex-wrap gap-1.5">
//                   {signals.signal_sources.map((source) => (
//                     <span
//                       key={source}
//                       className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 capitalize"
//                     >
//                       {source.replaceAll('_', ' ')}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// function CustomerCard({ customer }) {
//   const recommendations = customer.recommendations || []

//   return (
//     <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
//       {/* Customer header */}
//       <div className="p-5 border-b border-slate-100 dark:border-slate-800">
//         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
//           <div className="flex items-center gap-3">
//             <div className="w-11 h-11 rounded-xl bg-brand-100 dark:bg-indigo-950/50 flex items-center justify-center">
//               <User
//                 size={20}
//                 className="text-brand-700 dark:text-indigo-400"
//               />
//             </div>

//             <div>
//               <h2 className="font-bold text-slate-800 dark:text-slate-100">
//                 {customer.customer_name}
//               </h2>

//               <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
//                 Customer #{customer.customer_id}
//               </p>
//             </div>
//           </div>

//           <div className="flex flex-wrap gap-2">
//             <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
//               <p className="text-[10px] uppercase tracking-wide text-slate-400">
//                 AOV
//               </p>
//               <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
//                 {formatCurrency(customer.average_order_value)}
//               </p>
//             </div>

//             <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
//               <p className="text-[10px] uppercase tracking-wide text-slate-400">
//                 Orders
//               </p>
//               <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
//                 {customer.total_orders ?? 0}
//               </p>
//             </div>

//             <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
//               <p className="text-[10px] uppercase tracking-wide text-slate-400">
//                 Products
//               </p>
//               <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
//                 {customer.purchased_product_count ?? 0}
//               </p>
//             </div>

//             <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
//               <p className="text-[10px] uppercase tracking-wide text-slate-400">
//                 Recency
//               </p>
//               <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
//                 {customer.recency_days != null
//                   ? `${customer.recency_days}d`
//                   : '—'}
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Recommendations */}
//       <div className="p-5">
//         <div className="flex items-center justify-between mb-4">
//           <div>
//             <h3 className="font-semibold text-slate-800 dark:text-slate-100">
//               Recommended for {customer.customer_name}
//             </h3>

//             <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
//               Ranked using customer behaviour and product signals
//             </p>
//           </div>

//           <span className="text-xs font-semibold text-brand-600 dark:text-indigo-400">
//             {recommendations.length} suggestions
//           </span>
//         </div>

//         {recommendations.length > 0 ? (
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//             {recommendations.map((recommendation) => (
//               <RecommendationCard
//                 key={recommendation.product_id}
//                 recommendation={recommendation}
//               />
//             ))}
//           </div>
//         ) : (
//           <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
//             <ShoppingBag
//               size={26}
//               className="mx-auto text-slate-400"
//             />

//             <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
//               No recommendations available
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// export default function Recommendations() {
//   const [rows, setRows] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState('')
//   const [search, setSearch] = useState('')

//   const fetchRecommendations = async () => {
//     try {
//       setLoading(true)
//       setError('')

//       const response = await api.get('/ai/recommendations')

//       setRows(response.data?.rows || [])
//     } catch (err) {
//       console.error('Recommendation API error:', err)

//       setError(
//         err.response?.data?.detail ||
//           err.response?.data?.error ||
//           'Unable to load product recommendations.'
//       )
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchRecommendations()
//   }, [])

//   const filteredRows = useMemo(() => {
//     const query = search.trim().toLowerCase()

//     if (!query) return rows

//     return rows.filter((customer) =>
//       customer.customer_name?.toLowerCase().includes(query)
//     )
//   }, [rows, search])

//   const totalRecommendations = useMemo(
//     () =>
//       rows.reduce(
//         (total, customer) =>
//           total + (customer.recommendations?.length || 0),
//         0
//       ),
//     [rows]
//   )

//   const personalizedRecommendations = useMemo(
//     () =>
//       rows.reduce(
//         (total, customer) =>
//           total +
//           (customer.recommendations || []).filter(
//             (item) =>
//               Number(item.signals?.collaborative_score || 0) > 0 ||
//               Number(item.signals?.association_score || 0) > 0
//           ).length,
//         0
//       ),
//     [rows]
//   )

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
//         <div>
//           <div className="flex items-center gap-3">
//             <div className="w-11 h-11 rounded-xl bg-brand-100 dark:bg-indigo-950/50 flex items-center justify-center">
//               <Sparkles
//                 size={23}
//                 className="text-brand-600 dark:text-indigo-400"
//               />
//             </div>

//             <div>
//               <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
//                 Product Recommendations
//               </h1>

//               <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
//                 AI-powered product suggestions based on customer purchasing
//                 behaviour
//               </p>
//             </div>
//           </div>
//         </div>

//         <button
//           onClick={fetchRecommendations}
//           disabled={loading}
//           className="self-start lg:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
//         >
//           <RefreshCw
//             size={16}
//             className={loading ? 'animate-spin' : ''}
//           />
//           Refresh
//         </button>
//       </div>

//       {/* Summary */}
//       {!loading && !error && rows.length > 0 && (
//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//           <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500">
//                   Customers analyzed
//                 </p>

//                 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
//                   {rows.length}
//                 </p>
//               </div>

//               <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-indigo-950/50 flex items-center justify-center">
//                 <User
//                   size={19}
//                   className="text-brand-600 dark:text-indigo-400"
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500">
//                   Recommendations
//                 </p>

//                 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
//                   {totalRecommendations}
//                 </p>
//               </div>

//               <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
//                 <ShoppingBag
//                   size={19}
//                   className="text-blue-600 dark:text-blue-400"
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500">
//                   Personalized signals
//                 </p>

//                 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
//                   {personalizedRecommendations}
//                 </p>
//               </div>

//               <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
//                 <TrendingUp
//                   size={19}
//                   className="text-emerald-600 dark:text-emerald-400"
//                 />
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Search */}
//       {!loading && !error && rows.length > 0 && (
//         <div className="relative">
//           <Search
//             size={17}
//             className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
//           />

//           <input
//             type="text"
//             value={search}
//             onChange={(event) => setSearch(event.target.value)}
//             placeholder="Search customers..."
//             className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
//           />
//         </div>
//       )}

//       {/* Loading */}
//       {loading && (
//         <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
//           <RefreshCw
//             size={30}
//             className="animate-spin mx-auto text-brand-600 dark:text-indigo-400"
//           />

//           <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
//             Generating recommendations...
//           </p>

//           <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
//             Analyzing customer purchasing behaviour and product signals.
//           </p>
//         </div>
//       )}

//       {/* Error */}
//       {!loading && error && (
//         <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6">
//           <div className="flex items-start gap-3">
//             <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
//               <Brain size={18} className="text-red-600 dark:text-red-400" />
//             </div>

//             <div>
//               <p className="font-semibold text-red-700 dark:text-red-400">
//                 Recommendation service unavailable
//               </p>

//               <p className="text-sm text-red-600 dark:text-red-400 mt-1">
//                 {error}
//               </p>

//               <button
//                 onClick={fetchRecommendations}
//                 className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300 hover:underline"
//               >
//                 Try again
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Empty */}
//       {!loading && !error && rows.length === 0 && (
//         <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
//           <ShoppingBag
//             size={34}
//             className="mx-auto text-slate-400"
//           />

//           <p className="mt-4 font-semibold text-slate-700 dark:text-slate-300">
//             No recommendations available
//           </p>

//           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
//             There is not enough purchase history to generate recommendations.
//           </p>
//         </div>
//       )}

//       {/* Results */}
//       {!loading && !error && filteredRows.length > 0 && (
//         <div className="space-y-5">
//           {filteredRows.map((customer) => (
//             <CustomerCard
//               key={customer.customer_id}
//               customer={customer}
//             />
//           ))}
//         </div>
//       )}

//       {/* Search empty */}
//       {!loading &&
//         !error &&
//         rows.length > 0 &&
//         filteredRows.length === 0 && (
//           <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
//             <Search
//               size={28}
//               className="mx-auto text-slate-400"
//             />

//             <p className="mt-3 font-medium text-slate-700 dark:text-slate-300">
//               No customers found
//             </p>

//             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
//               Try a different customer name.
//             </p>
//           </div>
//         )}
//     </div>
//   )
// }






















// import { useEffect, useMemo, useState } from 'react'
// import {
//   Activity, Brain, ChevronDown, ChevronUp, Clock3, Cpu, Database,
//   Layers3, Package, RefreshCw, Search, Sparkles, Target, TrendingUp,
//   User, Zap,
// } from 'lucide-react'
// import api from '../services/api'

// const TYPE_CONFIG = {
//   cross_sell: { label: 'Cross-sell', className: 'border-cyan-200/70 bg-cyan-50/80 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300' },
//   upsell: { label: 'Upsell', className: 'border-violet-200/70 bg-violet-50/80 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300' },
//   personalized: { label: 'Personalized', className: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
//   popular: { label: 'Popular', className: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
// }

// function formatCurrency(value) {
//   if (value == null || Number.isNaN(Number(value))) return '—'
//   return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
// }

// function getTypeConfig(type) {
//   return TYPE_CONFIG[type] || {
//     label: type ? type.replaceAll('_', ' ') : 'Recommendation',
//     className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
//   }
// }

// function getInitials(name = '') {
//   return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
// }

// function SignalBar({ label, value }) {
//   const percentage = Math.max(0, Math.min(100, Number(value || 0) * 100))
//   return (
//     <div className="space-y-1.5">
//       <div className="flex items-center justify-between text-[11px]">
//         <span className="font-medium text-slate-500 dark:text-slate-400">{label}</span>
//         <span className="font-bold text-slate-700 dark:text-slate-200">{percentage.toFixed(0)}%</span>
//       </div>
//       <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
//         <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-500" style={{ width: `${percentage}%` }} />
//       </div>
//     </div>
//   )
// }

// function RecommendationCard({ recommendation, rank }) {
//   const [showSignals, setShowSignals] = useState(false)
//   const typeConfig = getTypeConfig(recommendation.recommendation_type)
//   const score = Math.max(0, Math.min(1, Number(recommendation.score || 0)))
//   const scorePercent = score * 100
//   const signals = recommendation.signals || {}
//   const stock = Number(recommendation.inventory_available ?? 0)
//   const hasPersonalizedSignal = Number(signals.collaborative_score || 0) > 0 || Number(signals.association_score || 0) > 0

//   return (
//     <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_18px_50px_-24px_rgba(79,70,229,0.45)] dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900/70">
//       <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
//       <div className="flex items-start gap-3">
//         <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-600 dark:border-violet-900/50 dark:from-violet-950/50 dark:to-indigo-950/50 dark:text-violet-300">
//           <Package size={19} />
//           <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-slate-900 px-1 text-[9px] font-bold text-white dark:border-slate-900">#{rank}</span>
//         </div>
//         <div className="min-w-0 flex-1">
//           <div className="flex items-start justify-between gap-3">
//             <div className="min-w-0">
//               <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{recommendation.product_name}</h4>
//               {recommendation.category && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{recommendation.category}</p>}
//             </div>
//             <div className="shrink-0 text-right">
//               <p className="text-sm font-extrabold text-slate-900 dark:text-white">{formatCurrency(recommendation.price)}</p>
//               <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-300"><Target size={10} />{scorePercent.toFixed(0)}% match</div>
//             </div>
//           </div>
//           <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
//             <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${typeConfig.className}`}><Sparkles size={10} />{typeConfig.label}</span>
//             {hasPersonalizedSignal && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><Brain size={10} />Personalized</span>}
//           </div>
//         </div>
//       </div>

//       <div className="mt-4">
//         <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Recommendation strength</span><span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200">{scorePercent.toFixed(0)}%</span></div>
//         <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" style={{ width: `${scorePercent}%` }} /></div>
//       </div>

//       <div className="mt-4 grid grid-cols-2 gap-2">
//         <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
//           <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><Package size={11} />Stock</div>
//           <p className={`mt-1 text-xs font-extrabold ${stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{stock.toLocaleString('en-IN')} available</p>
//         </div>
//         <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
//           <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><Zap size={11} />Product ID</div>
//           <p className="mt-1 text-xs font-extrabold text-slate-700 dark:text-slate-200">#{recommendation.product_id}</p>
//         </div>
//       </div>

//       <div className="mt-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-3 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-indigo-950/20">
//         <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 text-violet-600 shadow-sm dark:bg-slate-900/60 dark:text-violet-300"><Brain size={12} /></div><span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Why this product</span></div>
//         <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{recommendation.reason || 'Recommended based on customer purchasing behaviour.'}</p>
//       </div>

//       <button type="button" onClick={() => setShowSignals((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[10px] font-bold text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300">
//         <span>View recommendation signals</span>{showSignals ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
//       </button>
//       {showSignals && <div className="mt-2 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
//         <SignalBar label="Collaborative" value={signals.collaborative_score} />
//         <SignalBar label="Association" value={signals.association_score} />
//         <SignalBar label="Popularity" value={signals.popularity_score} />
//         <SignalBar label="Price fit" value={signals.price_score} />
//         {signals.signal_sources?.length > 0 && <div className="pt-1"><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Active signals</p><div className="flex flex-wrap gap-1.5">{signals.signal_sources.map((source) => <span key={source} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold capitalize text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{source.replaceAll('_', ' ')}</span>)}</div></div>}
//       </div>}
//     </article>
//   )
// }

// function CustomerCard({ customer, expanded, onToggle }) {
//   const recommendations = customer.recommendations || []
//   const personalizedCount = recommendations.filter((item) => Number(item.signals?.collaborative_score || 0) > 0 || Number(item.signals?.association_score || 0) > 0).length

//   return (
//     <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
//       <button type="button" onClick={onToggle} className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
//         <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-violet-500/20">{getInitials(customer.customer_name)}<span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" /></div>
//         <div className="min-w-0 flex-1">
//           <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{customer.customer_name}</h2><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">ID #{customer.customer_id}</span></div>
//           <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><Sparkles size={10} />{recommendations.length} recommendations</span>{personalizedCount > 0 && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Activity size={10} />{personalizedCount} personalized</span>}</div>
//         </div>
//         <div className="hidden items-center gap-2 sm:flex"><MiniStat label="Orders" value={customer.total_orders ?? 0} /><MiniStat label="AOV" value={formatCurrency(customer.average_order_value)} /></div>
//         <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition group-hover:border-violet-200 group-hover:text-violet-600 dark:border-slate-700 dark:group-hover:border-violet-900">{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
//       </button>
//       {expanded && <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
//         <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Recommendation workspace</p><p className="mt-0.5 text-[10px] text-slate-400">Ranked using customer behaviour and product signals</p></div><div className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"><Cpu size={10} />AI ranked</div></div>
//         {recommendations.length > 0 ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{recommendations.map((recommendation, index) => <RecommendationCard key={`${recommendation.product_id}-${index}`} recommendation={recommendation} rank={index + 1} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700"><Package className="mx-auto text-slate-400" size={25} /><p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">No recommendations available</p></div>}
//       </div>}
//     </section>
//   )
// }

// function MiniStat({ label, value }) {
//   return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-800/60"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{value}</p></div>
// }

// function MetricCard({ label, value, icon: Icon, detail, accent = false }) {
//   return <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/75"><div className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl ${accent ? 'bg-emerald-400/10' : 'bg-violet-400/10'}`} /><div className="relative flex items-center justify-between gap-3"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-[9px] font-medium text-slate-400">{detail}</p></div><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300'}`}><Icon size={18} /></div></div></div>
// }

// export default function Recommendations() {
//   const [rows, setRows] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState('')
//   const [search, setSearch] = useState('')
//   const [typeFilter, setTypeFilter] = useState('all')
//   const [expandedCustomers, setExpandedCustomers] = useState(new Set())

//   const fetchRecommendations = async () => {
//     try {
//       setLoading(true); setError('')
//       const response = await api.get('/ai/recommendations')
//       const nextRows = response.data?.rows || []
//       setRows(nextRows)
//       if (nextRows.length > 0) setExpandedCustomers(new Set([nextRows[0].customer_id]))
//     } catch (err) {
//       console.error('Recommendation API error:', err)
//       setError(err.response?.data?.detail || err.response?.data?.error || 'Unable to load product recommendations.')
//     } finally { setLoading(false) }
//   }

//   useEffect(() => { fetchRecommendations() }, [])

//   const totalRecommendations = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations?.length || 0), 0), [rows])
//   const personalizedRecommendations = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations || []).filter((item) => Number(item.signals?.collaborative_score || 0) > 0 || Number(item.signals?.association_score || 0) > 0).length, 0), [rows])
//   const typeCounts = useMemo(() => {
//     const counts = { all: 0 }
//     rows.forEach((customer) => (customer.recommendations || []).forEach((item) => { const type = item.recommendation_type || 'other'; counts[type] = (counts[type] || 0) + 1; counts.all += 1 }))
//     return counts
//   }, [rows])
//   const filteredRows = useMemo(() => {
//     const query = search.trim().toLowerCase()
//     return rows.map((customer) => {
//       const recommendations = (customer.recommendations || []).filter((item) => typeFilter === 'all' || (item.recommendation_type || 'other') === typeFilter)
//       const customerMatches = customer.customer_name?.toLowerCase().includes(query)
//       const productMatches = recommendations.some((item) => item.product_name?.toLowerCase().includes(query))
//       return !query || customerMatches || productMatches ? { ...customer, recommendations } : null
//     }).filter(Boolean)
//   }, [rows, search, typeFilter])

//   const toggleCustomer = (id) => setExpandedCustomers((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
//   const expandAll = () => setExpandedCustomers(new Set(filteredRows.map((row) => row.customer_id)))
//   const collapseAll = () => setExpandedCustomers(new Set())

//   return <div className="relative min-h-full overflow-hidden">
//     <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" /><div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" /><div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} /></div>
//     <div className="space-y-5">
//       <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 lg:p-6"><div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex items-start gap-4"><div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-violet-500/20"><Sparkles size={25} /><span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white lg:text-3xl">Product Recommendations</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />AI engine online</span></div><p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Intelligent product suggestions ranked from customer behaviour, product signals, and recommendation scores.</p><div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-400"><span className="inline-flex items-center gap-1.5"><Database size={11} />Live API data</span><span className="inline-flex items-center gap-1.5"><Clock3 size={11} />Real-time refresh</span><span className="inline-flex items-center gap-1.5"><Layers3 size={11} />Multi-signal ranking</span></div></div></div><button onClick={fetchRecommendations} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-900 dark:hover:text-violet-300"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh engine</button></div></header>

//       {!loading && !error && rows.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><MetricCard label="Customers analyzed" value={rows.length.toLocaleString('en-IN')} icon={User} detail="Active recommendation profiles" /><MetricCard label="Recommendations" value={totalRecommendations.toLocaleString('en-IN')} icon={Target} detail="AI-ranked product opportunities" /><MetricCard label="Personalized signals" value={personalizedRecommendations.toLocaleString('en-IN')} icon={TrendingUp} detail="Behaviour-driven recommendations" accent /></div>}

//       {!loading && !error && rows.length > 0 && <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers or products..." className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:focus:border-violet-800 dark:focus:bg-slate-900" /></div><div className="flex flex-wrap items-center gap-1.5">{['all','cross_sell','upsell','personalized','popular'].map((type) => { const count = typeCounts[type] || 0; if (type !== 'all' && count === 0) return null; const active = typeFilter === type; const label = type === 'all' ? 'All' : getTypeConfig(type).label; return <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-lg px-2.5 py-2 text-[10px] font-extrabold transition ${active ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}>{label}<span className="ml-1 opacity-50">{count}</span></button> })}</div><div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 lg:block" /><div className="flex items-center gap-1"><button type="button" onClick={expandAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Expand all</button><button type="button" onClick={collapseAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Collapse</button></div></div></div>}

//       {loading && <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-12 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 dark:from-violet-950/50 dark:to-indigo-950/50 dark:text-violet-300"><RefreshCw size={26} className="animate-spin" /></div><p className="mt-4 text-sm font-extrabold text-slate-800 dark:text-slate-100">Initializing recommendation engine</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fetching customer profiles and AI-ranked product signals...</p><div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" /></div></div>}

//       {!loading && error && <div className="rounded-3xl border border-red-200 bg-red-50/80 p-6 dark:border-red-900/60 dark:bg-red-950/20"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"><Activity size={18} /></div><div><p className="text-sm font-extrabold text-red-700 dark:text-red-300">Recommendation service unavailable</p><p className="mt-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{error}</p><button onClick={fetchRecommendations} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-red-700">Try again</button></div></div></div>}

//       {!loading && !error && rows.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center dark:border-slate-700 dark:bg-slate-900/60"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Package size={26} /></div><p className="mt-4 text-sm font-extrabold text-slate-700 dark:text-slate-200">No recommendations available</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">There is not enough purchase history to generate recommendations.</p></div>}

//       {!loading && !error && rows.length > 0 && filteredRows.length > 0 && <div className="space-y-3"><div className="flex items-center justify-between px-1"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recommendation feed</p><p className="text-[10px] font-semibold text-slate-400">{filteredRows.length} customer{filteredRows.length === 1 ? '' : 's'}</p></div>{filteredRows.map((customer) => <CustomerCard key={customer.customer_id} customer={customer} expanded={expandedCustomers.has(customer.customer_id)} onToggle={() => toggleCustomer(customer.customer_id)} />)}</div>}

//       {!loading && !error && rows.length > 0 && filteredRows.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700"><Search className="mx-auto text-slate-400" size={28} /><p className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">No matching recommendations</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another customer, product, or recommendation type.</p></div>}
//     </div>
//   </div>
// }




















// import { useEffect, useMemo, useState } from 'react'
// import {
//   Activity, Brain, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3,
//   Cpu, Database, Layers3, Package, RefreshCw, Search, Sparkles, Target,
//   TrendingUp, User, Zap,
// } from 'lucide-react'
// import api from '../services/api'

// const TYPE_CONFIG = {
//   cross_sell: { label: 'Cross-sell', className: 'border-cyan-200/70 bg-cyan-50/80 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300' },
//   upsell: { label: 'Upsell', className: 'border-violet-200/70 bg-violet-50/80 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300' },
//   personalized: { label: 'Personalized', className: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
//   popular: { label: 'Popular', className: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
// }

// function formatCurrency(value) {
//   if (value == null || Number.isNaN(Number(value))) return '—'
//   return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
// }

// function getTypeConfig(type) {
//   return TYPE_CONFIG[type] || {
//     label: type ? type.replaceAll('_', ' ') : 'Recommendation',
//     className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
//   }
// }

// function getInitials(name = '') {
//   return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
// }

// function matchTier(score) {
//   if (score >= 0.75) return { label: 'Strong match', color: '#10b981' }
//   if (score >= 0.45) return { label: 'Good match', color: '#6366f1' }
//   return { label: 'Fair match', color: '#f59e0b' }
// }

// // Signature element: a single confident radial "match" ring built from the
// // one score the engine actually returns, instead of four signal bars that
// // would show misleading zeros whenever per-signal detail isn't available.
// function MatchRing({ score, size = 64 }) {
//   const pct = Math.max(0, Math.min(1, Number(score || 0)))
//   const stroke = 6
//   const r = (size - stroke) / 2
//   const circumference = 2 * Math.PI * r
//   const offset = circumference * (1 - pct)
//   const tier = matchTier(pct)

//   return (
//     <div className="relative shrink-0" style={{ width: size, height: size }}>
//       <svg width={size} height={size} className="-rotate-90">
//         <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-800" />
//         <circle
//           cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.color} strokeWidth={stroke} strokeLinecap="round"
//           strokeDasharray={circumference} strokeDashoffset={offset}
//           style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
//         />
//       </svg>
//       <div className="absolute inset-0 flex flex-col items-center justify-center">
//         <span className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{Math.round(pct * 100)}</span>
//         <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">match</span>
//       </div>
//     </div>
//   )
// }

// function RecommendationCard({ recommendation, rank, delay }) {
//   const [showDetail, setShowDetail] = useState(false)
//   const typeConfig = getTypeConfig(recommendation.recommendation_type)
//   const score = Math.max(0, Math.min(1, Number(recommendation.score || 0)))
//   const tier = matchTier(score)
//   const signals = recommendation.signals || {}
//   const hasSignalDetail = Number(signals.collaborative_score || 0) > 0 || Number(signals.association_score || 0) > 0 || Number(signals.popularity_score || 0) > 0
//   const stock = recommendation.inventory_available
//   const hasStock = stock != null

//   return (
//     <article
//       className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_18px_50px_-24px_rgba(79,70,229,0.45)] motion-safe:animate-[fadeSlideIn_0.5s_ease_both] dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900/70"
//       style={{ animationDelay: `${delay}ms` }}
//     >
//       <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

//       <div className="flex items-start gap-3">
//         <MatchRing score={score} />
//         <div className="min-w-0 flex-1">
//           <div className="flex items-start justify-between gap-2">
//             <div className="min-w-0">
//               <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300 dark:text-slate-600">
//                 <span>#{rank}</span>
//                 <span className="h-1 w-1 rounded-full bg-current" />
//                 <span style={{ color: tier.color }}>{tier.label}</span>
//               </div>
//               <h4 className="mt-0.5 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{recommendation.product_name}</h4>
//               {recommendation.category && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{recommendation.category}</p>}
//             </div>
//             <p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{formatCurrency(recommendation.price)}</p>
//           </div>

//           <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
//             <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${typeConfig.className}`}>
//               <Sparkles size={10} />{typeConfig.label}
//             </span>
//             {hasStock && (
//               <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${stock > 0 ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' : 'border-red-200 bg-red-50 text-red-500 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400'}`}>
//                 <Package size={10} />{stock > 0 ? `${stock.toLocaleString('en-IN')} in stock` : 'Out of stock'}
//               </span>
//             )}
//           </div>
//         </div>
//       </div>

//       <div className="mt-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-3 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-indigo-950/20">
//         <div className="flex items-center gap-2">
//           <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 text-violet-600 shadow-sm dark:bg-slate-900/60 dark:text-violet-300"><Brain size={12} /></div>
//           <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Why this product</span>
//         </div>
//         <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{recommendation.reason || 'Recommended based on customer purchasing behaviour.'}</p>
//       </div>

//       {hasSignalDetail && (
//         <>
//           <button type="button" onClick={() => setShowDetail((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[10px] font-bold text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300">
//             <span>View signal breakdown</span>{showDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
//           </button>
//           {showDetail && (
//             <div className="mt-2 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
//               {[
//                 ['Collaborative', signals.collaborative_score],
//                 ['Association', signals.association_score],
//                 ['Popularity', signals.popularity_score],
//                 ['Price fit', signals.price_score],
//               ].map(([label, value]) => {
//                 const p = Math.max(0, Math.min(100, Number(value || 0) * 100))
//                 return (
//                   <div key={label} className="space-y-1">
//                     <div className="flex items-center justify-between text-[10px]"><span className="font-medium text-slate-500 dark:text-slate-400">{label}</span><span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{p.toFixed(0)}%</span></div>
//                     <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" style={{ width: `${p}%` }} /></div>
//                   </div>
//                 )
//               })}
//             </div>
//           )}
//         </>
//       )}
//     </article>
//   )
// }

// function MiniStat({ label, value }) {
//   return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-800/60"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{value}</p></div>
// }

// function CustomerCard({ customer, expanded, onToggle }) {
//   const recommendations = customer.recommendations || []
//   const bestScore = recommendations.reduce((max, r) => Math.max(max, Number(r.score || 0)), 0)

//   return (
//     <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
//       <button type="button" onClick={onToggle} className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
//         <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-violet-500/20">
//           {getInitials(customer.customer_name)}
//           <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
//         </div>
//         <div className="min-w-0 flex-1">
//           <div className="flex flex-wrap items-center gap-2">
//             <h2 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{customer.customer_name}</h2>
//             <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">ID #{customer.customer_id}</span>
//           </div>
//           <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
//             <span className="inline-flex items-center gap-1"><Sparkles size={10} />{recommendations.length} recommendations</span>
//             {bestScore > 0 && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Activity size={10} />Best match {Math.round(bestScore * 100)}%</span>}
//           </div>
//         </div>
//         <div className="hidden items-center gap-2 sm:flex">
//           <MiniStat label="Orders" value={customer.total_orders ?? '—'} />
//           <MiniStat label="AOV" value={formatCurrency(customer.average_order_value)} />
//         </div>
//         <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition group-hover:border-violet-200 group-hover:text-violet-600 dark:border-slate-700 dark:group-hover:border-violet-900">
//           {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
//         </div>
//       </button>
//       {expanded && (
//         <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
//           <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
//             <div>
//               <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Recommendation workspace</p>
//               <p className="mt-0.5 text-[10px] text-slate-400">Ranked using customer behaviour and product signals</p>
//             </div>
//             <div className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"><Cpu size={10} />AI ranked</div>
//           </div>
//           {recommendations.length > 0 ? (
//             <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
//               {recommendations.map((recommendation, index) => (
//                 <RecommendationCard key={`${recommendation.product_id}-${index}`} recommendation={recommendation} rank={index + 1} delay={index * 60} />
//               ))}
//             </div>
//           ) : (
//             <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
//               <Package className="mx-auto text-slate-400" size={25} />
//               <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">No recommendations available</p>
//             </div>
//           )}
//         </div>
//       )}
//     </section>
//   )
// }

// function MetricCard({ label, value, icon: Icon, detail, accent = false }) {
//   return (
//     <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/75">
//       <div className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl ${accent ? 'bg-emerald-400/10' : 'bg-violet-400/10'}`} />
//       <div className="relative flex items-center justify-between gap-3">
//         <div>
//           <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
//           <p className="mt-1 text-2xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">{value}</p>
//           <p className="mt-1 text-[9px] font-medium text-slate-400">{detail}</p>
//         </div>
//         <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300'}`}><Icon size={18} /></div>
//       </div>
//     </div>
//   )
// }

// function Pagination({ page, totalPages, totalCustomers, onPageChange, loading }) {
//   if (totalPages <= 1) return null
//   return (
//     <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
//       <p className="text-[10px] font-semibold text-slate-400">
//         Page <span className="font-extrabold text-slate-700 dark:text-slate-200">{page}</span> of {totalPages} · {totalCustomers} customers total
//       </p>
//       <div className="flex items-center gap-1.5">
//         <button
//           type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}
//           className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-900"
//         ><ChevronLeft size={13} />Prev</button>
//         <button
//           type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}
//           className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-900"
//         >Next<ChevronRight size={13} /></button>
//       </div>
//     </div>
//   )
// }

// export default function Recommendations() {
//   const [rows, setRows] = useState([])
//   const [page, setPage] = useState(1)
//   const [totalPages, setTotalPages] = useState(1)
//   const [totalCustomers, setTotalCustomers] = useState(0)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState('')
//   const [search, setSearch] = useState('')
//   const [typeFilter, setTypeFilter] = useState('all')
//   const [expandedCustomers, setExpandedCustomers] = useState(new Set())

//   const fetchRecommendations = async (targetPage = page) => {
//     try {
//       setLoading(true); setError('')
//       const response = await api.get('/ai/recommendations', { params: { page: targetPage, page_size: 5 } })
//       const nextRows = response.data?.rows || []
//       setRows(nextRows)
//       setPage(response.data?.page || targetPage)
//       setTotalPages(response.data?.total_pages || 1)
//       setTotalCustomers(response.data?.total_customers ?? nextRows.length)
//       if (nextRows.length > 0) setExpandedCustomers(new Set([nextRows[0].customer_id]))
//     } catch (err) {
//       console.error('Recommendation API error:', err)
//       setError(err.response?.data?.detail || err.response?.data?.error || 'Unable to load product recommendations.')
//     } finally { setLoading(false) }
//   }

//   useEffect(() => { fetchRecommendations(1) }, [])

//   const totalRecommendations = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations?.length || 0), 0), [rows])
//   const strongMatches = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations || []).filter((item) => Number(item.score || 0) >= 0.75).length, 0), [rows])
//   const typeCounts = useMemo(() => {
//     const counts = { all: 0 }
//     rows.forEach((customer) => (customer.recommendations || []).forEach((item) => { const type = item.recommendation_type || 'other'; counts[type] = (counts[type] || 0) + 1; counts.all += 1 }))
//     return counts
//   }, [rows])
//   const filteredRows = useMemo(() => {
//     const query = search.trim().toLowerCase()
//     return rows.map((customer) => {
//       const recommendations = (customer.recommendations || []).filter((item) => typeFilter === 'all' || (item.recommendation_type || 'other') === typeFilter)
//       const customerMatches = customer.customer_name?.toLowerCase().includes(query)
//       const productMatches = recommendations.some((item) => item.product_name?.toLowerCase().includes(query))
//       return !query || customerMatches || productMatches ? { ...customer, recommendations } : null
//     }).filter(Boolean)
//   }, [rows, search, typeFilter])

//   const toggleCustomer = (id) => setExpandedCustomers((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
//   const expandAll = () => setExpandedCustomers(new Set(filteredRows.map((row) => row.customer_id)))
//   const collapseAll = () => setExpandedCustomers(new Set())
//   const goToPage = (nextPage) => fetchRecommendations(nextPage)

//   return (
//     <div className="relative min-h-full overflow-hidden">
//       <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
//       <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
//         <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" />
//         <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
//         <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
//       </div>
//       <div className="space-y-5">
//         <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 lg:p-6">
//           <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
//           <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
//             <div className="flex items-start gap-4">
//               <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-violet-500/20">
//                 <Sparkles size={25} />
//                 <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
//               </div>
//               <div>
//                 <div className="flex flex-wrap items-center gap-2">
//                   <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white lg:text-3xl">Product Recommendations</h1>
//                   <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />AI engine online</span>
//                 </div>
//                 <p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Intelligent product suggestions ranked from customer behaviour, product signals, and recommendation scores.</p>
//                 <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-400">
//                   <span className="inline-flex items-center gap-1.5"><Database size={11} />Precomputed & cached</span>
//                   <span className="inline-flex items-center gap-1.5"><Clock3 size={11} />Refreshed hourly</span>
//                   <span className="inline-flex items-center gap-1.5"><Layers3 size={11} />Multi-signal ranking</span>
//                 </div>
//               </div>
//             </div>
//             <button onClick={() => fetchRecommendations(page)} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-900 dark:hover:text-violet-300">
//               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh page
//             </button>
//           </div>
//         </header>

//         {!loading && !error && rows.length > 0 && (
//           <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
//             <MetricCard label="Customers this page" value={rows.length.toLocaleString('en-IN')} icon={User} detail={`${totalCustomers} total across all pages`} />
//             <MetricCard label="Recommendations" value={totalRecommendations.toLocaleString('en-IN')} icon={Target} detail="AI-ranked product opportunities" />
//             <MetricCard label="Strong matches" value={strongMatches.toLocaleString('en-IN')} icon={TrendingUp} detail="75%+ match confidence" accent />
//           </div>
//         )}

//         {!loading && !error && rows.length > 0 && (
//           <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
//             <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
//               <div className="relative flex-1">
//                 <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
//                 <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this page's customers or products..." className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:focus:border-violet-800 dark:focus:bg-slate-900" />
//               </div>
//               <div className="flex flex-wrap items-center gap-1.5">
//                 {['all', 'cross_sell', 'upsell', 'personalized', 'popular'].map((type) => {
//                   const count = typeCounts[type] || 0
//                   if (type !== 'all' && count === 0) return null
//                   const active = typeFilter === type
//                   const label = type === 'all' ? 'All' : getTypeConfig(type).label
//                   return (
//                     <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-lg px-2.5 py-2 text-[10px] font-extrabold transition ${active ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}>
//                       {label}<span className="ml-1 opacity-50">{count}</span>
//                     </button>
//                   )
//                 })}
//               </div>
//               <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 lg:block" />
//               <div className="flex items-center gap-1">
//                 <button type="button" onClick={expandAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Expand all</button>
//                 <button type="button" onClick={collapseAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Collapse</button>
//               </div>
//             </div>
//           </div>
//         )}

//         {loading && (
//           <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-12 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
//             <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 dark:from-violet-950/50 dark:to-indigo-950/50 dark:text-violet-300"><RefreshCw size={26} className="animate-spin" /></div>
//             <p className="mt-4 text-sm font-extrabold text-slate-800 dark:text-slate-100">Loading recommendations</p>
//             <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reading precomputed customer profiles and product signals...</p>
//             <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" /></div>
//           </div>
//         )}

//         {!loading && error && (
//           <div className="rounded-3xl border border-red-200 bg-red-50/80 p-6 dark:border-red-900/60 dark:bg-red-950/20">
//             <div className="flex items-start gap-3">
//               <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"><Activity size={18} /></div>
//               <div>
//                 <p className="text-sm font-extrabold text-red-700 dark:text-red-300">Recommendation service unavailable</p>
//                 <p className="mt-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{error}</p>
//                 <button onClick={() => fetchRecommendations(page)} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-red-700">Try again</button>
//               </div>
//             </div>
//           </div>
//         )}

//         {!loading && !error && rows.length === 0 && (
//           <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center dark:border-slate-700 dark:bg-slate-900/60">
//             <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Package size={26} /></div>
//             <p className="mt-4 text-sm font-extrabold text-slate-700 dark:text-slate-200">No recommendations available</p>
//             <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">There is not enough purchase history to generate recommendations.</p>
//           </div>
//         )}

//         {!loading && !error && rows.length > 0 && filteredRows.length > 0 && (
//           <div className="space-y-3">
//             <div className="flex items-center justify-between px-1">
//               <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recommendation feed</p>
//               <p className="text-[10px] font-semibold text-slate-400">{filteredRows.length} customer{filteredRows.length === 1 ? '' : 's'} on this page</p>
//             </div>
//             {filteredRows.map((customer) => (
//               <CustomerCard key={customer.customer_id} customer={customer} expanded={expandedCustomers.has(customer.customer_id)} onToggle={() => toggleCustomer(customer.customer_id)} />
//             ))}
//           </div>
//         )}

//         {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
//           <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
//             <Search className="mx-auto text-slate-400" size={28} />
//             <p className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">No matching recommendations</p>
//             <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another customer, product, or recommendation type.</p>
//           </div>
//         )}

//         {!loading && !error && <Pagination page={page} totalPages={totalPages} totalCustomers={totalCustomers} onPageChange={goToPage} loading={loading} />}
//       </div>
//     </div>
//   )
// }
















import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Brain, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3,
  Cpu, Database, Layers3, Package, RefreshCw, Search, Sparkles, Target,
  TrendingUp, User, Users, Wallet, Zap,
} from 'lucide-react'
import api from '../services/api'

const TYPE_CONFIG = {
  cross_sell: { label: 'Cross-sell', className: 'border-cyan-200/70 bg-cyan-50/80 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300' },
  upsell: { label: 'Upsell', className: 'border-violet-200/70 bg-violet-50/80 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300' },
  personalized: { label: 'Personalized', className: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
  popular: { label: 'Popular', className: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
}

// Ordered so the strongest, most specific signal wins when several are present.
// Each entry maps a raw signal key to the human-facing "why" framing requested
// for the card: a short label plus a plain-language sentence.
const SIGNAL_REASON_CONFIG = [
  { key: 'collaborative_score', icon: Users, label: 'Similar customers', text: 'Customers with similar purchase patterns also bought this.' },
  { key: 'association_score', icon: Layers3, label: 'Frequently bought together', text: "Often purchased alongside items in this customer's history." },
  { key: 'popularity_score', icon: TrendingUp, label: 'Popular choice', text: 'Frequently purchased and currently in stock.' },
  { key: 'price_score', icon: Wallet, label: 'Price fit', text: "Closely matches this customer's typical spending range." },
]

// Fallback used only when the engine didn't return per-signal detail, so the
// card still explains itself using the recommendation_type alone.
const TYPE_REASON_CONFIG = {
  cross_sell: { icon: Layers3, label: 'Frequently bought together', text: 'Customers who bought similar items also picked this up.' },
  upsell: { icon: Zap, label: 'Upsell opportunity', text: "A higher-value product aligned with this customer's purchasing behaviour." },
  personalized: { icon: Users, label: 'Similar customers', text: 'Customers with similar purchase patterns also bought this.' },
  popular: { icon: TrendingUp, label: 'Popular choice', text: 'Frequently purchased and currently in stock.' },
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || {
    label: type ? type.replaceAll('_', ' ') : 'Recommendation',
    className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

// Four tiers instead of three: high-confidence recommendations (0.85+) now
// read distinctly from merely "strong" ones, which matters once a page has
// several 0.9+ matches sitting next to 0.75s.
function matchTier(score) {
  if (score >= 0.85) return { label: 'Excellent match', color: '#059669' }
  if (score >= 0.7) return { label: 'Strong match', color: '#10b981' }
  if (score >= 0.45) return { label: 'Good match', color: '#6366f1' }
  return { label: 'Fair match', color: '#f59e0b' }
}

// Picks the single best "why" for a card: prefer the dominant real signal
// (so the explanation reflects what actually drove the score), and only
// fall back to a generic type-based reason when no signal detail exists.
function getReasonInfo(recommendation) {
  const signals = recommendation.signals || {}
  const scored = SIGNAL_REASON_CONFIG
    .map((entry) => ({ ...entry, value: Number(signals[entry.key] || 0) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)

  if (scored.length > 0) return scored[0]
  return TYPE_REASON_CONFIG[recommendation.recommendation_type] || {
    icon: Brain, label: 'Recommended', text: 'Recommended based on customer purchasing behaviour.',
  }
}

// Signature element: a single confident radial "match" ring built from the
// one score the engine actually returns, instead of four signal bars that
// would show misleading zeros whenever per-signal detail isn't available.
function MatchRing({ score, size = 64 }) {
  const pct = Math.max(0, Math.min(1, Number(score || 0)))
  const stroke = 6
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)
  const tier = matchTier(pct)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-800" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{Math.round(pct * 100)}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">match</span>
      </div>
    </div>
  )
}

function RecommendationCard({ recommendation, rank, delay }) {
  const [showDetail, setShowDetail] = useState(false)
  const typeConfig = getTypeConfig(recommendation.recommendation_type)
  const score = Math.max(0, Math.min(1, Number(recommendation.score || 0)))
  const tier = matchTier(score)
  const signals = recommendation.signals || {}
  const reasonInfo = getReasonInfo(recommendation)
  const ReasonIcon = reasonInfo.icon || Brain
  const stock = recommendation.inventory_available
  const hasStock = stock != null

  // Sort the breakdown so the signal that actually drove the score appears
  // first, rather than a fixed collaborative/association/popularity/price
  // order that can bury the one signal that matters for this product.
  const signalRows = useMemo(() => {
    return [
      { label: 'Collaborative', value: Number(signals.collaborative_score || 0) },
      { label: 'Association', value: Number(signals.association_score || 0) },
      { label: 'Popularity', value: Number(signals.popularity_score || 0) },
      { label: 'Price fit', value: Number(signals.price_score || 0) },
    ].sort((a, b) => b.value - a.value)
  }, [signals.collaborative_score, signals.association_score, signals.popularity_score, signals.price_score])

  const hasSignalDetail = signalRows.some((row) => row.value > 0)

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_18px_50px_-24px_rgba(79,70,229,0.45)] motion-safe:animate-[fadeSlideIn_0.5s_ease_both] dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900/70"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start gap-3">
        <MatchRing score={score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300 dark:text-slate-600">
                <span>#{rank}</span>
                <span className="h-1 w-1 rounded-full bg-current" />
                <span style={{ color: tier.color }}>{tier.label}</span>
              </div>
              <h4 className="mt-0.5 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{recommendation.product_name}</h4>
              {recommendation.category && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{recommendation.category}</p>}
            </div>
            <p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{formatCurrency(recommendation.price)}</p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${typeConfig.className}`}>
              <Sparkles size={10} />{typeConfig.label}
            </span>
            {hasStock && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${stock > 0 ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' : 'border-red-200 bg-red-50 text-red-500 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400'}`}>
                <Package size={10} />{stock > 0 ? `${stock.toLocaleString('en-IN')} in stock` : 'Out of stock'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-3 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-indigo-950/20">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 text-violet-600 shadow-sm dark:bg-slate-900/60 dark:text-violet-300"><ReasonIcon size={12} /></div>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">{reasonInfo.label}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{recommendation.reason || reasonInfo.text}</p>
      </div>

      {hasSignalDetail && (
        <>
          <button type="button" onClick={() => setShowDetail((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[10px] font-bold text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300">
            <span>View signal breakdown</span>{showDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showDetail && (
            <div className="mt-2 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              {signalRows.map(({ label, value }, index) => {
                const p = Math.max(0, Math.min(100, value * 100))
                const isDominant = index === 0 && value > 0
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-medium ${isDominant ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {label}{isDominant && <span className="ml-1 text-slate-300 dark:text-slate-600">· driving this pick</span>}
                      </span>
                      <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{p.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" style={{ width: `${p}%` }} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </article>
  )
}

function MiniStat({ label, value }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-800/60"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{value}</p></div>
}

function CustomerCard({ customer, expanded, onToggle }) {
  const recommendations = customer.recommendations || []
  const bestScore = recommendations.reduce((max, r) => Math.max(max, Number(r.score || 0)), 0)

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <button type="button" onClick={onToggle} className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-violet-500/20">
          {getInitials(customer.customer_name)}
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{customer.customer_name}</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">ID #{customer.customer_id}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Sparkles size={10} />{recommendations.length} recommendations</span>
            {bestScore > 0 && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Activity size={10} />Best match {Math.round(bestScore * 100)}%</span>}
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <MiniStat label="Orders" value={customer.total_orders ?? '—'} />
          <MiniStat label="AOV" value={formatCurrency(customer.average_order_value)} />
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition group-hover:border-violet-200 group-hover:text-violet-600 dark:border-slate-700 dark:group-hover:border-violet-900">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Recommendation workspace</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Ranked using customer behaviour and product signals</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"><Cpu size={10} />AI ranked</div>
          </div>
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {recommendations.map((recommendation, index) => (
                <RecommendationCard key={`${recommendation.product_id}-${index}`} recommendation={recommendation} rank={index + 1} delay={index * 60} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
              <Package className="mx-auto text-slate-400" size={25} />
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">No recommendations available</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MetricCard({ label, value, icon: Icon, detail, accent = false }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/75">
      <div className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl ${accent ? 'bg-emerald-400/10' : 'bg-violet-400/10'}`} />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-[9px] font-medium text-slate-400">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300'}`}><Icon size={18} /></div>
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, totalCustomers, onPageChange, loading }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-[10px] font-semibold text-slate-400">
        Page <span className="font-extrabold text-slate-700 dark:text-slate-200">{page}</span> of {totalPages} · {totalCustomers} customers total
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-900"
        ><ChevronLeft size={13} />Prev</button>
        <button
          type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-900"
        >Next<ChevronRight size={13} /></button>
      </div>
    </div>
  )
}

export default function Recommendations() {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  // Global recommendation counts by type, when the API provides them, so the
  // feed header and filter chips can show real totals instead of just this
  // page's counts. Falls back to null and the UI degrades gracefully.
  const [globalTypeCounts, setGlobalTypeCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedCustomers, setExpandedCustomers] = useState(new Set())

  const fetchRecommendations = async (targetPage = page) => {
    try {
      setLoading(true); setError('')
      const response = await api.get('/ai/recommendations', { params: { page: targetPage, page_size: 5 } })
      const nextRows = response.data?.rows || []
      setRows(nextRows)
      setPage(response.data?.page || targetPage)
      setTotalPages(response.data?.total_pages || 1)
      setTotalCustomers(response.data?.total_customers ?? nextRows.length)
      // Some backends already return aggregate counts (e.g. total_recommendations,
      // type_counts); use them when present without requiring a backend change.
      if (response.data?.type_counts) setGlobalTypeCounts(response.data.type_counts)
      else setGlobalTypeCounts(null)
      if (nextRows.length > 0) setExpandedCustomers(new Set([nextRows[0].customer_id]))
    } catch (err) {
      console.error('Recommendation API error:', err)
      setError(err.response?.data?.detail || err.response?.data?.error || 'Unable to load product recommendations.')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRecommendations(1) }, [])

  const totalRecommendations = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations?.length || 0), 0), [rows])
  const strongMatches = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations || []).filter((item) => Number(item.score || 0) >= 0.75).length, 0), [rows])
  const typeCounts = useMemo(() => {
    if (globalTypeCounts) return globalTypeCounts
    const counts = { all: 0 }
    rows.forEach((customer) => (customer.recommendations || []).forEach((item) => { const type = item.recommendation_type || 'other'; counts[type] = (counts[type] || 0) + 1; counts.all += 1 }))
    return counts
  }, [rows, globalTypeCounts])
  const countsAreGlobal = Boolean(globalTypeCounts)
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.map((customer) => {
      const recommendations = (customer.recommendations || []).filter((item) => typeFilter === 'all' || (item.recommendation_type || 'other') === typeFilter)
      const customerMatches = customer.customer_name?.toLowerCase().includes(query)
      const productMatches = recommendations.some((item) => item.product_name?.toLowerCase().includes(query))
      return !query || customerMatches || productMatches ? { ...customer, recommendations } : null
    }).filter(Boolean)
  }, [rows, search, typeFilter])

  const toggleCustomer = (id) => setExpandedCustomers((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const expandAll = () => setExpandedCustomers(new Set(filteredRows.map((row) => row.customer_id)))
  const collapseAll = () => setExpandedCustomers(new Set())
  const goToPage = (nextPage) => fetchRecommendations(nextPage)

  return (
    <div className="relative min-h-full overflow-hidden">
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>
      <div className="space-y-5">
        <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 lg:p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-violet-500/20">
                <Sparkles size={25} />
                <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white lg:text-3xl">Product Recommendations</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />AI engine online</span>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Intelligent product suggestions ranked from customer behaviour, product signals, and recommendation scores.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Database size={11} />Precomputed & cached</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={11} />Refreshed hourly</span>
                  <span className="inline-flex items-center gap-1.5"><Layers3 size={11} />Multi-signal ranking</span>
                </div>
              </div>
            </div>
            <button onClick={() => fetchRecommendations(page)} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-900 dark:hover:text-violet-300">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh page
            </button>
          </div>
        </header>

        {!loading && !error && rows.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard label="Customers this page" value={rows.length.toLocaleString('en-IN')} icon={User} detail={`${totalCustomers} total across all pages`} />
            <MetricCard label="Recommendations" value={totalRecommendations.toLocaleString('en-IN')} icon={Target} detail="AI-ranked product opportunities" />
            <MetricCard label="Strong matches" value={strongMatches.toLocaleString('en-IN')} icon={TrendingUp} detail="85%+ and 70%+ match confidence" accent />
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-1 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recommendation feed</p>
              <p className="text-[10px] font-semibold text-slate-400">
                {countsAreGlobal
                  ? <>{totalCustomers.toLocaleString('en-IN')} customers · {(typeCounts.all || 0).toLocaleString('en-IN')} recommendations</>
                  : <>{rows.length.toLocaleString('en-IN')} customers · {totalRecommendations.toLocaleString('en-IN')} recommendations on this page</>}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this page's customers or products..." className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:focus:border-violet-800 dark:focus:bg-slate-900" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['all', 'personalized', 'cross_sell', 'upsell', 'popular'].map((type) => {
                  const count = typeCounts[type] || 0
                  if (type !== 'all' && count === 0) return null
                  const active = typeFilter === type
                  const label = type === 'all' ? 'All' : getTypeConfig(type).label
                  return (
                    <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-lg px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-wide transition ${active ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}>
                      {label}<span className="ml-1 opacity-50">{count.toLocaleString('en-IN')}</span>
                    </button>
                  )
                })}
              </div>
              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 lg:block" />
              <div className="flex items-center gap-1">
                <button type="button" onClick={expandAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Expand all</button>
                <button type="button" onClick={collapseAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Collapse</button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-12 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 dark:from-violet-950/50 dark:to-indigo-950/50 dark:text-violet-300"><RefreshCw size={26} className="animate-spin" /></div>
            <p className="mt-4 text-sm font-extrabold text-slate-800 dark:text-slate-100">Loading recommendations</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reading precomputed customer profiles and product signals...</p>
            <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" /></div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-6 dark:border-red-900/60 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"><Activity size={18} /></div>
              <div>
                <p className="text-sm font-extrabold text-red-700 dark:text-red-300">Recommendation service unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{error}</p>
                <button onClick={() => fetchRecommendations(page)} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-red-700">Try again</button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Package size={26} /></div>
            <p className="mt-4 text-sm font-extrabold text-slate-700 dark:text-slate-200">No recommendations available</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">There is not enough purchase history to generate recommendations.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && filteredRows.length > 0 && (
          <div className="space-y-3">
            {filteredRows.map((customer) => (
              <CustomerCard key={customer.customer_id} customer={customer} expanded={expandedCustomers.has(customer.customer_id)} onToggle={() => toggleCustomer(customer.customer_id)} />
            ))}
          </div>
        )}

        {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
            <Search className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">No matching recommendations</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another customer, product, or recommendation type.</p>
          </div>
        )}

        {!loading && !error && <Pagination page={page} totalPages={totalPages} totalCustomers={totalCustomers} onPageChange={goToPage} loading={loading} />}
      </div>
    </div>
  )
}
