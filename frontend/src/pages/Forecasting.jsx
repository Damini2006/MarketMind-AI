import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../services/api'
import { PageHeader, StatCard, PageSkeleton, EmptyState } from '../components/ui.jsx'
import { TrendingUp, TrendingDown, Minus, Target, Gauge } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'

const TREND_ICON = { increasing: TrendingUp, decreasing: TrendingDown, stable: Minus }
const TREND_TONE = { increasing: 'green', decreasing: 'red', stable: 'brand' }

export default function Forecasting() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : undefined
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(14)
  const [granularity, setGranularity] = useState('daily')

  useEffect(() => {
    let isMounted = true

    api.get(`/ai/forecast?horizon_days=${horizon}&granularity=${granularity}`)
      .then((res) => {
        if (isMounted) setData(res.data)
      })
      .catch(() => {
        if (isMounted) setData(null)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [horizon, granularity])

  const handleHorizonChange = (days) => {
    if (days !== horizon) {
      setLoading(true)
      setHorizon(days)
    }
  }

  const handleGranularityChange = (g) => {
    if (g !== granularity) {
      setLoading(true)
      setGranularity(g)
    }
  }

  if (loading) return <PageSkeleton variant="table" />
  if (!data || data.trend === 'insufficient_data') {
    return (
      <div>
        <PageHeader title="Sales Forecasting" subtitle="AI-powered revenue and demand forecasting." />
        <EmptyState message="Not enough historical sales data yet to generate a forecast." />
      </div>
    )
  }

  const chartData = [
    ...data.history.map((h) => ({ period: h.date, actual: h.revenue, forecast: null })),
    ...data.forecast.map((f) => ({ period: f.period, actual: null, forecast: f.predicted_revenue })),
  ]

  const TrendIcon = TREND_ICON[data.trend] || Minus

  return (
    <div>
      <PageHeader title="Sales Forecasting" subtitle="Robust (Huber) regression on revenue trend, scored with a rolling-origin backtest. Switch to weekly totals to see materially tighter errors." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Trend" value={data.trend[0].toUpperCase() + data.trend.slice(1)} icon={TrendIcon} tone={TREND_TONE[data.trend]} />
        <StatCard label="Expected Growth" value={`${data.growth_pct > 0 ? '+' : ''}${data.growth_pct}%`} icon={Target} tone={data.growth_pct >= 0 ? 'green' : 'red'} />
        <StatCard
          label="Model MAE"
          value={data.mae != null ? `₹${data.mae.toLocaleString('en-IN')}` : '—'}
          sub={data.mae_pct_of_avg != null ? `Mean absolute error · ${data.mae_pct_of_avg}% of an average ${granularity === 'weekly' ? 'week' : 'day'}` : 'Mean absolute error'}
        />
        <StatCard
          label="vs. Naive Forecast"
          value={data.baseline_skill_pct != null ? `${data.baseline_skill_pct > 0 ? '+' : ''}${data.baseline_skill_pct}%` : '—'}
          icon={Gauge}
          tone={data.baseline_skill_pct != null && data.baseline_skill_pct >= 0 ? 'green' : 'red'}
          sub={data.baseline_name === '4-weeks-back (the same two weeks, one month earlier)' ? 'Lower error than repeating a month-ago fortnight' : 'Lower error than a same-weekday forecast'}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Revenue: History vs. Forecast</h3>
          
          {/* Daily/Weekly + Horizon selection */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
              {[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
              ].map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => handleGranularityChange(g.value)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    granularity === g.value ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
              <span className="text-slate-400 px-1 dark:text-slate-500">Horizon:</span>
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleHorizonChange(days)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    horizon === days ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: axisColor }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: axisColor }} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
            <Legend wrapperStyle={isDark ? { color: '#cbd5e1' } : undefined} />
            <Line type="monotone" dataKey="actual" name="Actual Revenue" stroke="#3b5bdb" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name="Forecasted Revenue" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>

        {data.history_note && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{data.history_note}</p>
        )}

        {data.eval_days != null && (
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Error measured by a rolling-origin backtest over {data.eval_days} {granularity === 'weekly' ? 'evaluation weeks' : 'days'}: the model is retrained each week on
            history up to that point and scored on the {granularity === 'weekly' ? '2 weeks that follow' : '7 days that follow'}.
            {data.baseline_mae != null && ` Compared against a ${data.baseline_name} forecast (₹${data.baseline_mae.toLocaleString('en-IN')} MAE).`}
            {' '}Days with no recorded sales over a long stretch are treated as missing data, not zero revenue.
          </p>
        )}
      </div>
    </div>
  )
}