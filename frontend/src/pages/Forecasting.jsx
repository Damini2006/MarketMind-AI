import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

import api from '../services/api'
import {
  Loading,
  PageHeader,
  StatCard,
  EmptyState,
} from '../components/ui.jsx'

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Package,
} from 'lucide-react'

import { useTheme } from '../context/ThemeContext.jsx'


export default function Forecasting() {

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'

  const tooltipStyle = isDark
    ? {
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        color: '#e2e8f0',
      }
    : undefined

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(14)


  useEffect(() => {

    let isMounted = true

    api
      .get(`/ai/forecast?horizon_days=${horizon}`)
      .then((res) => {

        if (isMounted) {
          setData(res.data)
        }

      })
      .catch((err) => {

        console.error(
          'Forecasting error:',
          err
        )

        if (isMounted) {
          setData(null)
        }

      })
      .finally(() => {

        if (isMounted) {
          setLoading(false)
        }

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


  if (loading) {

    return (
      <Loading
        label="Running forecasting model..."
      />
    )

  }


  if (!data || !data.forecast?.length) {

    return (
      <div>

        <PageHeader
          title="Sales Forecasting"
          subtitle="AI-powered sales volume forecasting."
        />

        <EmptyState
          message="Not enough historical sales data yet to generate a forecast."
        />

      </div>
    )

  }


  // --------------------------------------------------
  // Historical data
  // --------------------------------------------------

  const history = data.history || []
  const forecast = data.forecast || []


  // --------------------------------------------------
  // Calculate forecast statistics
  // --------------------------------------------------

const historicalUnits = history.map(
  (item) => Number(item.units_sold || 0)
)

const forecastUnits = forecast.map(
  (item) => Number(item.predicted_units_sold || 0)
)

// Compare the forecast with the most recent 14 historical days
const recentHistoricalUnits = historicalUnits.slice(-14)


const historicalAverage =
  recentHistoricalUnits.length > 0
    ? recentHistoricalUnits.reduce(
        (sum, value) => sum + value,
        0
      ) / recentHistoricalUnits.length
    : 0


  const forecastAverage =
    forecastUnits.length > 0
      ? forecastUnits.reduce(
          (sum, value) => sum + value,
          0
        ) / forecastUnits.length
      : 0


  const growthPercentage =
    historicalAverage > 0
      ? ((forecastAverage - historicalAverage) /
          historicalAverage) *
        100
      : 0


  // --------------------------------------------------
  // Determine trend
  // --------------------------------------------------

  let trend = 'stable'

  if (growthPercentage > 5) {
    trend = 'increasing'
  } else if (growthPercentage < -5) {
    trend = 'decreasing'
  }


  const TREND_ICON = {
    increasing: TrendingUp,
    decreasing: TrendingDown,
    stable: Minus,
  }


  const TREND_TONE = {
    increasing: 'green',
    decreasing: 'red',
    stable: 'brand',
  }


  const TrendIcon =
    TREND_ICON[trend] || Minus
  
  let forecastInsight = ''
let forecastInsightTitle = ''

if (trend === 'increasing') {
  forecastInsightTitle = 'Sales are expected to increase'
  forecastInsight =
    `Forecasted sales are approximately ${Math.abs(growthPercentage).toFixed(1)}% higher than the recent historical average. Consider preparing inventory and stock levels for higher demand.`
} else if (trend === 'decreasing') {
  forecastInsightTitle = 'Sales may slow down'
  forecastInsight =
    `Forecasted sales are approximately ${Math.abs(growthPercentage).toFixed(1)}% below the recent historical average. Consider reviewing inventory, promotions, and sales activity.`
} else {
  forecastInsightTitle = 'Sales are expected to remain stable'
  forecastInsight =
    `Forecasted sales are close to the recent historical average, suggesting relatively stable demand over the forecast period.`
}

  // --------------------------------------------------
  // Chart data
  // --------------------------------------------------

  const chartData = [

    ...history.map((item) => ({
      period: item.Date,
      actual: item.units_sold,
      forecast: null,
    })),

    ...forecast.map((item) => ({
      period: item.period,
      actual: null,
      forecast: item.predicted_units_sold,
    })),

  ]


  return (

    <div>

      <PageHeader
        title="Sales Forecasting"
        subtitle="Multi-feature Random Forest model for future sales volume prediction."
      />


      {/* -------------------------------------------- */}
      {/* KPI CARDS */}
      {/* -------------------------------------------- */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <StatCard
          label="Forecast Horizon"
          value={`${data.horizon_days} Days`}
          icon={Target}
          tone="brand"
        />


        <StatCard
          label="Forecast Units"
          value={Number(
            data.total_forecast_units || 0
          ).toLocaleString('en-IN')}
          sub="Total predicted units"
          icon={Package}
          tone="green"
        />


        <StatCard
          label="Avg. Daily Forecast"
          value={Math.round(
            forecastAverage
          ).toLocaleString('en-IN')}
          sub="Predicted units per day"
          icon={Target}
        />


        <StatCard
          label="Forecast Trend"
          value={
            trend.charAt(0).toUpperCase() +
            trend.slice(1)
          }
          sub={
            `${growthPercentage >= 0 ? '+' : ''}` +
            `${growthPercentage.toFixed(1)}% vs recent history`
          }
          icon={TrendIcon}
          tone={TREND_TONE[trend]}
        />

      </div>


{/* -------------------------------------------- */}
{/* FORECAST INSIGHT */}
{/* -------------------------------------------- */}

<div className="card mb-6">

  <div className="flex items-start gap-4">

    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xl">
      📊
    </div>

    <div>

      <h3 className="font-semibold text-slate-800 dark:text-slate-100">
        {forecastInsightTitle}
      </h3>

      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        {forecastInsight}
      </p>

    </div>

  </div>

</div>

      {/* -------------------------------------------- */}
      {/* MAIN FORECAST CHART */}
      {/* -------------------------------------------- */}

      <div className="card">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">

          <div>

            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              Sales Volume: History vs. Forecast
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Historical units sold compared with AI-predicted future demand.
            </p>

          </div>
          


          {/* Horizon Selection */}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">

            <span className="text-slate-400 px-1 dark:text-slate-500">
              Horizon:
            </span>

            {[7, 14, 30].map((days) => (

              <button
                key={days}
                type="button"
                onClick={() =>
                  handleHorizonChange(days)
                }
                className={`px-2.5 py-1 rounded-md transition-all ${
                  horizon === days
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >

                {days} Days

              </button>

            ))}

          </div>

        </div>


        <ResponsiveContainer
          width="100%"
          height={340}
        >

          <LineChart data={chartData}>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
            />

            <XAxis
              dataKey="period"
              tick={{
                fontSize: 10,
                fill: axisColor,
              }}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{
                fontSize: 11,
                fill: axisColor,
              }}
            />

            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={
                isDark
                  ? { color: '#e2e8f0' }
                  : undefined
              }
            />

            <Legend
              wrapperStyle={
                isDark
                  ? { color: '#cbd5e1' }
                  : undefined
              }
            />


            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Units Sold"
              stroke="#3b5bdb"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />


            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecasted Units"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>
      

      {/* -------------------------------------------- */}
      {/* FORECAST SUMMARY */}
      {/* -------------------------------------------- */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">

        <div className="card">

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last Historical Date
          </p>

          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-1">
            {data.last_historical_date}
          </p>

        </div>


        <div className="card">

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Historical Daily Average
          </p>

          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-1">
            {Math.round(
              historicalAverage
            ).toLocaleString('en-IN')}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Units sold per day
          </p>

        </div>


        <div className="card">

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Predicted Daily Average
          </p>

          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-1">
            {Math.round(
              forecastAverage
            ).toLocaleString('en-IN')}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Expected units per day
          </p>

        </div>

      </div>


            {/* -------------------------------------------- */}
      {/* DAILY FORECAST DETAILS */}
      {/* -------------------------------------------- */}

      <div className="card mt-6">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Daily Forecast Details
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Predicted sales volume for each upcoming day.
          </p>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                  Date
                </th>

                <th className="text-right py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                  Predicted Units
                </th>

                <th className="text-right py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                  Change
                </th>

                <th className="text-right py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {forecast.map((item, index) => {
                const currentUnits = Number(
                  item.predicted_units_sold || 0
                )

                const previousUnits =
                  index === 0
                    ? historicalUnits[historicalUnits.length - 1]
                    : Number(
                        forecast[index - 1].predicted_units_sold || 0
                      )

                const change =
                  previousUnits > 0
                    ? ((currentUnits - previousUnits) /
                        previousUnits) *
                      100
                    : 0

                let status = 'Normal'

                if (currentUnits > forecastAverage * 1.1) {
                  status = 'High'
                } else if (currentUnits < forecastAverage * 0.9) {
                  status = 'Low'
                }

                return (
                  <tr
                    key={item.period || item.Date || index}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-200">
                      {item.period || item.Date}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-800 dark:text-slate-100">
                      {currentUnits.toLocaleString('en-IN')}
                    </td>

                    <td
                      className={`py-3 px-3 text-right font-medium ${
                        change > 0
                          ? 'text-green-600'
                          : change < 0
                          ? 'text-red-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {index === 0 ? (
                        '—'
                      ) : (
                        <>
                          {change > 0 ? '↑' : change < 0 ? '↓' : '→'}{' '}
                          {Math.abs(change).toFixed(1)}%
                        </>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          status === 'High'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : status === 'Low'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>


  )

}