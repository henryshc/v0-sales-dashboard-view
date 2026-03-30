'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart3, ArrowLeft, TrendingUp, TrendingDown,
  Users, Calendar, DollarSign, CreditCard, Package, Wifi,
  ChevronDown, Zap
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxufMWqOv5-cv_DUe4HThGywEMg1CwoJk7a0TH9zZwt44ViJaC3xOHYyd09BFNUQU7B/exec'

const DEFAULT_WEIGHTS = { sales: 0.45, credits: 0.20, accessories: 0.20, chips: 0.15, epin: 0.0 }

const getPercent = (achieved: number, target: number) => {
  if (!target || target === 0) return 0
  return (achieved / target) * 100
}

const calculateSellerScore = (seller: any) => {
  const w = seller.weights || DEFAULT_WEIGHTS
  const pSales = getPercent(seller.metrics?.sales?.achieved || 0, seller.metrics?.sales?.target || 0)
  const pCredits = getPercent(seller.metrics?.credits?.achieved || 0, seller.metrics?.credits?.target || 0)
  const pAcc = getPercent(seller.metrics?.accessories?.achieved || 0, seller.metrics?.accessories?.target || 0)
  const pChips = getPercent(seller.metrics?.chips?.achieved || 0, seller.metrics?.chips?.target || 0)
  const pEpin = getPercent(seller.metrics?.epin?.achieved || 0, seller.metrics?.epin?.target || 0)
  return (pSales * (w.sales || 0)) + (pCredits * (w.credits || 0)) + (pAcc * (w.accessories || 0)) + (pChips * (w.chips || 0)) + (pEpin * (w.epin || 0))
}

