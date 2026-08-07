import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../services/api'
import { Loading, PageHeader, StatCard, EmptyState } from '../components/ui.jsx'
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react'

const TREND_ICON = { increasing: TrendingUp, decreasing: TrendingDown, stable: Minus }
const TREND_TONE = { increasing: 'green', decreasing: 'red', stable: 'brand' }

export default function Forecasting() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(14)

  useEffect(() => {
    let isMounted = true

    api.get(`/ai/forecast?horizon_days=${horizon}`)
      .then((res) => {
        if (isMounted) setData(res.data)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [horizon])

  const handleHorizonChange = (days) => {
    if (days !== horizon) {
      setLoading(true)
      setHorizon(days)
    }
  }

  if (loading) return <Loading label="Running forecasting model..." />
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
      <PageHeader title="Sales Forecasting" subtitle="Time-series forecasting engine (Random Forest) trained on historical revenue." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Trend" value={data.trend[0].toUpperCase() + data.trend.slice(1)} icon={TrendIcon} tone={TREND_TONE[data.trend]} />
        <StatCard label="Expected Growth" value={`${data.growth_pct > 0 ? '+' : ''}${data.growth_pct}%`} icon={Target} tone={data.growth_pct >= 0 ? 'green' : 'red'} />
        <StatCard label="Model MAE" value={data.mae != null ? `₹${data.mae.toLocaleString('en-IN')}` : '—'} sub="Mean Absolute Error" />
        <StatCard label="Model R² Score" value={data.r2 != null ? data.r2 : '—'} sub="Goodness of fit" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Revenue: History vs. Forecast</h3>
          
          {/* Horizon Selection Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <span className="text-slate-400 px-1">Horizon:</span>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleHorizonChange(days)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  horizon === days ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="actual" name="Actual Revenue" stroke="#3b5bdb" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name="Forecasted Revenue" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}