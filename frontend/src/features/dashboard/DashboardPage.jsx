import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { eur0, eur2, fmtDate } from '../../lib/format'
import './DashboardPage.css'

const CURRENT_YEAR = new Date().getFullYear()

const PERIODOS = [
  { key: 'mes',       label: 'Mes' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'anio',      label: 'Año' },
]

export default function DashboardPage() {
  const { hasFeature } = useAuth()
  const [periodo, setPeriodo] = useState('trimestre')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Controles del gráfico (independientes del periodo)
  const [chartView, setChartView] = useState('meses')   // 'meses' | 'anios'
  const [chartYear, setChartYear] = useState(CURRENT_YEAR)
  const [chartMetric, setChartMetric] = useState('total') // 'total' | 'neto'
  const [chartBars, setChartBars] = useState([])
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    dashboardApi.get(periodo).then(setData).finally(() => setLoading(false))
  }, [periodo])

  useEffect(() => {
    setChartLoading(true)
    dashboardApi.chart(chartView, chartView === 'meses' ? chartYear : undefined)
      .then(setChartBars)
      .finally(() => setChartLoading(false))
  }, [chartView, chartYear])

  const resultado = data ? data.resultado : 0

  return (
    <div>
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Resumen</h1>
          <div className="dash-subtitle">{loading ? '…' : (data?.periodo_label ?? '')}</div>
        </div>
        <div className="segmented">
          {PERIODOS.map(({ key, label }) => (
            <button key={key} className={'seg-btn' + (periodo === key ? ' active' : '')} onClick={() => setPeriodo(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <QuickActions hasFeature={hasFeature} />

      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard label="Ingresos" value={eur0(data?.ingresos)} color="white" loading={loading} hint="Total facturado (con impuestos)" />
        <KpiCard label="Gastos" value={eur0(data?.gastos)} color="coral" loading={loading} hint="Total pagado (con IVA)" />
        <KpiCard label="Ingresos netos" value={eur0(data?.ingreso_neto)} color="menta" loading={loading} hint="Cobrado − IVA (lo que te queda)" />
      </div>

      {/* Resultado del periodo */}
      {!loading && (
        <div className="result-strip">
          <span>Resultado del periodo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(cobrado − gastos − IVA a liquidar)</span></span>
          <span className="result-value" style={{ color: resultado >= 0 ? 'var(--menta)' : 'var(--coral)' }}>
            {resultado >= 0 ? '+' : '−'}{eur0(Math.abs(resultado))}
          </span>
        </div>
      )}

      {/* Próxima declaración + impuestos */}
      <div className="mid-grid">
        <ProximaDeclaracion data={data?.proxima_declaracion} loading={loading} />
        <IvaCard data={data} loading={loading} />
      </div>

      {/* Gráfico (ancho completo) */}
      <Chart
        view={chartView} setView={setChartView}
        year={chartYear} setYear={setChartYear}
        metric={chartMetric} setMetric={setChartMetric}
        bars={chartBars} loading={chartLoading}
      />

      {/* Movimientos */}
      <div className="card" style={{ marginTop: 'var(--gap-cards)' }}>
        <MovementsList items={data?.movimientos ?? []} loading={loading} />
      </div>
    </div>
  )
}

function QuickActions({ hasFeature }) {
  const actions = []
  if (hasFeature('facturas')) actions.push({ to: '/invoices/new', label: '+ Factura' })
  if (hasFeature('transporte')) actions.push({ to: '/invoices/transporte', label: '+ Factura de transporte' })
  if (hasFeature('gastos')) actions.push({ to: '/expenses/new', label: '+ Gasto' })
  if (!actions.length) return null
  return (
    <div className="quick-actions">
      {actions.map((a) => (
        <Link key={a.to} to={a.to} className="quick-action">{a.label}</Link>
      ))}
    </div>
  )
}

function KpiCard({ label, value, color, loading, hint }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      {loading ? <div className="skeleton" style={{ height: 34, width: '80%' }} />
        : <div className={`kpi-value ${color}`}>{value}</div>}
      {hint && !loading && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}

function ProximaDeclaracion({ data, loading }) {
  // Lo que realmente pagas este trimestre es el IVA (modelo 303). El IRPF
  // retenido NO se ingresa: ya lo han adelantado tus clientes a Hacienda y
  // cuenta como pago a cuenta de tu declaración de la renta.
  const aIngresar = data ? data.iva_liquidar : 0
  const aCompensar = aIngresar < 0
  const dias = data ? Math.ceil((new Date(data.fecha_limite) - new Date()) / 86400000) : null
  return (
    <div className="card decl-card">
      <div className="kpi-label" style={{ marginBottom: 14 }}>Próxima declaración</div>
      {loading ? (
        <div className="skeleton" style={{ height: 60, width: '100%' }} />
      ) : (
        <>
          <div className="decl-top">
            <div>
              <div className="decl-trim">{data.trimestre}</div>
              <div className="decl-date">
                Hasta el {fmtDate(data.fecha_limite)}
                {dias != null && dias >= 0 && <span className="decl-days"> · {dias} días</span>}
              </div>
            </div>
            <span className="decl-badge">303 · IVA</span>
          </div>
          <div className="decl-rows">
            <div className="decl-row"><span>IVA repercutido</span><span>{eur2(data.iva_repercutido)}</span></div>
            <div className="decl-row"><span>IVA soportado</span><span>−{eur2(data.iva_soportado)}</span></div>
          </div>
          <div className="decl-total">
            <span>{aCompensar ? 'A compensar / devolver' : 'A ingresar (IVA)'}</span>
            <span className="decl-total-value" style={aCompensar ? { color: 'var(--menta)' } : undefined}>
              {eur2(Math.abs(aIngresar))}
            </span>
          </div>
          <div className="decl-note">
            IRPF ya adelantado por tus clientes: <strong>{eur2(data.irpf_retenido)}</strong>
            <span className="decl-note-sub"> · se descuenta en tu declaración de la renta, no lo ingresas ahora</span>
          </div>
        </>
      )}
    </div>
  )
}

function IvaCard({ data, loading }) {
  return (
    <div className="card">
      <div className="kpi-label" style={{ marginBottom: 18 }}>Impuestos del periodo</div>
      <Row label="IVA repercutido" dot="var(--menta)" value={data?.iva_rep} loading={loading} />
      <Row label="IVA soportado" dot="var(--cielo)" value={data?.iva_sop} loading={loading} />
      <Row label="IRPF retenido" dot="var(--coral)" value={data?.irpf_ret} loading={loading} />
      <div className="iva-liquidar">
        <span className="iva-liquidar-label">IVA a liquidar</span>
        {loading ? <div className="skeleton" style={{ height: 24, width: 90 }} />
          : <span className="iva-liquidar-value">{eur2(data?.iva_liquidar)}</span>}
      </div>
    </div>
  )
}

function Row({ label, dot, value, loading }) {
  return (
    <div className="iva-row">
      <div className="iva-label-wrap">
        <span className="iva-dot" style={{ background: dot }} />
        <span className="iva-label">{label}</span>
      </div>
      {loading ? <div className="skeleton" style={{ height: 18, width: 70 }} />
        : <span className="iva-amount">{eur2(value)}</span>}
    </div>
  )
}

function Chart({ view, setView, year, setYear, metric, setMetric, bars, loading }) {
  const incomeKey = metric === 'neto' ? 'ingreso_neto' : 'ingreso'
  const maxBar = Math.max(...bars.map((b) => Math.max(b[incomeKey], b.gasto)), 1)

  const groups = view === 'meses'
    ? [1, 2, 3, 4].map((q) => ({ q, items: bars.filter((b) => b.quarter === q) }))
    : [{ q: null, items: bars }]

  return (
    <div className="card">
      <div className="chart-header">
        <span className="chart-title">Ingresos vs. gastos</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="mini-seg">
            <button className={metric === 'total' ? 'active' : ''} onClick={() => setMetric('total')}>Totales</button>
            <button className={metric === 'neto' ? 'active' : ''} onClick={() => setMetric('neto')}>Netos</button>
          </div>
          <div className="mini-seg">
            <button className={view === 'meses' ? 'active' : ''} onClick={() => setView('meses')}>Meses</button>
            <button className={view === 'anios' ? 'active' : ''} onClick={() => setView('anios')}>Años</button>
          </div>
        </div>
      </div>

      <div className="chart-subhead">
        {view === 'meses' ? (
          <div className="chart-yearnav">
            <button onClick={() => setYear(year - 1)} title="Año anterior">‹</button>
            <span>{year}</span>
            <button onClick={() => setYear(year + 1)} disabled={year >= CURRENT_YEAR} title="Año siguiente">›</button>
          </div>
        ) : <span className="chart-note">Últimos 5 años</span>}
        <div className="chart-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--menta)' }} />{metric === 'neto' ? 'Ingresos netos' : 'Ingresos'}</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--coral)' }} />Gastos</span>
        </div>
      </div>

      {loading ? (
        <div className="bars-container">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bar-group">
              <div className="bar-pair" style={{ height: '100%' }}>
                <div className="skeleton" style={{ width: 16, height: `${30 + i * 8}%`, borderRadius: '4px 4px 0 0' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="chart-groups">
          {groups.map((g) => (
            <div className="chart-group" key={g.q ?? 'all'}>
              <div className="chart-bars">
                {g.items.map((b) => {
                  const ingPct = Math.round((b[incomeKey] / maxBar) * 100)
                  const gasPct = Math.round((b.gasto / maxBar) * 100)
                  return (
                    <div key={b.label} className="bar-group">
                      <div className="bar-pair">
                        <div className="bar ingreso" style={{ height: `${ingPct}%` }} title={eur0(b[incomeKey])} />
                        <div className="bar gasto" style={{ height: `${gasPct}%` }} title={eur0(b.gasto)} />
                      </div>
                      <span className="bar-label">{b.label}</span>
                    </div>
                  )
                })}
              </div>
              {g.q && <div className="quarter-label">T{g.q}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MovementsList({ items, loading }) {
  if (loading) {
    return (
      <div className="mov-list">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="mov-row">
            <div className="mov-left">
              <div className="skeleton" style={{ width: 8, height: 8, borderRadius: 99 }} />
              <div>
                <div className="skeleton" style={{ height: 14, width: 180, marginBottom: 4 }} />
                <div className="skeleton" style={{ height: 11, width: 100 }} />
              </div>
            </div>
            <div className="skeleton" style={{ height: 16, width: 80 }} />
          </div>
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div style={{ padding: '32px 20px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
        Aún no hay movimientos en este periodo.
      </div>
    )
  }

  return (
    <div className="mov-list">
      <div className="mov-head">Últimos movimientos</div>
      {items.map((item, i) => (
        <Link
          key={`${item.tipo}-${item.id}-${i}`}
          to={item.tipo === 'ingreso' ? '/invoices' : '/expenses'}
          className="mov-row mov-row-link"
        >
          <div className="mov-left">
            <span className="mov-dot" style={{ background: item.tipo === 'ingreso' ? 'var(--menta)' : 'var(--coral)' }} />
            <div>
              <div className="mov-concepto">{item.concepto}</div>
              <div className="mov-meta">{item.meta}</div>
            </div>
          </div>
          <span className={`mov-amount ${item.tipo === 'ingreso' ? 'menta' : 'coral'}`}>
            {item.tipo === 'ingreso' ? '+' : '−'}{eur0(item.importe)}
          </span>
        </Link>
      ))}
    </div>
  )
}
