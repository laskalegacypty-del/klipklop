import { useMemo, useState } from 'react'
import { Card, CardContent } from '../ui'

function formatAxisDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function formatTooltipDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildLinePath(points, chartWidth, chartHeight, padding) {
  const xMin = padding.left
  const xMax = chartWidth - padding.right
  const yMin = padding.top
  const yMax = chartHeight - padding.bottom

  const values = points.map(point => point.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const spread = maxValue - minValue || 1

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? (xMin + xMax) / 2
        : xMin + (index / (points.length - 1)) * (xMax - xMin)
    const y = yMax - ((point.value - minValue) / spread) * (yMax - yMin)
    return { ...point, x, y }
  })

  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return { coords, path, minValue, maxValue }
}

function TrendChart({ title, unit, points, lineColor }) {
  if (!points.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-5">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="mt-1 text-sm text-gray-500">No readings logged yet.</p>
      </div>
    )
  }

  const chartWidth = 760
  const chartHeight = 240
  const padding = { top: 18, right: 16, bottom: 40, left: 16 }
  const { coords, path, minValue, maxValue } = buildLinePath(points, chartWidth, chartHeight, padding)
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">
            {points.length} readings · Range {minValue.toFixed(1)}-{maxValue.toFixed(1)} {unit}
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Latest: {last.value.toFixed(1)} {unit}
        </p>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full min-w-[540px]">
          <line
            x1={padding.left}
            y1={chartHeight - padding.bottom}
            x2={chartWidth - padding.right}
            y2={chartHeight - padding.bottom}
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <path d={path} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" />
          {coords.map(point => (
            <g key={`${point.timestamp}-${point.value}`}>
              <circle cx={point.x} cy={point.y} r="4.5" fill={lineColor}>
                <title>{`${point.value.toFixed(1)} ${unit} on ${formatTooltipDate(point.timestamp)}`}</title>
              </circle>
            </g>
          ))}

          <text x={padding.left} y={chartHeight - 10} fontSize="11" fill="#6b7280">
            {formatAxisDate(first.timestamp)}
          </text>
          <text x={chartWidth - padding.right} y={chartHeight - 10} fontSize="11" textAnchor="end" fill="#6b7280">
            {formatAxisDate(last.timestamp)}
          </text>
        </svg>
      </div>
    </div>
  )
}

function ViewToggle({ view, onChange }) {
  const views = [
    { key: 'graph', label: 'Graph' },
    { key: 'entries', label: 'Entries' },
    { key: 'stats', label: 'Stats' },
  ]

  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
      {views.map(option => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
            view === option.key
              ? 'bg-white text-green-800 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function computeDelta(points) {
  if (points.length < 2) return null
  const first = points[0].value
  const last = points[points.length - 1].value
  return last - first
}

function StatsCard({ title, unit, points }) {
  const values = points.map(point => point.value)
  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const min = values.length ? Math.min(...values) : null
  const max = values.length ? Math.max(...values) : null
  const delta = computeDelta(points)

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {!values.length ? (
        <p className="mt-2 text-sm text-gray-500">No readings yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-gray-500">Latest</p>
            <p className="text-sm font-semibold text-gray-900">{points[points.length - 1].value.toFixed(1)} {unit}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Average</p>
            <p className="text-sm font-semibold text-gray-900">{avg.toFixed(1)} {unit}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Min - Max</p>
            <p className="text-sm font-semibold text-gray-900">{min.toFixed(1)} - {max.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Trend</p>
            <p className={`text-sm font-semibold ${delta === null ? 'text-gray-500' : delta >= 0 ? 'text-red-700' : 'text-green-700'}`}>
              {delta === null ? 'N/A' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${unit}`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VitalsTrendCard({ temperaturePoints, heartRatePoints, vitalsEntries }) {
  const [view, setView] = useState('graph')
  const hasAnyVitals = temperaturePoints.length > 0 || heartRatePoints.length > 0
  const entriesForList = useMemo(
    () =>
      [...vitalsEntries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [vitalsEntries],
  )

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Vitals trends</h3>
            <p className="text-sm text-gray-600 mt-1">Switch between graph, entries, and stats views.</p>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

        {!hasAnyVitals ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No vitals readings yet. Add a vitals entry to start seeing trend graphs.
          </div>
        ) : view === 'graph' ? (
          <div className="space-y-4">
            <TrendChart
              title="Temperature"
              unit="°C"
              points={temperaturePoints}
              lineColor="#dc2626"
            />
            <TrendChart
              title="Heart rate"
              unit="bpm"
              points={heartRatePoints}
              lineColor="#2563eb"
            />
          </div>
        ) : view === 'entries' ? (
          <div className="space-y-3">
            {entriesForList.map(entry => (
              <div key={entry.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{entry.typeLabel}</p>
                  <p className="text-xs text-gray-500">{formatTooltipDate(entry.timestamp)}</p>
                </div>
                <p className="mt-1 text-sm text-gray-700">{entry.valueLabel}</p>
                {entry.notes ? <p className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{entry.notes}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <StatsCard title="Temperature" unit="°C" points={temperaturePoints} />
            <StatsCard title="Heart rate" unit="bpm" points={heartRatePoints} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
