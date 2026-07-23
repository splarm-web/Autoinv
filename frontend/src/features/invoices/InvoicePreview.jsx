/**
 * InvoicePreview — Vista previa de factura en React.
 *
 * Recibe InvoiceData normalizado (mismo contrato que invoicing/base.py).
 * Diseño placeholder inspirado en el prototipo. El renderer a PDF
 * (WeasyPrint) se implementará en el siguiente paso con el mismo contrato.
 *
 * Props:
 *   issuer   { legal_name, nif, address, email? }
 *   client   { name, tax_id, address }
 *   invoice  { number, date, due_date, payment_method }
 *   lines    [{ description, quantity, unit_price, vat_rate, line_total }]
 *   totals   { subtotal, vat_total, irpf_total, total, irpf_rate, vat_rate }
 */

import { eur2, fmtDate } from '../../lib/format'

export default function InvoicePreview({ issuer, client, invoice, lines, totals }) {
  const initials = (issuer?.legal_name || 'A').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={s.shell}>
      <div style={s.paper}>
        {/* Cabecera */}
        <div style={s.header}>
          <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            <div style={s.monogram}>{initials}</div>
            <div>
              <div style={s.issuerName}>{issuer?.legal_name || '—'}</div>
              <div style={s.issuerSub}>{issuer?.profession || 'Autónomo/a'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={s.facturaTxt}>Factura</div>
            <div style={s.facturaNum}>Nº {invoice?.number || '0000-000'}</div>
          </div>
        </div>

        {/* Meta */}
        <div style={s.metaGrid}>
          <MetaCell label="Emisión"       value={fmtDate(invoice?.date)} />
          <MetaCell label="Vencimiento"   value={invoice?.due_date ? fmtDate(invoice.due_date) : '30 días'} />
          <MetaCell label="Forma de pago" value={invoice?.payment_method || 'Transferencia · 30 días'} />
        </div>

        {/* De / Para */}
        <div style={s.partyGrid}>
          <div>
            <div style={s.partyLabel}>De</div>
            <div style={s.partyName}>{issuer?.legal_name || '—'}</div>
            <div style={s.partyBody}>
              {issuer?.nif && <>{issuer.nif}<br /></>}
              {issuer?.address?.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
            </div>
          </div>
          <div>
            <div style={s.partyLabel}>Para</div>
            <div style={s.partyName}>{client?.name || '—'}</div>
            <div style={s.partyBody}>
              {client?.tax_id && <>{client.tax_id}<br /></>}
              {client?.address?.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
            </div>
          </div>
        </div>

        {/* Líneas */}
        <div style={s.tableHead}>
          <div>Concepto</div>
          <div style={{ textAlign: 'right' }}>Cant.</div>
          <div style={{ textAlign: 'right' }}>Precio</div>
          <div style={{ textAlign: 'right' }}>Importe</div>
        </div>

        {(lines || []).map((line, i) => (
          <div key={i} style={s.tableRow}>
            <div style={{ fontSize: 14, color: '#15171c', fontWeight: 500 }}>{line.description}</div>
            <div style={{ textAlign: 'right', fontSize: 14, color: '#6b7280', fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>{line.quantity}</div>
            <div style={{ textAlign: 'right', fontSize: 14, color: '#6b7280', fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>{eur2(line.unit_price)}</div>
            <div style={{ textAlign: 'right', fontSize: 14, color: '#15171c', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>{eur2(line.line_total)}</div>
          </div>
        ))}

        {/* Totales */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
          <div style={{ width: 300 }}>
            <TotalRow label="Base imponible"    value={eur2(totals?.subtotal)}   />
            <TotalRow label={`IVA (${totals?.vat_rate ?? 21}%)`} value={eur2(totals?.vat_total)} />
            <TotalRow
              label={`Retención IRPF (${totals?.irpf_rate ?? 15}%)`}
              value={`−${eur2(totals?.irpf_total)}`}
              valueStyle={{ color: '#c0563a' }}
              last
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#15171c' }}>Total a percibir</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0f9b6b', fontVariantNumeric: 'tabular-nums' }}>
                {eur2(totals?.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <div>
            <div style={s.footerLabel}>Pago por transferencia</div>
            <div style={{ fontSize: 13, color: '#15171c' }}>Indica tu IBAN en ajustes</div>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', maxWidth: 260, textAlign: 'right', lineHeight: 1.5 }}>
            Operación sujeta a retención de IRPF según art. 95 RIRPF. Gracias por tu confianza.
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#15171c', fontVariantNumeric: 'tabular-nums' }}>{value || '—'}</div>
    </div>
  )
}

function TotalRow({ label, value, valueStyle, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, ...(last ? { borderBottom: '1px solid #e6e7ea' } : {}) }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#15171c', fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif", ...valueStyle }}>{value}</span>
    </div>
  )
}

const s = {
  shell: {
    background: 'var(--preview-shell)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 40,
    display: 'flex',
    justifyContent: 'center',
  },
  paper: {
    width: '100%',
    maxWidth: 720,
    background: '#ffffff',
    color: '#15171c',
    borderRadius: 6,
    boxShadow: '0 30px 70px -30px rgba(0,0,0,0.7)',
    padding: '56px 56px 44px',
    fontFamily: "'Hanken Grotesk', sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
    marginBottom: 48,
  },
  monogram: {
    width: 42,
    height: 42,
    borderRadius: 11,
    background: '#0f9b6b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    flexShrink: 0,
  },
  issuerName: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em', color: '#15171c' },
  issuerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  facturaTxt: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1, color: '#15171c' },
  facturaNum: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: '#6b7280', marginTop: 6, fontVariantNumeric: 'tabular-nums' },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 18,
    padding: '18px 0',
    borderTop: '1px solid #ececee',
    borderBottom: '1px solid #ececee',
    marginBottom: 34,
  },
  partyGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 36,
    marginBottom: 40,
  },
  partyLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 9 },
  partyName: { fontSize: 14, fontWeight: 600, color: '#15171c', marginBottom: 3 },
  partyBody: { fontSize: 13, lineHeight: 1.6, color: '#6b7280' },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 56px 96px 104px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#9ca3af',
    paddingBottom: 11,
    borderBottom: '1px solid #e6e7ea',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 56px 96px 104px',
    padding: '15px 0',
    borderBottom: '1px solid #f1f2f4',
    alignItems: 'center',
  },
  footer: {
    marginTop: 44,
    paddingTop: 22,
    borderTop: '1px solid #ececee',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  footerLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 5 },
}
