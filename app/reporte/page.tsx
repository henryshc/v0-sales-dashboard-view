'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Printer, DollarSign, CreditCard, Package, Wifi, Zap,
  Smartphone, Trophy, Target, Calendar
} from 'lucide-react'

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxufMWqOv5-cv_DUe4HThGywEMg1CwoJk7a0TH9zZwt44ViJaC3xOHYyd09BFNUQU7B/exec'

const DEFAULT_WEIGHTS = { sales: 0.45, credits: 0.2, accessories: 0.2, chips: 0.15, epin: 0.0 }
const METRIC_KEYS = ['sales', 'credits', 'accessories', 'chips', 'epin'] as const

const getPercent = (a: number, t: number) => (t > 0 ? (a / t) * 100 : 0)

const getEffectiveWeights = (s: any) => {
  const configured = { ...DEFAULT_WEIGHTS, ...(s.weights || {}) }
  const total = METRIC_KEYS.reduce((sum, k) => sum + (configured[k] || 0), 0)
  const base: any = { sales: 0, credits: 0, accessories: 0, chips: 0, epin: 0 }
  if (total > 0) {
    METRIC_KEYS.forEach(k => { base[k] = (configured[k] || 0) / total })
  } else {
    METRIC_KEYS.forEach(k => { base[k] = 1 / METRIC_KEYS.length })
  }
  let dead = 0, alive = 0
  METRIC_KEYS.forEach(k => {
    const t = s.metrics?.[k]?.target ?? 0
    if (t <= 0) { dead += base[k]; base[k] = 0 } else { alive += base[k] }
  })
  if (dead > 0 && alive > 0) {
    const scale = (alive + dead) / alive
    METRIC_KEYS.forEach(k => { if (base[k] > 0) base[k] *= scale })
  }
  return base
}

const LEAD_DEFS = [
  { key: 'credito', label: 'Interes en Credito' },
  { key: 'home', label: 'Interes en Home' },
  { key: 'pospago', label: 'Interes en Pospago' },
] as const

const calcLeadsScore = (s: any) => {
  const leads = s.leads
  if (!leads) return 0
  const active = LEAD_DEFS.filter(d => (leads[d.key]?.target || 0) > 0)
  if (active.length === 0) return 0
  const sum = active.reduce((acc, d) => acc + getPercent(leads[d.key].achieved || 0, leads[d.key].target || 0), 0)
  return sum / active.length
}

const calcScore = (s: any) => {
  // Vendedor transaccional: KPI son los leads, las metas de venta son simbolicas.
  if (s.sellerType === 'tigomoney') return calcLeadsScore(s)
  const w = getEffectiveWeights(s)
  return (
    getPercent(s.metrics?.sales?.achieved || 0, s.metrics?.sales?.target || 0) * (w.sales || 0) +
    getPercent(s.metrics?.credits?.achieved || 0, s.metrics?.credits?.target || 0) * (w.credits || 0) +
    getPercent(s.metrics?.accessories?.achieved || 0, s.metrics?.accessories?.target || 0) * (w.accessories || 0) +
    getPercent(s.metrics?.chips?.achieved || 0, s.metrics?.chips?.target || 0) * (w.chips || 0) +
    getPercent(s.metrics?.epin?.achieved || 0, s.metrics?.epin?.target || 0) * (w.epin || 0)
  )
}

// Tasa de conversion a credito = creditos hechos / celulares elegibles a credito
const getConversion = (s: any) => {
  const eligible = s.celularesCredito || 0
  const done = s.metrics?.credits?.achieved || 0
  const pct = eligible > 0 ? (done / eligible) * 100 : 0
  return { eligible, done, pct }
}

const scoreColor = (p: number) => (p >= 100 ? '#059669' : p >= 80 ? '#ea580c' : '#dc2626')

