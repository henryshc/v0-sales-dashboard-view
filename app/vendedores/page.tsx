'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Users, TrendingUp, TrendingDown,
  ChevronDown, DollarSign, CreditCard, Package, Wifi, Smartphone, Trophy, Award, Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxufMWqOv5-cv_DUe4HThGywEMg1CwoJk7a0TH9zZwt44ViJaC3xOHYyd09BFNUQU7B/exec'

const DEFAULT_WEIGHTS = { sales: 0.45, credits: 0.2, accessories: 0.2, chips: 0.15, epin: 0.0 }

const calcScore = (s: any) => {
  const w = s.weights || DEFAULT_WEIGHTS
  const p = (a: number, t: number) => (t > 0 ? (a / t) * 100 : 0)
  return (
    p(s.metrics?.sales?.achieved || 0, s.metrics?.sales?.target || 0) * (w.sales || 0) +
    p(s.metrics?.credits?.achieved || 0, s.metrics?.credits?.target || 0) * (w.credits || 0) +
    p(s.metrics?.accessories?.achieved || 0, s.metrics?.accessories?.target || 0) * (w.accessories || 0) +
    p(s.metrics?.chips?.achieved || 0, s.metrics?.chips?.target || 0) * (w.chips || 0) +
    p(s.metrics?.epin?.achieved || 0, s.metrics?.epin?.target || 0) * (w.epin || 0)
  )
}

const pct = (a: number, t: number) => (t > 0 ? (a / t) * 100 : 0)

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const p = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  )
}