export default function HistorialPage() {
  const [history, setHistory] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL)
        const data = await res.json()
        if (data.history) setHistory(data.history)
      } catch (e) {
        console.error('Error cargando historial:', e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const sortedMonths = useMemo(() => {
    return Object.keys(history).sort((a, b) => b.localeCompare(a))
  }, [history])

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(monthKey)) newSet.delete(monthKey)
      else newSet.add(monthKey)
      return newSet
    })
  }

  const getMonthStats = (monthData: any) => {
    const sellers = monthData.sellers || []
    let salesTotal = 0, salesTarget = 0
    let creditsTotal = 0, creditsTarget = 0
    let accTotal = 0, accTarget = 0
    let chipsTotal = 0, chipsTarget = 0
    let epinTotal = 0, epinTarget = 0
    let phonesTotal = 0, totalScore = 0

    sellers.forEach((s: any) => {
      salesTotal += s.metrics?.sales?.achieved || 0
      salesTarget += s.metrics?.sales?.target || 0
      creditsTotal += s.metrics?.credits?.achieved || 0
      creditsTarget += s.metrics?.credits?.target || 0
      accTotal += s.metrics?.accessories?.achieved || 0
      accTarget += s.metrics?.accessories?.target || 0
      chipsTotal += s.metrics?.chips?.achieved || 0
      chipsTarget += s.metrics?.chips?.target || 0
      epinTotal += s.metrics?.epin?.achieved || 0
      epinTarget += s.metrics?.epin?.target || 0
      phonesTotal += s.celulares || 0
      totalScore += calculateSellerScore(s)
    })

    const avgScore = sellers.length > 0 ? totalScore / sellers.length : 0
    const comms = monthData.commissions || { tigo: 0, krediya: 0, ola: 0 }
    const totalCommissions = (comms.tigo || 0) + (comms.krediya || 0) + (comms.ola || 0)

    return {
      sales: { achieved: salesTotal, target: salesTarget, percent: getPercent(salesTotal, salesTarget) },
      credits: { achieved: creditsTotal, target: creditsTarget, percent: getPercent(creditsTotal, creditsTarget) },
      accessories: { achieved: accTotal, target: accTarget, percent: getPercent(accTotal, accTarget) },
      chips: { achieved: chipsTotal, target: chipsTarget, percent: getPercent(chipsTotal, chipsTarget) },
      epin: { achieved: epinTotal, target: epinTarget, percent: getPercent(epinTotal, epinTarget) },
      phones: phonesTotal,
      avgScore,
      totalCommissions,
      commissions: comms
    }
  }

  const formatMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando historial...</p>
        </div>
      </div>
    )
  }

  if (sortedMonths.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-black text-slate-700 mb-2">Sin datos de historial</h2>
        <p className="text-slate-500 mb-6">Aun no hay meses registrados en el sistema.</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Panel
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-orange-500" />
            HISTORIAL DE METRICAS
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {sortedMonths.length} {sortedMonths.length === 1 ? 'mes registrado' : 'meses registrados'}
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Panel
        </Link>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        {sortedMonths.map((monthKey) => {
          const monthData = history[monthKey]
          const stats = getMonthStats(monthData)
          const isExpanded = expandedMonths.has(monthKey)
          const sellers = monthData.sellers || []

          return (
            <Collapsible
              key={monthKey}
              open={isExpanded}
              onOpenChange={() => toggleMonth(monthKey)}
              className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
            >
              <CollapsibleTrigger asChild>
                <div className="p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                      <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          {formatMonthName(monthKey)}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {sellers.length} vendedores
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Promedio KPI</p>
                        <p className={`text-lg font-black ${stats.avgScore >= 100 ? 'text-green-500' : stats.avgScore >= 80 ? 'text-orange-500' : 'text-red-500'}`}>
                          {stats.avgScore.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas</p>
                        <p className="text-lg font-black text-slate-700">
                          L. {((stats.sales.achieved + stats.totalCommissions) / 1000).toFixed(0)}k
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Celulares</p>
                        <p className="text-lg font-black text-slate-700">{stats.phones}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-200">
                    <StatCard icon={<DollarSign className="w-4 h-4" />} label="Ventas" value={`L. ${stats.sales.achieved.toLocaleString()}`} target={`Meta: L. ${(stats.sales.target / 1000).toFixed(0)}k`} percent={stats.sales.percent} />
                    <StatCard icon={<CreditCard className="w-4 h-4" />} label="Creditos" value={stats.credits.achieved.toString()} target={`Meta: ${stats.credits.target}`} percent={stats.credits.percent} />
                    <StatCard icon={<Package className="w-4 h-4" />} label="Accesorios" value={stats.accessories.achieved.toString()} target={`Meta: ${stats.accessories.target}`} percent={stats.accessories.percent} />
                    <StatCard icon={<Wifi className="w-4 h-4" />} label="Chips" value={stats.chips.achieved.toString()} target={`Meta: ${stats.chips.target}`} percent={stats.chips.percent} />
                    {(stats.epin.achieved > 0 || stats.epin.target > 0) && (
                      <StatCard icon={<Zap className="w-4 h-4" />} label="EPIN" value={`L. ${stats.epin.achieved.toLocaleString()}`} target={`Meta: L. ${(stats.epin.target / 1000).toFixed(0)}k`} percent={stats.epin.percent} />
                    )}
                  </div>

                  <div className="p-4">
                    <h4 className="font-black text-slate-600 uppercase text-xs tracking-widest mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Desempeno por Vendedor
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider">
                            <th className="px-3 py-2 text-left font-bold">Vendedor</th>
                            <th className="px-3 py-2 text-right font-bold">Ventas</th>
                            <th className="px-3 py-2 text-right font-bold">Creditos</th>
                            <th className="px-3 py-2 text-right font-bold">Accesorios</th>
                            <th className="px-3 py-2 text-right font-bold">Chips</th>
                            <th className="px-3 py-2 text-right font-bold">EPIN</th>
                            <th className="px-3 py-2 text-right font-bold">Celulares</th>
                            <th className="px-3 py-2 text-center font-bold">KPI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sellers.map((seller: any) => {
                            const score = calculateSellerScore(seller)
                            return (
                              <tr key={seller.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-bold text-slate-700">{seller.name}</td>
                                <td className="px-3 py-2 text-right text-slate-600">L. {(seller.metrics?.sales?.achieved || 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{seller.metrics?.credits?.achieved || 0}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{seller.metrics?.accessories?.achieved || 0}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{seller.metrics?.chips?.achieved || 0}</td>
                                <td className="px-3 py-2 text-right text-slate-600">L. {(seller.metrics?.epin?.achieved || 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-slate-600 font-bold">{seller.celulares || 0}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                                    score >= 100 ? 'bg-green-100 text-green-700' :
                                    score >= 80 ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {score >= 100 ? <TrendingUp className="w-3 h-3" /> : score < 80 ? <TrendingDown className="w-3 h-3" /> : null}
                                    {score.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">TIGO</p>
                          <p className="text-sm font-black text-blue-600">L. {(stats.commissions.tigo || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">KREDIYA</p>
                          <p className="text-sm font-black text-emerald-600">L. {(stats.commissions.krediya || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">OLA</p>
                          <p className="text-sm font-black text-purple-600">L. {(stats.commissions.ola || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Comisiones</p>
                        <p className="text-lg font-black text-slate-800">L. {stats.totalCommissions.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, target, percent }: {
  icon: React.ReactNode; label: string; value: string; target: string; percent: number
}) {
  const barWidth = Math.min(percent, 100)
  return (
    <div className="bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-black text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-400 font-medium">{target}</p>
      <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${percent >= 100 ? 'bg-green-500' : percent >= 80 ? 'bg-orange-500' : 'bg-red-500'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className={`text-xs font-bold mt-1 ${percent >= 100 ? 'text-green-600' : percent >= 80 ? 'text-orange-600' : 'text-red-600'}`}>
        {percent.toFixed(1)}%
      </p>
    </div>
  )
}