const METRIC_DEFS = [
  { key: 'sales', label: 'Ventas', icon: DollarSign, money: true },
  { key: 'credits', label: 'Creditos', icon: CreditCard, money: false },
  { key: 'accessories', label: 'Accesorios', icon: Package, money: false },
  { key: 'chips', label: 'Chips', icon: Wifi, money: false },
  { key: 'epin', label: 'EPIN', icon: Zap, money: true },
] as const

const fmtMoney = (v: number) => `L. ${v.toLocaleString('es-HN')}`
const fmtNum = (v: number) => v.toLocaleString('es-HN')

export default function ReportePage() {
  const [history, setHistory] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/data', { cache: 'no-store' })
        const data = await res.json()
        if (data.history) {
          setHistory(data.history)
          const months = Object.keys(data.history).sort()
          if (months.length > 0) setSelectedMonth(months[months.length - 1])
        }
      } catch (e) {
        console.error('Error cargando datos:', e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const months = useMemo(() => Object.keys(history).sort().reverse(), [history])
  const currentData = history[selectedMonth]
  const allSellers = currentData?.sellers || []
  const sellers = useMemo(
    () => allSellers
      .filter((s: any) => (s.status || 'active') === 'active')
      .map((s: any) => ({ ...s, score: calcScore(s) }))
      .sort((a: any, b: any) => b.score - a.score),
    [allSellers]
  )

  const commissions = currentData?.commissions || { tigo: 0, krediya: 0, ola: 0 }
  const totalCommissions = (commissions.tigo || 0) + (commissions.krediya || 0) + (commissions.ola || 0)

  const globalTotals = useMemo(() => {
    const t: any = {
      sales: { a: 0, t: 0 }, credits: { a: 0, t: 0 }, accessories: { a: 0, t: 0 },
      chips: { a: 0, t: 0 }, epin: { a: 0, t: 0 }, phones: 0, score: 0,
    }
    sellers.forEach((s: any) => {
      METRIC_KEYS.forEach(k => {
        t[k].a += s.metrics?.[k]?.achieved || 0
        t[k].t += s.metrics?.[k]?.target || 0
      })
      t.phones += s.celulares || 0
      t.score += s.score
    })
    t.avgScore = sellers.length > 0 ? t.score / sellers.length : 0
    return t
  }, [sellers])

  const dateTitle = selectedMonth
    ? new Date(selectedMonth + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
    : ''

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-200">
      {/* Print styles */}
      <style>{`
        @page { size: letter portrait; margin: 0; }
        @media print {
          @page { size: letter portrait; margin: 0; }
          .print-sheet { break-inside: avoid; page-break-inside: avoid; }
          .report-section { break-inside: avoid; page-break-inside: avoid; }
          table, tr, .metric-card, .insight-card { break-inside: avoid; page-break-inside: avoid; }

          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .print-sheet:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {/* Toolbar - hidden on print */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <h1 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-orange-500" /> Reporte para Impresion
              </h1>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Tamano carta · 1 hoja por vendedor + resumen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 outline-none focus:border-orange-500"
            >
              {months.map(m => (
                <option key={m} value={m}>
                  {new Date(m + '-02').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase()}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-black uppercase text-xs tracking-widest bg-orange-500 text-white hover:bg-orange-600 transition-all shadow"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Sheets */}
      <div className="py-8 flex flex-col items-center gap-8">
        <ExecutiveSummarySheet sellers={sellers} totals={globalTotals} monthTitle={dateTitle} />
        <TeamAnalysisSheet sellers={sellers} monthTitle={dateTitle} />
        {sellers.map((seller: any, idx: number) => (
          <SellerSheet
            key={seller.id}
            seller={seller}
            rank={idx + 1}
            total={sellers.length}
            monthTitle={dateTitle}
          />
        ))}

        <GlobalSummarySheet
          sellers={sellers}
          totals={globalTotals}
          commissions={commissions}
          totalCommissions={totalCommissions}
          monthTitle={dateTitle}
        />
      </div>
    </div>
  )
}

function ReportFooter() {
  return <div className="mt-auto pt-5 border-t border-slate-200 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-slate-400"><span>DIGIMAX | Reporte Comercial</span><span>Página</span></div>
}

function ExecutiveSummarySheet({ sellers, totals, monthTitle }: { sellers: any[]; totals: any; monthTitle: string }) {
  const rows = METRIC_DEFS.map(def => ({ ...def, data: totals[def.key], pct: getPercent(totals[def.key]?.a || 0, totals[def.key]?.t || 0) })).filter(x => x.data?.t || x.data?.a).sort((a, b) => b.pct - a.pct)
  const totalCredits = totals.credits?.a || 0
  const eligible = sellers.reduce((sum, s) => sum + (s.celularesCredito || 0), 0)
  const fmt = (def: any, v: number) => def.money ? fmtMoney(v) : fmtNum(v)
  return <div className="print-sheet bg-white shadow-xl flex flex-col" style={{ width: '8.5in', minHeight: '11in', padding: '0.62in' }}>
    <SheetHeader title="REPORTE COMERCIAL" subtitle="Resultados, desviaciones y prioridades comerciales" monthTitle={monthTitle} />
    <div className="mb-6"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600 mb-1">Resumen ejecutivo</p><p className="text-3xl font-black text-slate-900">Cómo cerró el equipo</p></div>
    <div className="grid grid-cols-5 gap-2 mb-7">
      {[
        ['Cumplimiento promedio', `${totals.avgScore.toFixed(1)}%`], ['Vendedores activos', sellers.length], ['Celulares vendidos', totals.phones], ['Ventas totales', fmtMoney(totals.sales?.a || 0)], ['Créditos realizados', totalCredits]
      ].map(([label, value]) => <div key={String(label)} className="metric-card border border-slate-200 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-lg font-black text-slate-900 mt-2">{value}</p></div>)}
    </div>
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Indicadores colectivos</h3>
    <table className="w-full border-collapse mb-7"><thead><tr className="bg-slate-900 text-white text-[10px] uppercase"><th className="text-left px-3 py-2">Indicador</th><th className="text-right px-3 py-2">Meta</th><th className="text-right px-3 py-2">Resultado</th><th className="text-right px-3 py-2">Cumplimiento</th><th className="text-right px-3 py-2">Brecha</th></tr></thead><tbody>{rows.map(r => <tr key={r.key} className="border-b border-slate-200 text-sm"><td className="px-3 py-3 font-bold text-slate-700">{r.label}</td><td className="px-3 py-3 text-right text-slate-500">{fmt(r, r.data.t)}</td><td className="px-3 py-3 text-right font-black">{fmt(r, r.data.a)}</td><td className="px-3 py-3 text-right font-black" style={{ color: scoreColor(r.pct) }}>{r.pct.toFixed(1)}%</td><td className="px-3 py-3 text-right font-bold text-red-600">-{fmt(r, Math.max(0, r.data.t - r.data.a))}</td></tr>)}</tbody></table>
    <div className="grid grid-cols-4 gap-3 mb-6">{[['FORTALEZA', rows[0] ? `${rows[0].label} lidera con ${rows[0].pct.toFixed(1)}%.` : 'Sin datos'], ['PRINCIPAL BRECHA', rows.at(-1) ? `${rows.at(-1).label} concentra la mayor desviación.` : 'Sin datos'], ['CRÉDITOS', `${totalCredits} créditos realizados.`], ['UNIDADES', `${totals.phones} celulares vendidos.`]].map(([title, text]) => <div key={title} className="insight-card bg-slate-50 border-l-4 border-orange-500 p-3"><p className="text-[9px] font-black tracking-widest text-orange-600">{title}</p><p className="text-xs font-semibold leading-relaxed text-slate-600 mt-2">{text}</p></div>)}</div>
    <div className="mt-auto"><p className="text-xs text-slate-500">Penetración de crédito: <strong>{eligible ? ((totalCredits / eligible) * 100).toFixed(1) : '0.0'}%</strong> sobre celulares elegibles.</p><ReportFooter /></div>
  </div>
}

function TeamAnalysisSheet({ sellers, monthTitle }: { sellers: any[]; monthTitle: string }) {
  const cells = (s: any) => METRIC_KEYS.map(k => getPercent(s.metrics?.[k]?.achieved || 0, s.metrics?.[k]?.target || 0))
  return <div className="print-sheet bg-white shadow-xl" style={{ width: '8.5in', minHeight: '11in', padding: '0.62in' }}>
    <SheetHeader title="Desempeño comparativo del equipo" subtitle="Ranking, brechas y señales de intervención" monthTitle={monthTitle} />
    <table className="w-full border-collapse mb-7"><thead><tr className="bg-slate-900 text-white text-[10px] uppercase"><th className="text-left px-3 py-2"># Vendedor</th><th className="text-right px-3 py-2">Ventas</th><th className="text-right px-3 py-2">Celulares</th><th className="text-right px-3 py-2">Créditos</th><th className="text-right px-3 py-2">KPI</th></tr></thead><tbody>{sellers.map((s, i) => <tr key={s.id} className="border-b border-slate-200"><td className="px-3 py-3 font-bold text-slate-700">{i + 1}. {s.name}</td><td className="px-3 py-3 text-right font-semibold">{fmtMoney(s.metrics?.sales?.achieved || 0)}</td><td className="px-3 py-3 text-right">{s.celulares || 0}</td><td className="px-3 py-3 text-right">{s.metrics?.credits?.achieved || 0}</td><td className="px-3 py-3 text-right font-black" style={{ color: scoreColor(s.score) }}>{s.score.toFixed(1)}%</td></tr>)}</tbody></table>
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Heatmap de cumplimiento</h3>
    <table className="w-full border-collapse mb-7"><thead><tr className="bg-slate-100 text-[9px] uppercase text-slate-500"><th className="text-left px-2 py-2">Vendedor</th>{METRIC_DEFS.map(d => <th key={d.key} className="text-right px-2 py-2">{d.label}</th>)}<th className="text-right px-2 py-2">KPI</th></tr></thead><tbody>{sellers.map(s => <tr key={s.id} className="border-b border-slate-200"><td className="px-2 py-2 text-xs font-bold">{s.name}</td>{cells(s).map((p, i) => <td key={i} className="px-2 py-2 text-right text-[11px] font-black" style={{ background: `${scoreColor(p)}18`, color: scoreColor(p) }}>{p.toFixed(1)}%</td>)}<td className="px-2 py-2 text-right text-[11px] font-black" style={{ color: scoreColor(s.score) }}>{s.score.toFixed(1)}%</td></tr>)}</tbody></table>
    <div className="grid grid-cols-3 gap-3"><div className="metric-card border border-slate-200 p-4"><p className="text-[9px] uppercase font-bold text-slate-400">Venta promedio / celular</p><p className="text-xl font-black mt-2">{fmtMoney((sellers.reduce((a, s) => a + (s.metrics?.sales?.achieved || 0), 0) / Math.max(1, sellers.reduce((a, s) => a + (s.celulares || 0), 0))))}</p></div><div className="metric-card border border-slate-200 p-4"><p className="text-[9px] uppercase font-bold text-slate-400">Accesorios / celular</p><p className="text-xl font-black mt-2">{(sellers.reduce((a, s) => a + (s.metrics?.accessories?.achieved || 0), 0) / Math.max(1, sellers.reduce((a, s) => a + (s.celulares || 0), 0))).toFixed(2)}</p></div><div className="metric-card border border-slate-200 p-4"><p className="text-[9px] uppercase font-bold text-slate-400">Metodología KPI</p><p className="text-xs text-slate-500 mt-2 leading-relaxed">La ponderación deberá definirse según la metodología oficial de DIGIMAX.</p></div></div>
    <ReportFooter />
  </div>
}

function SheetHeader({ title, subtitle, monthTitle }: { title: string; subtitle?: string; monthTitle: string }) {
  return (
    <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded bg-orange-500 flex items-center justify-center">
            <span className="text-white font-black text-sm">D</span>
          </div>
          <span className="text-lg font-black text-slate-800 tracking-tight">DIGIMAX</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-sm font-semibold text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1.5 justify-end text-slate-500">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wider">{monthTitle}</span>
        </div>
        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">
          Reporte de Metas y Resultados
        </p>
      </div>
    </div>
  )
}

function SellerSheet({ seller, rank, total, monthTitle }: {
  seller: any; rank: number; total: number; monthTitle: string
}) {
  const score = seller.score
  const color = scoreColor(score)

  return (
    <div
      className="print-sheet bg-white shadow-xl relative"
      style={{ width: '8.5in', minHeight: '11in', padding: '0.6in' }}
    >
      <SheetHeader
        title={seller.name}
        subtitle={seller.sellerType === 'tigomoney' ? 'Asesor TigoMoney' : 'Asesor de Ventas'}
        monthTitle={monthTitle}
      />

      {/* Score + ranking banner */}
      <div className="flex items-stretch gap-4 mb-6">
        <div
          className="flex-1 rounded-xl p-5 flex flex-col items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">Cumplimiento KPI</p>
          <p className="text-5xl font-black leading-none mt-1">{score.toFixed(1)}%</p>
        </div>
        <div className="flex-1 rounded-xl border-2 border-slate-200 p-5 flex flex-col items-center justify-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Posicion en Ranking</p>
          <p className="text-5xl font-black leading-none mt-1 text-slate-800">
            {rank}<span className="text-2xl text-slate-400">/{total}</span>
          </p>
        </div>
        <div className="flex-1 rounded-xl border-2 border-slate-200 p-5 flex flex-col items-center justify-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Celulares Vendidos</p>
          <div className="flex items-center gap-2 mt-1">
            <Smartphone className="w-7 h-7 text-slate-600" />
            <p className="text-5xl font-black leading-none text-slate-800">{seller.celulares || 0}</p>
          </div>
          {seller.celularesCredito ? (
            <p className="text-[10px] font-semibold text-blue-500 mt-1">{seller.celularesCredito} a credito</p>
          ) : null}
        </div>
      </div>

      {/* Metrics table */}
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Target className="w-4 h-4" /> Detalle de Metas y Resultados
      </h3>
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
            <th className="text-left font-bold px-3 py-2.5">Indicador</th>
            <th className="text-right font-bold px-3 py-2.5">Meta</th>
            <th className="text-right font-bold px-3 py-2.5">Resultado</th>
            <th className="text-right font-bold px-3 py-2.5">Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_DEFS.map(def => {
            const m = seller.metrics?.[def.key] || { achieved: 0, target: 0 }
            if (!m.target && !m.achieved) return null
            const p = getPercent(m.achieved, m.target)
            const fmt = def.money ? fmtMoney : fmtNum
            const c = scoreColor(p)
            return (
              <tr key={def.key} className="border-b border-slate-200">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <def.icon className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-700 text-sm">{def.label}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-semibold text-slate-500 text-sm">{fmt(m.target)}</td>
                <td className="px-3 py-3 text-right font-black text-slate-900 text-sm">{fmt(m.achieved)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-black text-sm" style={{ color: c }}>{p.toFixed(1)}%</span>
                    <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: c }} />
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Credit breakdown */}
      {seller.creditBreakdown && (
        <div className="mb-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Desglose de Creditos</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'OLA', val: seller.creditBreakdown.ola || 0 },
              { label: 'KREDIYA', val: seller.creditBreakdown.krediya || 0 },
              { label: 'OI', val: seller.creditBreakdown.oi || 0 },
            ].map(c => (
              <div key={c.label} className="border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</p>
                <p className="text-2xl font-black text-slate-800">{c.val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leads (vendedor transaccional / TigoMoney) */}
      {seller.sellerType === 'tigomoney' && seller.leads && (
        <div className="mb-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" /> Personas Generadas con Interes
          </h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-purple-600 text-white text-[11px] uppercase tracking-wider">
                <th className="text-left font-bold px-3 py-2.5">Tipo de Interes</th>
                <th className="text-right font-bold px-3 py-2.5">Meta</th>
                <th className="text-right font-bold px-3 py-2.5">Generadas</th>
                <th className="text-right font-bold px-3 py-2.5">Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {LEAD_DEFS.map(def => {
                const m = seller.leads[def.key] || { achieved: 0, target: 0 }
                const p = getPercent(m.achieved, m.target)
                const c = scoreColor(p)
                return (
                  <tr key={def.key} className="border-b border-slate-200">
                    <td className="px-3 py-3 font-bold text-slate-700 text-sm">{def.label}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-500 text-sm">{fmtNum(m.target)}</td>
                    <td className="px-3 py-3 text-right font-black text-slate-900 text-sm">{fmtNum(m.achieved)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-black text-sm" style={{ color: c }}>{p.toFixed(1)}%</span>
                        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: c }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-400 italic mt-2">
            Rol transaccional: las metas de venta son simbolicas y no afectan el KPI. El indicador principal son las personas generadas con interes.
          </p>
        </div>
      )}

      {/* Conversion a credito */}
      {(seller.celularesCredito || 0) > 0 && (() => {
        const conv = getConversion(seller)
        const c = conv.pct >= 70 ? '#059669' : '#ea580c'
        return (
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Tasa de Conversion a Credito
            </h3>
            <div className="border-2 rounded-xl p-4 flex items-center gap-6" style={{ borderColor: c }}>
              <div className="text-center">
                <p className="text-5xl font-black leading-none" style={{ color: c }}>{conv.pct.toFixed(0)}%</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Conversion</p>
              </div>
              <div className="flex-1">
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(conv.pct, 100)}%`, backgroundColor: c }} />
                </div>
                <p className="text-sm text-slate-600">
                  Realizo <span className="font-black text-slate-900">{conv.done}</span> creditos de{' '}
                  <span className="font-black text-blue-600">{conv.eligible}</span> celulares elegibles a credito.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Signature */}
      <div className="absolute" style={{ bottom: '0.6in', left: '0.6in', right: '0.6in' }}>
        <div className="flex justify-between gap-12 pt-4">
          <div className="flex-1 border-t-2 border-slate-300 pt-2 text-center">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Firma del Asesor</p>
          </div>
          <div className="flex-1 border-t-2 border-slate-300 pt-2 text-center">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Firma de Gerencia</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function GlobalSummarySheet({ sellers, totals, commissions, totalCommissions, monthTitle }: {
  sellers: any[]; totals: any; commissions: any; totalCommissions: number; monthTitle: string
}) {
  return (
    <div
      className="print-sheet bg-white shadow-xl"
      style={{ width: '8.5in', minHeight: '11in', padding: '0.6in' }}
    >
      <SheetHeader title="Resumen Global de Metas" subtitle="Consolidado del equipo (vendedores activos)" monthTitle={monthTitle} />

      {/* Global KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4 text-white flex flex-col items-center justify-center" style={{ backgroundColor: scoreColor(totals.avgScore) }}>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Promedio KPI</p>
          <p className="text-4xl font-black leading-none mt-1">{totals.avgScore.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border-2 border-slate-200 p-4 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vendedores Activos</p>
          <p className="text-4xl font-black leading-none mt-1 text-slate-800">{sellers.length}</p>
        </div>
        <div className="rounded-xl border-2 border-slate-200 p-4 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Celulares Totales</p>
          <p className="text-4xl font-black leading-none mt-1 text-slate-800">{totals.phones}</p>
        </div>
      </div>

      {/* Global metrics table */}
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Target className="w-4 h-4" /> Metas del Equipo
      </h3>
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
            <th className="text-left font-bold px-3 py-2.5">Indicador</th>
            <th className="text-right font-bold px-3 py-2.5">Meta Total</th>
            <th className="text-right font-bold px-3 py-2.5">Logrado</th>
            <th className="text-right font-bold px-3 py-2.5">Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_DEFS.map(def => {
            const data = totals[def.key]
            if (!data || (!data.t && !data.a)) return null
            const p = getPercent(data.a, data.t)
            const fmt = def.money ? fmtMoney : fmtNum
            const c = scoreColor(p)
            return (
              <tr key={def.key} className="border-b border-slate-200">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <def.icon className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-700 text-sm">{def.label}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-semibold text-slate-500 text-sm">{fmt(data.t)}</td>
                <td className="px-3 py-3 text-right font-black text-slate-900 text-sm">{fmt(data.a)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-black text-sm" style={{ color: c }}>{p.toFixed(1)}%</span>
                    <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: c }} />
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Commissions */}
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Comisiones</h3>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="border border-slate-200 rounded-lg p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TIGO</p>
          <p className="text-lg font-black text-blue-600">{fmtMoney(commissions.tigo || 0)}</p>
        </div>
        <div className="border border-slate-200 rounded-lg p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">KREDIYA</p>
          <p className="text-lg font-black text-emerald-600">{fmtMoney(commissions.krediya || 0)}</p>
        </div>
        <div className="border border-slate-200 rounded-lg p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OLA</p>
          <p className="text-lg font-black text-purple-600">{fmtMoney(commissions.ola || 0)}</p>
        </div>
        <div className="border-2 border-slate-800 rounded-lg p-3 text-center bg-slate-50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TOTAL</p>
          <p className="text-lg font-black text-slate-900">{fmtMoney(totalCommissions)}</p>
        </div>
      </div>

      {/* Conversion a credito global */}
      {(() => {
        const eligible = sellers.reduce((acc, s) => acc + (s.celularesCredito || 0), 0)
        const done = sellers.reduce((acc, s) => acc + (s.metrics?.credits?.achieved || 0), 0)
        if (eligible <= 0) return null
        const pct = (done / eligible) * 100
        const c = pct >= 70 ? '#059669' : '#ea580c'
        return (
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Conversion a Credito del Equipo
            </h3>
            <div className="border-2 rounded-xl p-4 flex items-center gap-6" style={{ borderColor: c }}>
              <div className="text-center">
                <p className="text-4xl font-black leading-none" style={{ color: c }}>{pct.toFixed(0)}%</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Conversion</p>
              </div>
              <div className="flex-1">
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: c }} />
                </div>
                <p className="text-sm text-slate-600">
                  El equipo realizo <span className="font-black text-slate-900">{done}</span> creditos de{' '}
                  <span className="font-black text-blue-600">{eligible}</span> celulares elegibles a credito.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Ranking table */}
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4" /> Ranking del Equipo
      </h3>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase tracking-wider">
            <th className="text-left font-bold px-3 py-2">#</th>
            <th className="text-left font-bold px-3 py-2">Vendedor</th>
            <th className="text-right font-bold px-3 py-2">Ventas</th>
            <th className="text-right font-bold px-3 py-2">Celulares</th>
            <th className="text-right font-bold px-3 py-2">KPI</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((s, i) => (
            <tr key={s.id} className="border-b border-slate-200">
              <td className="px-3 py-2 font-black text-slate-400">{i + 1}</td>
              <td className="px-3 py-2 font-bold text-slate-700 text-sm">
                {s.name}
                {s.sellerType === 'tigomoney' && <span className="ml-1 text-[9px] bg-purple-100 text-purple-600 px-1 rounded">TM</span>}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-slate-600 text-sm">{fmtMoney(s.metrics?.sales?.achieved || 0)}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-600 text-sm">{s.celulares || 0}</td>
              <td className="px-3 py-2 text-right">
                <span className="font-black text-sm" style={{ color: scoreColor(s.score) }}>{s.score.toFixed(1)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