export default function VendedoresPage() {
  const [history, setHistory] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [expandedSeller, setExpandedSeller] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL)
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

  const months = useMemo(() => Object.keys(history).sort(), [history])
  const currentData = history[selectedMonth]
  const sellers = currentData?.sellers || []

  const rankedSellers = useMemo(() => {
    return [...sellers]
      .map((s: any) => ({ ...s, score: calcScore(s) }))
      .sort((a: any, b: any) => b.score - a.score)
  }, [sellers])

  const bestByCategory = useMemo(() => {
    if (sellers.length === 0) return null
    const categories = [
      { key: 'sales', label: 'Ventas', icon: <DollarSign className="w-4 h-4" />, color: 'text-emerald-600' },
      { key: 'credits', label: 'Creditos', icon: <CreditCard className="w-4 h-4" />, color: 'text-blue-600' },
      { key: 'accessories', label: 'Accesorios', icon: <Package className="w-4 h-4" />, color: 'text-amber-600' },
      { key: 'chips', label: 'Chips', icon: <Wifi className="w-4 h-4" />, color: 'text-cyan-600' },
      { key: 'epin', label: 'EPIN', icon: <Zap className="w-4 h-4" />, color: 'text-purple-600' },
    ]
    const results = categories.map(cat => {
      let best: any = null
      let bestPct = -1
      for (const s of sellers) {
        const a = s.metrics?.[cat.key]?.achieved || 0
        const t = s.metrics?.[cat.key]?.target || 0
        const p = t > 0 ? (a / t) * 100 : 0
        if (p > bestPct) { bestPct = p; best = s }
      }
      return { ...cat, seller: best?.name || '-', pct: bestPct }
    })

    // Mejor rendimiento global
    let bestOverall: any = null
    let bestScore = -1
    for (const s of sellers) {
      const sc = calcScore(s)
      if (sc > bestScore) { bestScore = sc; bestOverall = s }
    }
    results.push({
      key: 'global',
      label: 'Rendimiento Global',
      icon: <Trophy className="w-4 h-4" />,
      color: 'text-indigo-600',
      seller: bestOverall?.name || '-',
      pct: bestScore
    })

    return results
  }, [sellers])

  // Datos historicos por vendedor
  const sellerHistory = useMemo(() => {
    const map: Record<string, { month: string; sales: number; score: number }[]> = {}
    for (const m of months) {
      const data = history[m]
      if (!data?.sellers) continue
      for (const s of data.sellers) {
        if (!map[s.name]) map[s.name] = []
        map[s.name].push({
          month: m,
          sales: s.metrics?.sales?.achieved || 0,
          score: calcScore(s)
        })
      }
    }
    return map
  }, [history, months])

  const dateTitle = selectedMonth
    ? new Date(selectedMonth + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : ''

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-indigo-500 mx-auto mb-4" />
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Cargando vendedores</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <h1 className="text-sm font-bold font-heading text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Metricas de Vendedores
              </h1>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{dateTitle}</p>
            </div>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            {months.map(m => (
              <option key={m} value={m}>
                {new Date(m + '-02').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* Mejor por categoria */}
        {bestByCategory && bestByCategory.length > 0 && (
          <div>
            <h2 className="text-xs font-black font-heading text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" /> Mejores por Categoria
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {bestByCategory.map(cat => (
                <Card key={cat.key} className={`shadow-sm border-t-2 ${cat.key === 'global' ? 'border-t-indigo-500 bg-indigo-50/50' : 'border-t-slate-200'}`}>
                  <CardContent className="p-3">
                    <div className={`flex items-center gap-1.5 mb-1 ${cat.color}`}>
                      {cat.icon}
                      <span className="text-[10px] font-bold uppercase tracking-wider">{cat.label}</span>
                    </div>
                    <p className="font-black text-slate-800 text-sm truncate">{cat.seller}</p>
                    <p className={`text-xs font-bold ${cat.pct >= 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {cat.pct.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Ranking general */}
        <div>
          <h2 className="text-xs font-black font-heading text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Ranking General
          </h2>
          <div className="space-y-2">
            {rankedSellers.map((s: any, i: number) => {
              const medal = i === 0 ? 'bg-amber-100 border-amber-300 text-amber-700' :
                i === 1 ? 'bg-slate-100 border-slate-300 text-slate-600' :
                  i === 2 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                    'bg-white border-slate-200 text-slate-500'
              const isExpanded = expandedSeller === s.id

              return (
                <Collapsible key={s.id} open={isExpanded} onOpenChange={() => setExpandedSeller(isExpanded ? null : s.id)}>
                  <Card className={`shadow-sm border ${i < 3 ? medal : 'border-slate-200'} overflow-hidden`}>
                    <CollapsibleTrigger asChild>
                      <div className="p-3 md:p-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${medal}`}>
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-black text-slate-800 text-sm">{s.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                L. {(s.metrics?.sales?.achieved || 0).toLocaleString()} | {s.celulares || 0} cel. {s.celularesCredito ? `(${s.celularesCredito} cred)` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-lg font-black font-heading ${s.score >= 100 ? 'text-emerald-600' : s.score >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                                {s.score.toFixed(1)}%
                              </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-slate-100 p-3 md:p-4 space-y-4">
                        {/* Metricas detalladas */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          {[
                            { label: 'Ventas', achieved: s.metrics?.sales?.achieved || 0, target: s.metrics?.sales?.target || 0, icon: <DollarSign className="w-3 h-3" />, fmt: (v: number) => `L.${(v / 1000).toFixed(0)}k` },
                            { label: 'Creditos', achieved: s.metrics?.credits?.achieved || 0, target: s.metrics?.credits?.target || 0, icon: <CreditCard className="w-3 h-3" />, fmt: (v: number) => String(v), extra: s.creditBreakdown ? `OLA:${s.creditBreakdown.ola || 0} KRE:${s.creditBreakdown.krediya || 0} OI:${s.creditBreakdown.oi || 0}` : undefined },
                            { label: 'Accesorios', achieved: s.metrics?.accessories?.achieved || 0, target: s.metrics?.accessories?.target || 0, icon: <Package className="w-3 h-3" />, fmt: (v: number) => String(v) },
                            { label: 'Chips', achieved: s.metrics?.chips?.achieved || 0, target: s.metrics?.chips?.target || 0, icon: <Wifi className="w-3 h-3" />, fmt: (v: number) => String(v) },
                            { label: 'EPIN', achieved: s.metrics?.epin?.achieved || 0, target: s.metrics?.epin?.target || 0, icon: <Zap className="w-3 h-3" />, fmt: (v: number) => `L.${(v / 1000).toFixed(0)}k` },
                            { label: 'Celulares', achieved: s.celulares || 0, target: 0, icon: <Smartphone className="w-3 h-3" />, fmt: (v: number) => String(v), extra: s.celularesCredito ? `${s.celularesCredito} a credito` : undefined },
                          ].map(m => (
                            <div key={m.label} className="bg-slate-50 rounded-lg p-2.5">
                              <div className="flex items-center gap-1 text-slate-400 mb-1">
                                {m.icon}
                                <span className="text-[9px] font-bold uppercase tracking-wider">{m.label}</span>
                              </div>
                              <p className="text-sm font-black text-slate-800">{m.fmt(m.achieved)}</p>
                              {'extra' in m && m.extra && <p className="text-[9px] text-blue-500 font-medium">{m.extra}</p>}
                              {m.target > 0 && (
                                <>
                                  <p className="text-[9px] text-slate-400">Meta: {m.fmt(m.target)}</p>
                                  <ProgressBar
                                    value={m.achieved} max={m.target}
                                    color={pct(m.achieved, m.target) >= 100 ? 'bg-emerald-500' : pct(m.achieved, m.target) >= 70 ? 'bg-amber-500' : 'bg-red-500'}
                                  />
                                  <p className={`text-[9px] font-bold mt-0.5 ${pct(m.achieved, m.target) >= 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {pct(m.achieved, m.target).toFixed(1)}%
                                  </p>
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Mini historial del vendedor */}
                        {sellerHistory[s.name] && sellerHistory[s.name].length > 1 && (
                          <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                              Historial de Ventas
                            </h4>
                            <div className="flex items-end gap-1 h-20">
                              {sellerHistory[s.name].map((h, hi) => {
                                const maxSales = Math.max(...sellerHistory[s.name].map(x => x.sales), 1)
                                const barH = (h.sales / maxSales) * 100
                                const isCurrentMonth = h.month === selectedMonth
                                return (
                                  <div key={hi} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                                    <span className="text-[8px] font-bold text-slate-400">
                                      {(h.sales / 1000).toFixed(0)}k
                                    </span>
                                    <div
                                      className={`w-full max-w-6 rounded-t transition-all ${isCurrentMonth ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                      style={{ height: `${barH}%` }}
                                    />
                                    <span className="text-[7px] font-bold text-slate-400">
                                      {new Date(h.month + '-02').toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tendencia */}
                        {sellerHistory[s.name] && sellerHistory[s.name].length > 1 && (() => {
                          const hist = sellerHistory[s.name]
                          const currentIdx = hist.findIndex(h => h.month === selectedMonth)
                          if (currentIdx > 0) {
                            const prev = hist[currentIdx - 1].score
                            const curr = hist[currentIdx].score
                            const diff = curr - prev
                            return (
                              <div className={`flex items-center gap-2 text-xs font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {diff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                <span>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}% vs mes anterior</span>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })}
          </div>
        </div>

        {/* Comparativa de ventas */}
        {rankedSellers.length > 0 && (
          <Card className="shadow-lg border-t-4 border-t-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black font-heading text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Comparativa de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rankedSellers
                  .sort((a: any, b: any) => (b.metrics?.sales?.achieved || 0) - (a.metrics?.sales?.achieved || 0))
                  .map((s: any) => {
                    const maxSales = Math.max(...rankedSellers.map((x: any) => x.metrics?.sales?.achieved || 0), 1)
                    const salesVal = s.metrics?.sales?.achieved || 0
                    const w = (salesVal / maxSales) * 100
                    return (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-500 w-20 truncate">{s.name}</span>
                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${w}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 w-16 text-right">
                          L.{(salesVal / 1000).toFixed(0)}k
                        </span>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
