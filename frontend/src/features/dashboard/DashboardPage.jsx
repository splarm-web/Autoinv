import { useEffect, useState } from 'react'
import { dashboardApi } from '../../lib/api'
import { eur0, eur2 } from '../../lib/format'
import './DashboardPage.css'

const PERIODOS = [
  { key: 'mes',       label: 'Mes' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'anio',      label: 'Año' },
]

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState('trimestre')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    dashboardApi.get(periodo)
      .then(setData)
      .finally(() => setLoading(false))
  }, [periodo])

  const maxBar = data
    ? Math.max(...data.bars.map((b) => Math.max(b.ingreso, b.gasto)), 1)
    : 1

  return (
    <div>
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Resumen</h1>
          <div className="dash-subtitle">
            {loading ? '…' : (data?.periodo_label ?? '')}
          </div>
        </div>
        <div className="segmented">
          {PERIODOS.map(({ key, label }) => (
            <button
              key={key}
              className={'seg-btn' + (periodo === key ? ' active' : '')}
              onClick={() => setPeriodo(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard label="Ingresos" value={eur0(data?.ingresos)} color="white" loading={loading}
          hint="Total facturado (con impuestos)" />
        <KpiCard label="Gastos"   value={eur0(data?.gastos)}   color="coral" loading={loading}
          hint="Total pagado (con IVA)" />
        <KpiCard
          label="Ingresos netos"
          value={eur0(data?.ingreso_neto)}
          color="menta"
          loading={loading}
          hint="Ingresos − IVA − IRPF"
        />
      </div>

      {/* IVA + chart */}
      <div className="mid-grid">
        <IvaCard data={data} loading={loading} />
        <BarChart bars={data?.bars ?? []} maxBar={maxBar} loading={loading} />
      </div>

      {/* Movements */}
      <div className="card">
        <MovementsList items={data?.movimientos ?? []} loading={loading} />
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, loading, hint }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      {loading
        ? <div className="skeleton" style={{ height: 34, width: '80%' }} />
        : <div className={`kpi-value ${color}`}>{value}</div>
      }
      {hint && !loading && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}

function IvaCard({ data, loading }) {
  return (
    <div className="card">
      <div className="kpi-label" style={{ marginBottom: 18 }}>Impuestos del periodo</div>

      <div className="iva-row">
        <div className="iva-label-wrap">
          <span className="iva-dot" style={{ background: 'var(--menta)' }} />
          <span className="iva-label">IVA repercutido</span>
        </div>
        {loading
          ? <div className="skeleton" style={{ height: 18, width: 70 }} />
          : <span className="iva-amount">{eur2(data?.iva_rep)}</span>
        }
      </div>

      <div className="iva-row">
        <div className="iva-label-wrap">
          <span className="iva-dot" style={{ background: 'var(--cielo)' }} />
          <span className="iva-label">IVA soportado</span>
        </div>
        {loading
          ? <div className="skeleton" style={{ height: 18, width: 70 }} />
          : <span className="iva-amount">{eur2(data?.iva_sop)}</span>
        }
      </div>

      <div className="iva-row">
        <div className="iva-label-wrap">
          <span className="iva-dot" style={{ background: 'var(--coral)' }} />
          <span className="iva-label">IRPF retenido</span>
        </div>
        {loading
          ? <div className="skeleton" style={{ height: 18, width: 70 }} />
          : <span className="iva-amount">{eur2(data?.irpf_ret)}</span>
        }
      </div>

      <div className="iva-liquidar">
        <span className="iva-liquidar-label">IVA a liquidar</span>
        {loading
          ? <div className="skeleton" style={{ height: 24, width: 90 }} />
          : <span className="iva-liquidar-value">{eur2(data?.iva_liquidar)}</span>
        }
      </div>
    </div>
  )
}

function BarChart({ bars, maxBar, loading }) {
  return (
    <div className="card">
      <div className="chart-header">
        <span className="chart-title">Ingresos vs. gastos</span>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: 'var(--menta)' }} />
            Ingresos
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: 'var(--coral)' }} />
            Gastos
          </span>
        </div>
      </div>

      <div className="bars-container">
        {loading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="bar-group">
                <div className="bar-pair" style={{ height: '100%' }}>
                  <div className="skeleton" style={{ width: 22, height: `${40 + i * 20}%`, borderRadius: '4px 4px 0 0' }} />
                  <div className="skeleton" style={{ width: 22, height: `${20 + i * 10}%`, borderRadius: '4px 4px 0 0' }} />
                </div>
                <div className="skeleton" style={{ height: 12, width: 28 }} />
              </div>
            ))
          : bars.map((bar) => {
              const ingPct = Math.round((bar.ingreso / maxBar) * 100)
              const gasPct = Math.round((bar.gasto / maxBar) * 100)
              return (
                <div key={bar.label} className="bar-group">
                  <div className="bar-pair">
                    <div
                      className="bar ingreso"
                      style={{ height: `${ingPct}%` }}
                      title={eur0(bar.ingreso)}
                    />
                    <div
                      className="bar gasto"
                      style={{ height: `${gasPct}%` }}
                      title={eur0(bar.gasto)}
                    />
                  </div>
                  <span className="bar-label">{bar.label}</span>
                </div>
              )
            })
        }
      </div>
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
      <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
        Aún no hay movimientos. Añade tu primer gasto o factura.
      </div>
    )
  }

  return (
    <div className="mov-list">
      {items.map((item, i) => (
        <div key={`${item.tipo}-${item.id}-${i}`} className="mov-row">
          <div className="mov-left">
            <span
              className="mov-dot"
              style={{ background: item.tipo === 'ingreso' ? 'var(--menta)' : 'var(--coral)' }}
            />
            <div>
              <div className="mov-concepto">{item.concepto}</div>
              <div className="mov-meta">{item.meta}</div>
            </div>
          </div>
          <span className={`mov-amount ${item.tipo === 'ingreso' ? 'menta' : 'coral'}`}>
            {item.tipo === 'ingreso' ? '+' : '−'}{eur0(item.importe)}
          </span>
        </div>
      ))}
    </div>
  )
}
