/**
 * TransportePreview — Vista previa en React de la factura de transporte (Alfredo).
 *
 * Replica el diseño del renderer `alfredo` (reportlab) sobre "papel" blanco,
 * mismo enfoque visual que InvoicePreview.jsx. Recibe los datos ya normalizados
 * que arma TransporteInvoicePage.
 *
 * Props:
 *   emisor  { nombre, nif, direccion }
 *   cliente { nombre, cif, direccion, ciudad }
 *   meta    { numero_factura, fecha, concepto_mes, cabeza }
 *   viajes  [{ dia, viaje, kilos, precio, total }]
 *   totals  { base, irpf, iva, total }
 */

import { eur2, fmt0 } from '../../lib/format'

const eur = (v) => eur2(v || 0)
const miles = (v) => fmt0(Math.round(v || 0))

export default function TransportePreview({ emisor, cliente, meta, viajes, totals }) {
  return (
    <div style={s.shell}>
      <div style={s.paper}>
        {/* Cabecera: emisor (izq) + FACTURA Nº / FECHA (der) */}
        <div style={s.header}>
          <div>
            <div style={s.emisorName}>{emisor?.nombre || '—'}</div>
            <div style={s.emisorBody}>
              {emisor?.nif && <>{emisor.nif}<br /></>}
              {(emisor?.direccion || '').split('\n').filter(Boolean).map((l, i) => <span key={i}>{l}<br /></span>)}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 180 }}>
            <div style={s.factRow}>
              <span style={s.factLabel}>FACTURA Nº</span>
              <span style={s.factBox}>{meta?.numero_factura || '—'}</span>
            </div>
            <div style={{ ...s.factRow, marginTop: 6 }}>
              <span style={s.factLabel}>FECHA</span>
              <span style={{ fontSize: 12, color: '#15171c' }}>{meta?.fecha || '—'}</span>
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div style={s.clienteBlock}>
          <div style={s.cliRow}>
            <span style={s.cliLabel}>CLIENTE</span>
            <span style={s.cliValue}>{cliente?.nombre || '—'}</span>
            <span style={{ ...s.cliLabel, marginLeft: 'auto' }}>D.N.I / C.I.F</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#15171c', marginTop: 2 }}>{cliente?.cif || ''}</div>
          <div style={{ ...s.cliRow, marginTop: 8 }}>
            <span style={s.cliLabel}>DOMICILIO</span>
            <span style={s.cliValue}>
              {[cliente?.direccion, cliente?.ciudad].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        </div>

        {/* Concepto */}
        <div style={{ textAlign: 'center', margin: '26px 0 8px' }}>
          <div style={s.conceptoTitle}>CONCEPTO</div>
          <div style={s.conceptoText}>
            SERVICIO TRANSPORTE REALIZADO{meta?.concepto_mes ? ` EN EL MES DE ${meta.concepto_mes}` : ''}
          </div>
          {meta?.cabeza && <div style={s.conceptoText}>CABEZA TRACTORA {meta.cabeza}</div>}
        </div>

        {/* Tabla de viajes */}
        <div style={s.tableHead}>
          <div>DIA</div>
          <div>VIAJES REALIZADOS</div>
          <div style={{ textAlign: 'right' }}>KILOS</div>
          <div style={{ textAlign: 'right' }}>PRECIO</div>
          <div style={{ textAlign: 'right' }}>TOTAL</div>
        </div>
        {(viajes || []).length === 0 ? (
          <div style={{ padding: '14px 0', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Sin viajes</div>
        ) : (
          viajes.map((v, i) => (
            <div key={i} style={s.tableRow}>
              <div>{v.dia}</div>
              <div style={{ color: '#15171c' }}>{v.viaje}</div>
              <div style={{ textAlign: 'right' }}>{miles(v.kilos)}</div>
              <div style={{ textAlign: 'right' }}>{eur(v.precio)}</div>
              <div style={{ textAlign: 'right', color: '#15171c', fontWeight: 600 }}>{eur(v.total)}</div>
            </div>
          ))
        )}

        {/* Totales */}
        <div style={s.totalsWrap}>
          <div style={s.totalsGrid}>
            <div style={s.totCell}><div style={s.totLabel}>BASE IMPONIBLE</div><div style={s.totVal}>{eur(totals?.base)}</div></div>
            <div style={s.totCell}><div style={s.totLabel}>IRPF (1%)</div><div style={{ ...s.totVal, color: '#c0563a' }}>−{eur(totals?.irpf)}</div></div>
            <div style={s.totCell}><div style={s.totLabel}>IVA (21%)</div><div style={s.totVal}>{eur(totals?.iva)}</div></div>
            <div style={{ ...s.totCell, background: '#ccf2cc', borderRadius: 4 }}>
              <div style={s.totLabel}>TOTAL EUROS</div><div style={{ ...s.totVal, fontWeight: 700 }}>{eur(totals?.total)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  shell: { background: 'var(--preview-shell)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, display: 'flex', justifyContent: 'center' },
  paper: { width: '100%', maxWidth: 720, background: '#fff', color: '#15171c', borderRadius: 6, boxShadow: '0 30px 70px -30px rgba(0,0,0,0.7)', padding: '48px 48px 40px', fontFamily: "'Hanken Grotesk', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 30 },
  emisorName: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#15171c' },
  emisorBody: { fontSize: 12, lineHeight: 1.6, color: '#4b5563', marginTop: 4 },
  factRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  factLabel: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, color: '#15171c' },
  factBox: { background: '#ccf2cc', padding: '3px 12px', borderRadius: 3, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, minWidth: 56, textAlign: 'center' },
  clienteBlock: { borderTop: '1px solid #ececee', borderBottom: '1px solid #ececee', padding: '16px 0' },
  cliRow: { display: 'flex', alignItems: 'baseline', gap: 12 },
  cliLabel: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, color: '#15171c', minWidth: 70 },
  cliValue: { fontSize: 13, color: '#374151' },
  conceptoTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: '#15171c', letterSpacing: '0.06em' },
  conceptoText: { fontSize: 12, color: '#374151', marginTop: 4 },
  tableHead: { display: 'grid', gridTemplateColumns: '48px 1fr 90px 90px 100px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: '#15171c', padding: '0 0 6px', borderBottom: '1.5px solid #15171c', marginTop: 18 },
  tableRow: { display: 'grid', gridTemplateColumns: '48px 1fr 90px 90px 100px', padding: '8px 0', fontSize: 12, color: '#4b5563', borderBottom: '1px solid #f1f2f4', fontVariantNumeric: 'tabular-nums' },
  totalsWrap: { display: 'flex', justifyContent: 'flex-end', marginTop: 26 },
  totalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: 460, textAlign: 'center' },
  totCell: { padding: '8px 6px' },
  totLabel: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: '#15171c', letterSpacing: '0.03em' },
  totVal: { fontSize: 13, color: '#15171c', marginTop: 5, fontVariantNumeric: 'tabular-nums' },
}
