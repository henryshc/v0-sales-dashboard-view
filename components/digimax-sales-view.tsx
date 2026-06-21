'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Save, Edit3, Calculator, Calendar,
  ChevronLeft, ChevronRight, ChevronDown, UserPlus, Trash2,
  Settings, Cloud, CheckCircle2, BarChart2, Trophy,
  ArrowUpRight, ArrowDownRight, History, TrendingUp, TrendingDown,
  Scale, Sparkles, BrainCircuit, AlertTriangle, Target,
  Smartphone, Users, Zap, Activity, Flame, Clock, Award, Star, Wifi,
  Pause, RotateCcw, UserX, FileText, MoreVertical,
  Bell, Lightbulb, Play, Download, Lock, Unlock, ShieldCheck, Pencil, Plus,
  Loader2, RefreshCw, Printer
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateAIAnalysis, type AIAnalysis } from '@/app/actions/ai-analysis';

// ============================================================================
// 1. TIPOS
// ============================================================================

type MetricKey = 'sales' | 'credits' | 'accessories' | 'chips' | 'epin';
type Metric = { achieved: number; target: number };
type MetricsMap = Record<MetricKey, Metric>;
type WeightsMap = Record<MetricKey, number>;

type SellerStatus = 'active' | 'suspended' | 'inactive';
type ExitReason = 'renuncia' | 'despido' | 'abandono' | 'contrato_terminado' | null;

// Credit breakdown by financiera
type CreditBreakdown = {
  ola: number;
  krediya: number;
  oi: number;
};

// Tipo de vendedor para medir KPIs diferentes
type SellerType = 'piso' | 'tigomoney';

// Leads generados (KPI principal del rol transaccional / TigoMoney)
type LeadsMap = {
  credito: Metric;   // Personas generadas con interes en CREDITO
  home: Metric;      // Personas generadas con interes en HOME
  pospago: Metric;   // Personas generadas con interes en POSPAGO
};

type Seller = {
  id: number;
  name: string;
  celulares: number;
  celularesCredito?: number;      // Celulares que aplican a credito (elegibles)
  sellerType?: SellerType;        // Tipo de vendedor (piso = default, tigomoney = transaccional)
  weights: WeightsMap;
  metrics: MetricsMap;
  leads?: LeadsMap;               // KPI de leads para vendedor transaccional
  utility?: number;               // Utilidad generada por el vendedor (entrada manual, en %)
  creditBreakdown?: CreditBreakdown; // Desglose de creditos por financiera
  // Estado del vendedor
  status?: SellerStatus;
  hireDate?: string | null;      // YYYY-MM-DD
  exitDate?: string | null;      // YYYY-MM-DD
  exitReason?: ExitReason;
  suspendedUntil?: string | null; // YYYY-MM-DD para suspensiones temporales
  notes?: string;                 // Notas internas
};

// Log de cambios para auditoría
type ChangeLogEntry = {
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'restore';
  sellerId: number;
  sellerName: string;
  field?: string;
  oldValue?: string | number;
  newValue?: string | number;
  reason?: string;
};

type Commissions = { tigo: number; krediya: number; ola: number };
type GlobalTargets = Record<MetricKey, number>;

type MonthData = {
  sellers: Seller[];
  commissions: Commissions;
  globalTargets: GlobalTargets;
  modifiedDays: string[];
  lastModifiedAt: string | null;
  changeLog?: ChangeLogEntry[];
  vacations?: VacationEntry[];  // Vacaciones editables por mes
  isClosed?: boolean;         // Mes cerrado/congelado
  closedAt?: string | null;   // Fecha de cierre
};

type HistoryMap = Record<string, MonthData>;
type CloudPayload = { history?: HistoryMap; globalTargets?: Partial<GlobalTargets> | null; version?: string | null };

// ============================================================================
// 2. CONSTANTES
// ============================================================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxufMWqOv5-cv_DUe4HThGywEMg1CwoJk7a0TH9zZwt44ViJaC3xOHYyd09BFNUQU7B/exec';
const DATA_VERSION = 'v1.9.4-FEB-DATA-UPDATE';

const DEFAULT_WEIGHTS: WeightsMap = { sales: 0.45, credits: 0.2, accessories: 0.2, chips: 0.15, epin: 0.0 };
const DEFAULT_GLOBAL_TARGETS: GlobalTargets = { sales: 1500000, credits: 150, accessories: 560, chips: 400, epin: 0 };

const APP_TZ = 'America/Tegucigalpa';

// ============================================================================
// VACACIONES
// ============================================================================

type VacationEntry = {
  name: string;
  type: string;
  start: string; // YYYY-MM-DD
  end: string;
  days: number;
  status: 'Completado' | 'En Curso' | 'Programado';
};

const VACATIONS: VacationEntry[] = [
  { name: 'MATILDE',     type: 'Vacaciones (P1)',         start: '2025-12-31', end: '2026-01-09', days: 8,  status: 'Completado' },
  { name: 'JULISSA',     type: 'Vacaciones',              start: '2026-01-03', end: '2026-01-26', days: 20, status: 'Completado' },
  { name: 'JEAMIE',      type: 'Vacaciones',              start: '2026-01-12', end: '2026-01-18', days: 7,  status: 'Completado' },
  { name: 'JUAN CARLOS', type: 'Vacaciones',              start: '2026-02-02', end: '2026-02-24', days: 20, status: 'En Curso' },
  { name: 'JEAMIE',      type: 'Vacaciones (P2)',         start: '2026-02-26', end: '2026-03-05', days: 8,  status: 'Programado' },
  { name: 'HENRY',       type: 'Pt. 1 vacaciones 2025',  start: '2026-03-23', end: '2026-03-25', days: 3,  status: 'Programado' },
  { name: 'MATILDE',     type: 'Dia libre',               start: '2026-04-01', end: '2026-04-01', days: 1,  status: 'Programado' },
  { name: 'HENRY',       type: 'Vacaciones 2025',         start: '2026-04-06', end: '2026-04-28', days: 20, status: 'Programado' },
  { name: 'RIESI',       type: 'Vacaciones',              start: '2026-04-21', end: '2026-05-10', days: 17, status: 'Programado' },
  { name: 'JAZMIN',      type: 'Vacaciones',              start: '2026-08-03', end: '2026-08-25', days: 20, status: 'Programado' },
  { name: 'MATILDE',     type: 'Vacaciones #1',           start: '2026-08-24', end: '2026-09-07', days: 15, status: 'Programado' },
  { name: 'JEAMIE',      type: 'Vacaciones (Q3)',         start: '2026-09-07', end: '2026-09-23', days: 15, status: 'Programado' },
];

// Team roster per month - Julissa only in January 2026
const TEAM_ROSTER: Record<string, string[] | undefined> = {
  '2026-01': ['JUAN CARLOS', 'MATILDE', 'JAZMIN', 'JEAMIE', 'RIESI', 'JULISSA', 'LARITZA', 'NICOLE'],
};
const DEFAULT_ROSTER = ['JUAN CARLOS', 'MATILDE', 'JAZMIN', 'JEAMIE', 'RIESI', 'LARITZA', 'NICOLE'];

const getTeamRoster = (monthKey: string): string[] => TEAM_ROSTER[monthKey] || DEFAULT_ROSTER;

const getVacationsForMonth = (year: number, month: number): VacationEntry[] => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  return VACATIONS.filter(v => {
    const vs = new Date(v.start + 'T00:00:00');
    const ve = new Date(v.end + 'T00:00:00');
    return vs <= monthEnd && ve >= monthStart;
  });
};

const getVacationDaysInMonth = (v: VacationEntry, year: number, month: number): number => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const vs = new Date(v.start + 'T00:00:00');
  const ve = new Date(v.end + 'T00:00:00');
  const overlapStart = vs > monthStart ? vs : monthStart;
  const overlapEnd = ve < monthEnd ? ve : monthEnd;
  const diff = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
};

const isOnVacation = (name: string, date: Date): boolean => {
  return VACATIONS.some(v => {
    if (v.name !== name) return false;
    const vs = new Date(v.start + 'T00:00:00');
    const ve = new Date(v.end + 'T00:00:00');
    return date >= vs && date <= ve;
  });
};

const getNowInTZ = (): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value || '1970';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const d = parts.find(p => p.type === 'day')?.value || '01';
  return new Date(`${y}-${m}-${d}T00:00:00`);
};

const toISODateInTZ = (): string => {
  const dt = getNowInTZ();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const daysInMonthFor = (date: Date): number => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

// ============================================================================
// SELLER STATUS HELPERS
// ============================================================================

const isSellerActive = (seller: Seller, date?: Date): boolean => {
  const status = seller.status || 'active';
  if (status === 'inactive') return false;
  if (status === 'suspended' && seller.suspendedUntil) {
    const suspendedUntil = new Date(seller.suspendedUntil + 'T23:59:59');
    const checkDate = date || getNowInTZ();
    if (checkDate <= suspendedUntil) return false;
  }
  return true;
};

const getSellerStatusLabel = (seller: Seller): { label: string; color: string; bg: string } => {
  const status = seller.status || 'active';
  if (status === 'inactive') return { label: 'Inactivo', color: 'text-red-600', bg: 'bg-red-50' };
  if (status === 'suspended') return { label: 'Suspendido', color: 'text-amber-600', bg: 'bg-amber-50' };
  return { label: 'Activo', color: 'text-emerald-600', bg: 'bg-emerald-50' };
};

const EXIT_REASON_LABELS: Record<string, string> = {
  renuncia: 'Renuncia voluntaria',
  despido: 'Despido',
  abandono: 'Abandono de trabajo',
  contrato_terminado: 'Fin de contrato',
};

const createChangeLogEntry = (
  action: ChangeLogEntry['action'],
  seller: Seller,
  field?: string,
  oldValue?: string | number,
  newValue?: string | number,
  reason?: string
): ChangeLogEntry => ({
  timestamp: new Date().toISOString(),
  action,
  sellerId: seller.id,
  sellerName: seller.name,
  field,
  oldValue,
  newValue,
  reason,
});

const safeNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

// ============================================================================
// 3. SERVICIO DE DATOS (con localStorage backup)
// ============================================================================

const LOCAL_STORAGE_KEY = 'digimax-sales-backup';
const LOCAL_STORAGE_TIMESTAMP_KEY = 'digimax-sales-backup-timestamp';

const LocalBackup = {
  save(history: HistoryMap): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ history, version: DATA_VERSION }));
      localStorage.setItem(LOCAL_STORAGE_TIMESTAMP_KEY, new Date().toISOString());
    } catch (e) {
      console.warn('[v0] LocalBackup.save failed:', e);
    }
  },
  load(): { history: HistoryMap; version: string; timestamp: string } | null {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      const timestamp = localStorage.getItem(LOCAL_STORAGE_TIMESTAMP_KEY) || '';
      if (!data) return null;
      const parsed = JSON.parse(data);
      return { history: parsed.history || {}, version: parsed.version || '', timestamp };
    } catch {
      return null;
    }
  },
  getTimestamp(): string | null {
    return localStorage.getItem(LOCAL_STORAGE_TIMESTAMP_KEY);
  },
  clear(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TIMESTAMP_KEY);
  }
};

const DataService = {
  async loadData(): Promise<CloudPayload> {
    try {
      // Usar el proxy server-side para evitar bloqueos de CORS en produccion
      const response = await fetch('/api/data', { cache: 'no-store' });
      const cloudData = (await response.json()) as CloudPayload;
      
      // Si cloud falla o esta vacio, intentar localStorage
      if (!cloudData.history || Object.keys(cloudData.history).length === 0) {
        const localData = LocalBackup.load();
        if (localData && localData.version === DATA_VERSION) {
          console.log('[v0] Loaded from localStorage backup');
          return { history: localData.history, version: localData.version, globalTargets: null };
        }
      }

      // RECUPERACION: fusionar meses que existen en el respaldo local pero NO en la nube.
      // Esto restaura datos que un reseteo de version pudo haber borrado de la nube.
      const localBackup = LocalBackup.load();
      if (localBackup?.history && cloudData.history) {
        let recovered = 0;
        Object.keys(localBackup.history).forEach(monthKey => {
          const localMonth = localBackup.history[monthKey];
          const cloudMonth = cloudData.history[monthKey];
          const localHasData = (localMonth?.sellers || []).some(s => Object.values(s.metrics || {}).some(m => (m?.achieved || 0) > 0));
          const cloudMissing = !cloudMonth || (cloudMonth.sellers || []).every(s => Object.values(s.metrics || {}).every(m => (m?.achieved || 0) === 0));
          if (localHasData && cloudMissing) {
            cloudData.history[monthKey] = localMonth;
            recovered++;
          }
        });
        if (recovered > 0) console.log(`[v0] Recuperados ${recovered} mes(es) desde respaldo local`);
      }
      
      return cloudData;
    } catch {
      // Fallback a localStorage si cloud falla
      const localData = LocalBackup.load();
      if (localData && localData.version === DATA_VERSION) {
        console.log('[v0] Cloud failed, using localStorage backup');
        return { history: localData.history, version: localData.version, globalTargets: null };
      }
      return { history: {}, globalTargets: null, version: null };
    }
  },
  async saveData(history: HistoryMap): Promise<{ success: boolean; localBackup: boolean }> {
    // Siempre guardar en localStorage primero (optimistic)
    LocalBackup.save(history);
    
    try {
      // Guardar via proxy server-side (evita CORS y permite leer la respuesta)
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, globalTargets: null, version: DATA_VERSION })
      });
      return { success: true, localBackup: true };
    } catch { 
      return { success: false, localBackup: true }; 
    }
  }
};

// ============================================================================
// 4. PLANTILLAS DE DATOS
// ============================================================================

const makeMetrics = (overrides?: Partial<MetricsMap>): MetricsMap => {
  const base: MetricsMap = { sales: { achieved: 0, target: 0 }, credits: { achieved: 0, target: 0 }, accessories: { achieved: 0, target: 0 }, chips: { achieved: 0, target: 0 }, epin: { achieved: 0, target: 0 } };
  return { ...base, ...(overrides || {}) };
};

// Normaliza un vendedor para garantizar tipo y leads, sin importar la fuente
// (nube, templates JAN/FEB/MAR o plantilla de mes nuevo). JAZMIN es transaccional.
const normalizeSeller = (s: Seller): Seller => {
  const name = String(s.name || '').toUpperCase();
  const isTigoMoney = s.sellerType === 'tigomoney' || name.includes('JAZMIN') || name.includes('JASMIN');
  if (!isTigoMoney) return s.sellerType ? s : { ...s, sellerType: 'piso' };
  return {
    ...s,
    sellerType: 'tigomoney',
    leads: s.leads || { credito: { achieved: 0, target: 20 }, home: { achieved: 0, target: 10 }, pospago: { achieved: 0, target: 15 } },
  };
};

const getNewMonthTemplate = (): Seller[] => [
  { id: 1, name: 'JUAN CARLOS', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 243000 }, credits: { achieved: 0, target: 30 }, accessories: { achieved: 0, target: 60 }, chips: { achieved: 0, target: 40 }, epin: { achieved: 0, target: 0 } }) },
  { id: 2, name: 'MATILDE', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 178000 }, credits: { achieved: 0, target: 10 }, accessories: { achieved: 0, target: 65 }, chips: { achieved: 0, target: 60 }, epin: { achieved: 0, target: 0 } }) },
  { id: 3, name: 'JAZMIN', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 30000 }, credits: { achieved: 0, target: 5 }, accessories: { achieved: 0, target: 20 }, chips: { achieved: 0, target: 10 }, epin: { achieved: 0, target: 190000 } }) },
  { id: 4, name: 'JEAMIE', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 218000 }, credits: { achieved: 0, target: 30 }, accessories: { achieved: 0, target: 80 }, chips: { achieved: 0, target: 70 }, epin: { achieved: 0, target: 0 } }) },
  { id: 5, name: 'RIESI', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 198000 }, credits: { achieved: 0, target: 25 }, accessories: { achieved: 0, target: 80 }, chips: { achieved: 0, target: 80 }, epin: { achieved: 0, target: 0 } }) },
  { id: 8, name: 'NICOLE', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 243000 }, credits: { achieved: 0, target: 30 }, accessories: { achieved: 0, target: 70 }, chips: { achieved: 0, target: 70 }, epin: { achieved: 0, target: 0 } }) },
];

const JAN_2026_DATA: Seller[] = [
  { id: 1, name: 'JUAN CARLOS', celulares: 69, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 210268, target: 200000 }, credits: { achieved: 28, target: 30 }, accessories: { achieved: 54, target: 60 }, chips: { achieved: 46, target: 40 }, epin: { achieved: 0, target: 0 } }) },
  { id: 2, name: 'MATILDE', celulares: 39, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 104505, target: 100000 }, credits: { achieved: 8, target: 10 }, accessories: { achieved: 67, target: 65 }, chips: { achieved: 23, target: 60 }, epin: { achieved: 0, target: 0 } }) },
  { id: 3, name: 'JAZMIN', celulares: 2, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 184516, target: 220000 }, credits: { achieved: 2, target: 5 }, accessories: { achieved: 10, target: 20 }, chips: { achieved: 8, target: 0 }, epin: { achieved: 0, target: 0 } }) },
  { id: 4, name: 'JEAMIE', celulares: 44, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 137030, target: 150000 }, credits: { achieved: 20, target: 30 }, accessories: { achieved: 64, target: 80 }, chips: { achieved: 40, target: 70 }, epin: { achieved: 0, target: 0 } }) },
  { id: 5, name: 'RIESI', celulares: 51, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 210955, target: 200000 }, credits: { achieved: 17, target: 25 }, accessories: { achieved: 79, target: 80 }, chips: { achieved: 56, target: 80 }, epin: { achieved: 0, target: 0 } }) },
  { id: 6, name: 'JULISSA', celulares: 0, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 210000 }, credits: { achieved: 0, target: 22 }, accessories: { achieved: 0, target: 50 }, chips: { achieved: 0, target: 70 }, epin: { achieved: 0, target: 0 } }) },
  { id: 7, name: 'LARITZA', celulares: 60, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 198432, target: 200000 }, credits: { achieved: 25, target: 30 }, accessories: { achieved: 89, target: 80 }, chips: { achieved: 50, target: 80 }, epin: { achieved: 0, target: 0 } }) },
  { id: 8, name: 'NICOLE', celulares: 53, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 182500, target: 180000 }, credits: { achieved: 27, target: 30 }, accessories: { achieved: 88, target: 70 }, chips: { achieved: 64, target: 70 }, epin: { achieved: 0, target: 0 } }) },
];
const JAN_COMMISSIONS: Commissions = { tigo: 111002, krediya: 4015, ola: 14700 };

const FEB_2026_DATA: Seller[] = [
  { id: 8, name: 'NICOLE', celulares: 56, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 167389, target: 180000 }, credits: { achieved: 21, target: 25 }, accessories: { achieved: 83, target: 70 }, chips: { achieved: 42, target: 60 }, epin: { achieved: 1092, target: 1560 } }) },
  { id: 3, name: 'JAZMIN', celulares: 5, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, sellerType: 'tigomoney', leads: { credito: { achieved: 12, target: 20 }, home: { achieved: 6, target: 10 }, pospago: { achieved: 9, target: 15 } }, weights: { sales: 0.05, credits: 0.05, accessories: 0.05, chips: 0.05, epin: 0.80 }, metrics: makeMetrics({ sales: { achieved: 17866, target: 30000 }, credits: { achieved: 4, target: 5 }, accessories: { achieved: 8, target: 10 }, chips: { achieved: 6, target: 10 }, epin: { achieved: 169919, target: 190000 } }) },
  { id: 5, name: 'RIESI', celulares: 44, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 135876, target: 180000 }, credits: { achieved: 17, target: 25 }, accessories: { achieved: 55, target: 80 }, chips: { achieved: 45, target: 80 }, epin: { achieved: 44283, target: 40000 } }) },
  { id: 7, name: 'LARITZA', celulares: 52, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 148932, target: 220000 }, credits: { achieved: 18, target: 30 }, accessories: { achieved: 62, target: 80 }, chips: { achieved: 38, target: 80 }, epin: { achieved: 2847, target: 0 } }) },
  { id: 4, name: 'JEAMIE', celulares: 38, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 112567, target: 220000 }, credits: { achieved: 12, target: 30 }, accessories: { achieved: 48, target: 80 }, chips: { achieved: 35, target: 70 }, epin: { achieved: 8934, target: 0 } }) },
  { id: 2, name: 'MATILDE', celulares: 28, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 89456, target: 120000 }, credits: { achieved: 9, target: 12 }, accessories: { achieved: 45, target: 70 }, chips: { achieved: 22, target: 60 }, epin: { achieved: 1245, target: 0 } }) },
  { id: 1, name: 'JUAN CARLOS', celulares: 58, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 184705, target: 190000 }, credits: { achieved: 24, target: 25 }, accessories: { achieved: 55, target: 60 }, chips: { achieved: 44, target: 60 }, epin: { achieved: 25290, target: 20000 } }) },
];
const FEB_COMMISSIONS: Commissions = { tigo: 59282, krediya: 0, ola: 9820 };

// Marzo 2026 - Plantilla inicial con metas actualizadas
const MAR_2026_DATA: Seller[] = [
  { id: 1, name: 'JUAN CARLOS', celulares: 0, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 243000 }, credits: { achieved: 0, target: 25 }, accessories: { achieved: 0, target: 60 }, chips: { achieved: 0, target: 60 }, epin: { achieved: 0, target: 20000 } }) },
  { id: 2, name: 'MATILDE', celulares: 0, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 178000 }, credits: { achieved: 0, target: 12 }, accessories: { achieved: 0, target: 70 }, chips: { achieved: 0, target: 60 }, epin: { achieved: 0, target: 0 } }) },
  { id: 3, name: 'JAZMIN', celulares: 0, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, sellerType: 'tigomoney', leads: { credito: { achieved: 0, target: 20 }, home: { achieved: 0, target: 10 }, pospago: { achieved: 0, target: 15 } }, weights: { sales: 0.05, credits: 0.05, accessories: 0.05, chips: 0.05, epin: 0.80 }, metrics: makeMetrics({ sales: { achieved: 0, target: 30000 }, credits: { achieved: 0, target: 5 }, accessories: { achieved: 0, target: 10 }, chips: { achieved: 0, target: 10 }, epin: { achieved: 0, target: 190000 } }) },
  { id: 4, name: 'JEAMIE', celulares: 0, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 218000 }, credits: { achieved: 0, target: 30 }, accessories: { achieved: 0, target: 80 }, chips: { achieved: 0, target: 70 }, epin: { achieved: 0, target: 0 } }) },
  { id: 5, name: 'RIESI', celulares: 0, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 198000 }, credits: { achieved: 0, target: 25 }, accessories: { achieved: 0, target: 80 }, chips: { achieved: 0, target: 80 }, epin: { achieved: 0, target: 40000 } }) },
  { id: 8, name: 'NICOLE', celulares: 0, celularesCredito: 0, creditBreakdown: { ola: 0, krediya: 0, oi: 0 }, weights: { ...DEFAULT_WEIGHTS }, metrics: makeMetrics({ sales: { achieved: 0, target: 243000 }, credits: { achieved: 0, target: 25 }, accessories: { achieved: 0, target: 70 }, chips: { achieved: 0, target: 60 }, epin: { achieved: 0, target: 1560 } }) },
];
const MAR_COMMISSIONS: Commissions = { tigo: 0, krediya: 0, ola: 0 };

// ============================================================================
// 5. KPI LOGIC
// ============================================================================

const getKpiPercent = (achieved: number, target: number): number => {
  if (!target || target <= 0) return 0;
  const pct = (achieved / target) * 100;
  return Number.isFinite(pct) ? Math.max(0, pct) : 0;
};

/**
 * Compute effective weights for a seller.
 * Uses the seller's CONFIGURED weights (seller.weights) as the source of truth.
 * Any metric with target === 0 has its weight redistributed proportionally
 * among the metrics that DO have a target, so the score always sums to the
 * seller's configured intent and reacts to manual weight changes.
 */
const getEffectiveWeights = (seller: Seller): WeightsMap => {
  const keys: MetricKey[] = ['sales', 'credits', 'accessories', 'chips', 'epin'];

  // Start from the seller's configured weights (fallback to defaults)
  const configured: WeightsMap = { ...DEFAULT_WEIGHTS, ...(seller.weights || {}) };

  // Normalize configured weights to sum to 1 (in case they don't add up to 100%)
  const configuredTotal = keys.reduce((sum, k) => sum + (configured[k] || 0), 0);
  const BASE: WeightsMap = { sales: 0, credits: 0, accessories: 0, chips: 0, epin: 0 };
  if (configuredTotal > 0) {
    for (const k of keys) BASE[k] = (configured[k] || 0) / configuredTotal;
  } else {
    // No configured weights at all -> even split
    for (const k of keys) BASE[k] = 1 / keys.length;
  }

  // Remove weight from metrics with target === 0 and redistribute
  let deadWeight = 0;
  let aliveWeight = 0;
  for (const k of keys) {
    const t = seller.metrics[k]?.target ?? 0;
    if (t <= 0) {
      deadWeight += BASE[k];
      BASE[k] = 0;
    } else {
      aliveWeight += BASE[k];
    }
  }

  // Redistribute dead weight proportionally among alive metrics
  if (deadWeight > 0 && aliveWeight > 0) {
    const scale = (aliveWeight + deadWeight) / aliveWeight;
    for (const k of keys) {
      if (BASE[k] > 0) BASE[k] *= scale;
    }
  }

  return BASE;
};

const EMPTY_LEADS: LeadsMap = {
  credito: { achieved: 0, target: 0 },
  home: { achieved: 0, target: 0 },
  pospago: { achieved: 0, target: 0 },
};

// Tasa de conversion a credito = creditos hechos / celulares elegibles a credito
const getCreditConversion = (seller: Seller): { eligible: number; done: number; pct: number } => {
  const eligible = seller.celularesCredito || 0;
  const done = seller.metrics?.credits?.achieved || 0;
  const pct = eligible > 0 ? (done / eligible) * 100 : 0;
  return { eligible, done, pct };
};

// Score del KPI de leads (vendedor transaccional / TigoMoney)
const calculateLeadsScore = (seller: Seller): number => {
  const leads = seller.leads || EMPTY_LEADS;
  const parts: (keyof LeadsMap)[] = ['credito', 'home', 'pospago'];
  const active = parts.filter(k => (leads[k]?.target || 0) > 0);
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, k) => acc + getKpiPercent(leads[k].achieved, leads[k].target), 0);
  return sum / active.length;
};

const calculateScore = (seller: Seller): number => {
  // Vendedor transaccional: su KPI principal son los leads generados.
  // Las metas de venta son simbolicas y NO penalizan su score.
  if (seller.sellerType === 'tigomoney') {
    return calculateLeadsScore(seller);
  }
  const w = getEffectiveWeights(seller);
  return (['sales', 'credits', 'accessories', 'chips', 'epin'] as MetricKey[]).reduce((sum, k) => {
    const pct = getKpiPercent(seller.metrics[k].achieved, seller.metrics[k].target);
    return sum + pct * w[k];
  }, 0);
};

const getBestPerformer = (sellers: Seller[], metric: MetricKey): { name: string; pct: number } | null => {
  let best: { name: string; pct: number } | null = null;
  for (const s of sellers) {
    const pct = getKpiPercent(s.metrics?.[metric]?.achieved ?? 0, s.metrics?.[metric]?.target ?? 0);
    if (pct > 0 && (!best || pct > best.pct)) best = { name: s.name, pct };
  }
  return best;
};

const getBestOverall = (sellers: Seller[]): { name: string; score: number } | null => {
  let best: { name: string; score: number } | null = null;
  for (const s of sellers) {
    const score = calculateScore(s);
    if (score > 0 && (!best || score > best.score)) best = { name: s.name, score };
  }
  return best;
};

// ============================================================================
// 6. SVG Progress Ring
// ============================================================================

const ProgressRing = ({ value, max, size = 80, strokeWidth = 6, color = '#6366f1', trackColor, textClass, showGlow }: { value: number; max: number; size?: number; strokeWidth?: number; color?: string; trackColor?: string; textClass?: string; showGlow?: boolean }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 150) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const isComplete = pct >= 100;
  const activeColor = isComplete ? '#10b981' : color;

  return (
    <div className="relative inline-flex items-center justify-center group cursor-default">
      {/* Glow effect for high progress */}
      {showGlow && pct >= 80 && (
        <div className={`absolute inset-0 rounded-full blur-lg opacity-30 transition-opacity group-hover:opacity-50 ${isComplete ? 'bg-emerald-400' : 'bg-indigo-400'}`} style={{ transform: 'scale(0.8)' }} />
      )}
      <svg width={size} height={size} className="-rotate-90 transition-transform duration-300 group-hover:scale-105">
        {/* Track with gradient */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor || '#e2e8f0'} strokeWidth={strokeWidth} className="opacity-60" />
        {/* Progress arc */}
        <circle 
          cx={size / 2} cy={size / 2} r={radius} fill="none" 
          stroke={activeColor} 
          strokeWidth={strokeWidth} 
          strokeLinecap="round"
          strokeDasharray={circumference} 
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out drop-shadow-sm"
          style={{ filter: isComplete ? 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))' : undefined }}
        />
        {/* Decorative dots at start/end */}
        {pct > 5 && (
          <circle cx={size / 2} cy={strokeWidth / 2 + 1} r={strokeWidth / 3} fill={activeColor} className="transition-all duration-700" />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-xs font-black font-heading transition-all duration-300 ${textClass || (isComplete ? 'text-emerald-600' : 'text-slate-700')} group-hover:scale-110`}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// 7. COMPONENTE PRINCIPAL
// ============================================================================

// PIN de seguridad (configurable)
const EDIT_PIN = '1234'; // Cambiar en produccion

// VacationForm component - extracted to avoid hooks rules violation
const VacationForm = ({ editingVacation, sellers, onSave }: { 
  editingVacation: VacationEntry | null; 
  sellers: Seller[]; 
  onSave: (vacation: VacationEntry) => void;
}) => {
  const [vacName, setVacName] = useState(editingVacation?.name || '');
  const [vacType, setVacType] = useState(editingVacation?.type || 'Vacaciones');
  const [vacStart, setVacStart] = useState(editingVacation?.start || toISODateInTZ());
  const [vacEnd, setVacEnd] = useState(editingVacation?.end || toISODateInTZ());
  const [vacStatus, setVacStatus] = useState<'Completado' | 'En Curso' | 'Programado'>(editingVacation?.status || 'Programado');
  
  useEffect(() => {
    if (editingVacation) {
      setVacName(editingVacation.name);
      setVacType(editingVacation.type);
      setVacStart(editingVacation.start);
      setVacEnd(editingVacation.end);
      setVacStatus(editingVacation.status);
    } else {
      setVacName('');
      setVacType('Vacaciones');
      setVacStart(toISODateInTZ());
      setVacEnd(toISODateInTZ());
      setVacStatus('Programado');
    }
  }, [editingVacation]);
  
  const calcDays = () => {
    const start = new Date(vacStart + 'T00:00:00');
    const end = new Date(vacEnd + 'T00:00:00');
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  };
  
  return (
    <div className="space-y-4 py-4">
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre</label>
        <select className="w-full border border-slate-200 p-3 rounded-lg font-bold outline-none focus:border-amber-500" value={vacName} onChange={e => setVacName(e.target.value)}>
          <option value="">Seleccionar...</option>
          {sellers.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo</label>
        <input className="w-full border border-slate-200 p-3 rounded-lg font-bold outline-none focus:border-amber-500" value={vacType} onChange={e => setVacType(e.target.value)} placeholder="Vacaciones, Dia libre, etc." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Inicio</label>
          <input type="date" className="w-full border border-slate-200 p-3 rounded-lg font-bold outline-none focus:border-amber-500" value={vacStart} onChange={e => setVacStart(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fin</label>
          <input type="date" className="w-full border border-slate-200 p-3 rounded-lg font-bold outline-none focus:border-amber-500" value={vacEnd} onChange={e => setVacEnd(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Estado</label>
        <select className="w-full border border-slate-200 p-3 rounded-lg font-bold outline-none focus:border-amber-500" value={vacStatus} onChange={e => setVacStatus(e.target.value as 'Completado' | 'En Curso' | 'Programado')}>
          <option value="Programado">Programado</option>
          <option value="En Curso">En Curso</option>
          <option value="Completado">Completado</option>
        </select>
      </div>
      <div className="bg-amber-50 rounded-lg p-3 text-center">
        <span className="text-amber-700 font-bold">{calcDays()} dias</span>
      </div>
      <Button 
        onClick={() => onSave({ name: vacName, type: vacType, start: vacStart, end: vacEnd, days: calcDays(), status: vacStatus })} 
        disabled={!vacName}
        className="w-full bg-amber-500 hover:bg-amber-600 h-12 text-lg font-bold"
      >
        {editingVacation ? 'Guardar Cambios' : 'Agregar'}
      </Button>
    </div>
  );
};

const DigimaxSalesView = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'compare' | 'history' | 'ai'>('dashboard');
  const [isEditing, setIsEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(() => getNowInTZ());
  const [showAddSeller, setShowAddSeller] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [sellerConfig, setSellerConfig] = useState<Seller | null>(null);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [editingVacation, setEditingVacation] = useState<VacationEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'updating'>('synced');
  const [history, setHistory] = useState<HistoryMap>({});
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerTargets] = useState<GlobalTargets>({ sales: 150000, credits: 20, accessories: 50, chips: 40, epin: 0 });

  // Popup "Vendedor del Mes" (MVP)
  const [mvpSeller, setMvpSeller] = useState<Seller | null>(null);
  const [showMvp, setShowMvp] = useState(false);
  const shownMvpRef = useRef<Set<string>>(new Set());
  
  // PIN Security
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false); // Session unlock

  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const hydratedRef = useRef(false);

  const markModified = (mKey: string) => {
    const todayISO = toISODateInTZ();
    setHistory(prev => {
      const base: MonthData = prev[mKey] || { sellers: [], commissions: { tigo: 0, krediya: 0, ola: 0 }, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null };
      const prevDays = Array.isArray(base.modifiedDays) ? base.modifiedDays : [];
      const nextDays = prevDays.includes(todayISO) ? prevDays : [...prevDays, todayISO];
      return { ...prev, [mKey]: { ...base, modifiedDays: nextDays, lastModifiedAt: todayISO } };
    });
  };

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const cloudData = await DataService.loadData();
      {
        // MIGRACION NO DESTRUCTIVA: nunca se borra el historial existente.
        // Se sanean los datos de la nube y, si la version cambio, solo se
        // siembran meses base que falten y se actualiza la version.
        const versionChanged = cloudData.version !== DATA_VERSION;
        if (versionChanged) setSyncStatus('updating');
        const rawHistory = cloudData.history || {};
        const patchedHistory: HistoryMap = {};
        Object.keys(rawHistory).forEach(key => {
          const monthObj = rawHistory[key] as MonthData;
          const sellers = (monthObj?.sellers || []).map(s => {
            const sname = String(s.name || '').toUpperCase();
            // Auto-deteccion: JAZMIN es rol transaccional (TigoMoney) aunque la nube no lo tenga guardado
            const isTigoMoney = s.sellerType === 'tigomoney' || sname.includes('JAZMIN') || sname.includes('JASMIN');
            return ({
            id: safeNumber(s.id, 0),
            name: sname,
            celulares: safeNumber(s.celulares, 0),
            celularesCredito: safeNumber(s.celularesCredito, 0),
            utility: safeNumber(s.utility, 0),
            sellerType: isTigoMoney ? 'tigomoney' : 'piso',
            leads: isTigoMoney ? (s.leads ? {
              credito: { achieved: safeNumber(s.leads?.credito?.achieved), target: safeNumber(s.leads?.credito?.target) },
              home: { achieved: safeNumber(s.leads?.home?.achieved), target: safeNumber(s.leads?.home?.target) },
              pospago: { achieved: safeNumber(s.leads?.pospago?.achieved), target: safeNumber(s.leads?.pospago?.target) },
            } : { credito: { achieved: 0, target: 20 }, home: { achieved: 0, target: 10 }, pospago: { achieved: 0, target: 15 } }) : undefined,
            creditBreakdown: {
              ola: safeNumber(s.creditBreakdown?.ola, 0),
              krediya: safeNumber(s.creditBreakdown?.krediya, 0),
              oi: safeNumber(s.creditBreakdown?.oi, 0),
            },
            weights: { ...DEFAULT_WEIGHTS, ...(s.weights || {}) } as WeightsMap,
            metrics: makeMetrics({
              sales: { achieved: safeNumber(s.metrics?.sales?.achieved), target: safeNumber(s.metrics?.sales?.target) },
              credits: { achieved: safeNumber(s.metrics?.credits?.achieved), target: safeNumber(s.metrics?.credits?.target) },
              accessories: { achieved: safeNumber(s.metrics?.accessories?.achieved), target: safeNumber(s.metrics?.accessories?.target) },
              chips: { achieved: safeNumber(s.metrics?.chips?.achieved), target: safeNumber(s.metrics?.chips?.target) },
              epin: { achieved: safeNumber(s.metrics?.epin?.achieved), target: safeNumber(s.metrics?.epin?.target) },
            }),
            status: s.status || 'active',
            hireDate: s.hireDate || null,
            exitDate: s.exitDate || null,
            exitReason: s.exitReason || null,
            suspendedUntil: s.suspendedUntil || null,
            notes: s.notes || '',
          } as Seller);
          });
          patchedHistory[key] = {
            sellers,
            commissions: { tigo: safeNumber(monthObj?.commissions?.tigo), krediya: safeNumber(monthObj?.commissions?.krediya), ola: safeNumber(monthObj?.commissions?.ola) },
            globalTargets: { ...DEFAULT_GLOBAL_TARGETS, ...(monthObj?.globalTargets || {}) },
            modifiedDays: Array.isArray(monthObj?.modifiedDays) ? monthObj.modifiedDays : [],
            lastModifiedAt: monthObj?.lastModifiedAt || null,
            vacations: Array.isArray(monthObj?.vacations) ? monthObj.vacations : [],
            isClosed: !!monthObj?.isClosed,
            closedAt: monthObj?.closedAt || null,
            changeLog: Array.isArray(monthObj?.changeLog) ? monthObj.changeLog : [],
          };
        });
        // Sembrar meses base SOLO si faltan (nunca sobrescribe datos del usuario)
        if (!patchedHistory['2026-01']) patchedHistory['2026-01'] = { sellers: JAN_2026_DATA, commissions: JAN_COMMISSIONS, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null };
        if (!patchedHistory['2026-02']) patchedHistory['2026-02'] = { sellers: FEB_2026_DATA, commissions: FEB_COMMISSIONS, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null };
        setHistory(patchedHistory);
        // Si cambio la version, persistir el historial COMPLETO (no solo base) para actualizar la version sin perder datos
        if (versionChanged) {
          await DataService.saveData(patchedHistory);
          setSyncStatus('synced');
        }
      }
      setIsLoading(false);
      hydratedRef.current = true;
    };
    initData();
  }, []);

  useEffect(() => {
    if (isLoading || syncStatus === 'updating') return;
    setSyncStatus('saving');
    const timer = setTimeout(async () => { 
      const result = await DataService.saveData(history); 
      if (result.success) {
        setSyncStatus('synced');
      } else if (result.localBackup) {
        // Cloud failed but localStorage saved - show warning
        setSyncStatus('synced'); // Still show synced since localStorage has it
        console.log('[v0] Cloud save failed, but localStorage backup saved');
      }
    }, 500); // Reduced from 2000ms for faster real-time updates
    return () => clearTimeout(timer);
  }, [history, isLoading]);

const currentMonthData: MonthData = useMemo(() => {
  const withNormalizedSellers = (md: MonthData): MonthData => ({ ...md, sellers: (md.sellers || []).map(normalizeSeller) });
  if (history[monthKey]) return withNormalizedSellers(history[monthKey]);
  if (monthKey === '2026-01') return withNormalizedSellers({ sellers: JAN_2026_DATA, commissions: JAN_COMMISSIONS, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null, vacations: [] });
  if (monthKey === '2026-02') return withNormalizedSellers({ sellers: FEB_2026_DATA, commissions: FEB_COMMISSIONS, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null, vacations: [] });
  if (monthKey === '2026-03') return withNormalizedSellers({ sellers: MAR_2026_DATA, commissions: MAR_COMMISSIONS, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null, vacations: [] });
  return withNormalizedSellers({ sellers: getNewMonthTemplate(), commissions: { tigo: 0, krediya: 0, ola: 0 }, globalTargets: { ...DEFAULT_GLOBAL_TARGETS }, modifiedDays: [], lastModifiedAt: null, vacations: [] });
  }, [history, monthKey]);

  const globalTargets = useMemo<GlobalTargets>(() => currentMonthData.globalTargets || { ...DEFAULT_GLOBAL_TARGETS }, [currentMonthData]);

  // HANDLERS
  const changeMonth = (offset: number) => { const nd = new Date(currentDate); nd.setMonth(nd.getMonth() + offset); setCurrentDate(nd); setIsEditing(false); };

  const handleSellerChange = (id: number, metricKey: MetricKey | 'celulares' | 'celularesCredito' | 'creditOla' | 'creditKrediya' | 'creditOi' | 'leadCredito' | 'leadHome' | 'leadPospago' | 'utility', value: string, isTarget = false) => {
    const currentSellers = [...currentMonthData.sellers];
    const idx = currentSellers.findIndex(s => s.id === id);
    if (idx === -1) return;
    const updated = { ...currentSellers[idx] };
    const leadField = metricKey === 'leadCredito' ? 'credito' : metricKey === 'leadHome' ? 'home' : metricKey === 'leadPospago' ? 'pospago' : null;
    if (metricKey === 'celulares') { 
      updated.celulares = parseInt(value) || 0; 
    } else if (metricKey === 'celularesCredito') {
      updated.celularesCredito = parseInt(value) || 0;
    } else if (metricKey === 'utility') {
      updated.utility = safeNumber(value, 0);
    } else if (leadField) {
      const base = updated.leads || { credito: { achieved: 0, target: 0 }, home: { achieved: 0, target: 0 }, pospago: { achieved: 0, target: 0 } };
      updated.leads = { ...base, [leadField]: { ...base[leadField], [isTarget ? 'target' : 'achieved']: parseInt(value) || 0 } };
    } else if (metricKey === 'creditOla') {
      updated.creditBreakdown = { ...(updated.creditBreakdown || { ola: 0, krediya: 0, oi: 0 }), ola: parseInt(value) || 0 };
      // Update total credits achieved
      updated.metrics = { ...updated.metrics, credits: { ...updated.metrics.credits, achieved: (updated.creditBreakdown.ola || 0) + (updated.creditBreakdown.krediya || 0) + (updated.creditBreakdown.oi || 0) } };
    } else if (metricKey === 'creditKrediya') {
      updated.creditBreakdown = { ...(updated.creditBreakdown || { ola: 0, krediya: 0, oi: 0 }), krediya: parseInt(value) || 0 };
      // Update total credits achieved
      updated.metrics = { ...updated.metrics, credits: { ...updated.metrics.credits, achieved: (updated.creditBreakdown.ola || 0) + (updated.creditBreakdown.krediya || 0) + (updated.creditBreakdown.oi || 0) } };
    } else if (metricKey === 'creditOi') {
      updated.creditBreakdown = { ...(updated.creditBreakdown || { ola: 0, krediya: 0, oi: 0 }), oi: parseInt(value) || 0 };
      // Update total credits achieved
      updated.metrics = { ...updated.metrics, credits: { ...updated.metrics.credits, achieved: (updated.creditBreakdown.ola || 0) + (updated.creditBreakdown.krediya || 0) + (updated.creditBreakdown.oi || 0) } };
    }
    else { updated.metrics = { ...updated.metrics, [metricKey]: { ...updated.metrics[metricKey], [isTarget ? 'target' : 'achieved']: safeNumber(value, 0) } }; }
    currentSellers[idx] = updated;
    setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, sellers: currentSellers } }));
    if (hydratedRef.current) markModified(monthKey);
  };

  const handleSellerTypeChange = (id: number, type: SellerType) => {
    const currentSellers = [...currentMonthData.sellers];
    const idx = currentSellers.findIndex(s => s.id === id);
    if (idx === -1) return;
    const updated = { ...currentSellers[idx], sellerType: type };
    if (type === 'tigomoney' && !updated.leads) {
      updated.leads = { credito: { achieved: 0, target: 20 }, home: { achieved: 0, target: 10 }, pospago: { achieved: 0, target: 15 } };
    }
    currentSellers[idx] = updated;
    setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, sellers: currentSellers } }));
    if (hydratedRef.current) markModified(monthKey);
  };

  const handleSellerWeightUpdate = (sellerId: number, metric: MetricKey, val: number) => {
    setHistory(prev => {
      const prevMonth = prev[monthKey] || currentMonthData;
      const s = [...prevMonth.sellers];
      const idx = s.findIndex(x => x.id === sellerId);
      if (idx === -1) return prev;
      s[idx] = { ...s[idx], weights: { ...s[idx].weights, [metric]: val / 100 } };
      setSellerConfig(s[idx]);
      if (hydratedRef.current) markModified(monthKey);
      return { ...prev, [monthKey]: { ...prevMonth, sellers: s } };
    });
  };

  const handleCommissionChange = (key: keyof Commissions, value: number) => {
    setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, commissions: { ...currentMonthData.commissions, [key]: value } } }));
    if (hydratedRef.current) markModified(monthKey);
  };

const handleAddSeller = () => {
  if (!newSellerName.trim()) return;
  const newId = Math.max(0, ...currentMonthData.sellers.map(s => s.id)) + 1;
  const ns: Seller = { 
    id: newId, 
    name: newSellerName.toUpperCase().trim(), 
    celulares: 0, 
    celularesCredito: 0,
    creditBreakdown: { ola: 0, krediya: 0, oi: 0 },
    weights: { ...DEFAULT_WEIGHTS }, 
    metrics: makeMetrics({ sales: { achieved: 0, target: newSellerTargets.sales }, credits: { achieved: 0, target: newSellerTargets.credits }, accessories: { achieved: 0, target: newSellerTargets.accessories }, chips: { achieved: 0, target: newSellerTargets.chips }, epin: { achieved: 0, target: newSellerTargets.epin } }) 
  };
  setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, sellers: [...currentMonthData.sellers, ns] } }));
  setNewSellerName(''); setShowAddSeller(false);
  if (hydratedRef.current) markModified(monthKey);
};

const handleDeleteSeller = (id: number) => {
  if (!confirm('Eliminar este vendedor?')) return;
  setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, sellers: currentMonthData.sellers.filter(s => s.id !== id) } }));
  if (hydratedRef.current) markModified(monthKey);
  };
  
  // Vacation handlers
  const handleSaveVacation = (vacation: VacationEntry) => {
    const currentVacations = currentMonthData.vacations || [];
    let updatedVacations: VacationEntry[];
    if (editingVacation) {
      // Update existing
      updatedVacations = currentVacations.map(v => 
        (v.name === editingVacation.name && v.start === editingVacation.start) ? vacation : v
      );
      // If not found in saved, it was from defaults - add it
      if (!currentVacations.some(v => v.name === editingVacation.name && v.start === editingVacation.start)) {
        updatedVacations = [...currentVacations, vacation];
      }
    } else {
      // Add new
      updatedVacations = [...currentVacations, vacation];
    }
    setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, vacations: updatedVacations } }));
    setShowVacationModal(false);
    setEditingVacation(null);
    if (hydratedRef.current) markModified(monthKey);
  };
  
  const handleDeleteVacation = (vacation: VacationEntry) => {
    if (!confirm(`Eliminar vacaciones de ${vacation.name}?`)) return;
    const currentVacations = currentMonthData.vacations || [];
    // Mark as deleted by adding with special flag or simply remove
    const updatedVacations = currentVacations.filter(v => !(v.name === vacation.name && v.start === vacation.start));
    // If it was a default vacation, we need to track its deletion
    const isDefault = VACATIONS.some(v => v.name === vacation.name && v.start === vacation.start);
    if (isDefault) {
      // Add a marker to hide this default vacation
      updatedVacations.push({ ...vacation, status: 'Completado', days: 0, type: '__DELETED__' });
    }
    setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, vacations: updatedVacations } }));
    if (hydratedRef.current) markModified(monthKey);
  };

  const handleStatusChange = (id: number, newStatus: SellerStatus, reason?: ExitReason) => {
    const seller = currentMonthData.sellers.find(s => s.id === id);
    if (!seller) return;
    
    const updatedSeller: Seller = { ...seller, status: newStatus };
    const todayISO = toISODateInTZ();
    
    if (newStatus === 'inactive') {
      updatedSeller.exitDate = todayISO;
      updatedSeller.exitReason = reason || 'renuncia';
    } else if (newStatus === 'active') {
      // Reactivar - limpiar fechas de salida
      updatedSeller.exitDate = null;
      updatedSeller.exitReason = null;
      updatedSeller.suspendedUntil = null;
    } else if (newStatus === 'suspended') {
      // Por defecto suspender por 30 días
      const suspendDate = new Date();
      suspendDate.setDate(suspendDate.getDate() + 30);
      updatedSeller.suspendedUntil = suspendDate.toISOString().split('T')[0];
    }
    
    // Crear entrada en el log de cambios
    const logEntry = createChangeLogEntry('status_change', seller, 'status', seller.status || 'active', newStatus, reason || undefined);
    const existingLog = currentMonthData.changeLog || [];
    
    setHistory(prev => ({
      ...prev,
      [monthKey]: {
        ...currentMonthData,
        sellers: currentMonthData.sellers.map(s => s.id === id ? updatedSeller : s),
        changeLog: [...existingLog, logEntry]
      }
    }));
    if (hydratedRef.current) markModified(monthKey);
  };

  const handleGlobalTargetChange = (key: MetricKey, value: number) => {
    setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, globalTargets: { ...globalTargets, [key]: value } } }));
    if (hydratedRef.current) markModified(monthKey);
  };

  // PIN VERIFICATION
  const handleEditClick = () => {
    if (isEditing) {
      // Salir del modo edicion
      setIsEditing(false);
      return;
    }
    
    if (isUnlocked) {
      // Ya desbloqueado en esta sesion
      setIsEditing(true);
      return;
    }
    
    // Mostrar dialogo de PIN
    setPinInput('');
    setPinError(false);
    setShowPinDialog(true);
  };

  const handlePinSubmit = () => {
    if (pinInput === EDIT_PIN) {
      setIsUnlocked(true);
      setIsEditing(true);
      setShowPinDialog(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  // CERRAR/CONGELAR MES
  const handleCloseMonth = () => {
    if (currentMonthData.isClosed) {
      if (!confirm('Reabrir este mes para edicion?')) return;
      setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, isClosed: false, closedAt: null } }));
    } else {
      if (!confirm(`Cerrar el mes de ${dateTitle}? Esto congelara los datos y no se podran editar hasta reabrirlo.`)) return;
      setHistory(prev => ({ ...prev, [monthKey]: { ...currentMonthData, isClosed: true, closedAt: new Date().toISOString() } }));
      setIsEditing(false);
    }
    if (hydratedRef.current) markModified(monthKey);
  };

  // EXPORTAR A PDF (genera HTML para imprimir)
  const handleExportPDF = () => {
    const sorted = [...currentMonthData.sellers]
      .map(s => ({ ...s, score: calculateScore(s) }))
      .sort((a, b) => b.score - a.score);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Por favor permite popups para exportar.');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte ${dateTitle} - Digimax</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .stat { background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center; }
          .stat-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
          .stat-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #1e293b; color: white; padding: 12px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
          td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          tr:hover { background: #f8fafc; }
          .score { font-weight: bold; }
          .score-high { color: #059669; }
          .score-mid { color: #d97706; }
          .score-low { color: #dc2626; }
          .rank { width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; }
          .rank-1 { background: #fef3c7; color: #b45309; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #888; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Reporte de Ventas - ${dateTitle}</h1>
        <p class="subtitle">Generado: ${new Date().toLocaleString('es-HN')}</p>
        
        <div class="stats">
          <div class="stat"><div class="stat-label">Ventas Total</div><div class="stat-value">L.${(globalStats.sales.achieved / 1000).toFixed(0)}k</div></div>
          <div class="stat"><div class="stat-label">Meta</div><div class="stat-value">L.${(globalStats.sales.target / 1000).toFixed(0)}k</div></div>
          <div class="stat"><div class="stat-label">Progreso</div><div class="stat-value">${(globalStats.sales.target > 0 ? (globalStats.sales.achieved / globalStats.sales.target) * 100 : 0).toFixed(1)}%</div></div>
          <div class="stat"><div class="stat-label">Vendedores</div><div class="stat-value">${teamRoster.length}</div></div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Vendedor</th>
              <th>Ventas</th>
              <th>Creditos</th>
              <th>Acc</th>
              <th>Chips</th>
              <th>EPIN</th>
              <th>Cel</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((s, i) => `
              <tr>
                <td><span class="rank ${i === 0 ? 'rank-1' : ''}">${i + 1}</span></td>
                <td><strong>${s.name}</strong></td>
                <td>L.${(s.metrics.sales.achieved / 1000).toFixed(1)}k</td>
                <td>${s.metrics.credits.achieved}</td>
                <td>${s.metrics.accessories.achieved}</td>
                <td>${s.metrics.chips.achieved}</td>
                <td>L.${(s.metrics.epin.achieved / 1000).toFixed(1)}k</td>
                <td>${s.celulares}</td>
                <td class="score ${s.score >= 80 ? 'score-high' : s.score >= 50 ? 'score-mid' : 'score-low'}">${s.score.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="stats">
          <div class="stat"><div class="stat-label">TIGO</div><div class="stat-value">L.${(currentMonthData.commissions?.tigo || 0).toLocaleString()}</div></div>
          <div class="stat"><div class="stat-label">KREDIYA</div><div class="stat-value">L.${(currentMonthData.commissions?.krediya || 0).toLocaleString()}</div></div>
          <div class="stat"><div class="stat-label">OLA</div><div class="stat-value">L.${(currentMonthData.commissions?.ola || 0).toLocaleString()}</div></div>
          <div class="stat"><div class="stat-label">Comisiones Total</div><div class="stat-value">L.${globalStats.comms.toLocaleString()}</div></div>
        </div>
        
        <div class="footer">
          Digimax Sales Tracker &bull; ${currentMonthData.isClosed ? 'Mes Cerrado' : 'Mes Abierto'}
        </div>
        
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // GLOBAL STATS
  const globalStats = useMemo(() => {
    let salesSellers = 0, credits = 0, acc = 0, chips = 0, phones = 0, epin = 0;
    // Solo contar vendedores activos para el cumplimiento de tienda
    currentMonthData.sellers.filter(s => isSellerActive(s)).forEach(s => {
      salesSellers += s.metrics.sales.achieved; credits += s.metrics.credits.achieved;
      acc += s.metrics.accessories.achieved; chips += s.metrics.chips.achieved;
      epin += s.metrics.epin?.achieved || 0; phones += s.celulares || 0;
    });
    const comms = (currentMonthData.commissions?.tigo || 0) + (currentMonthData.commissions?.krediya || 0) + (currentMonthData.commissions?.ola || 0);
    return { sales: { achieved: salesSellers + comms + epin, target: globalTargets.sales }, credits: { achieved: credits, target: globalTargets.credits }, acc: { achieved: acc, target: globalTargets.accessories }, chips: { achieved: chips, target: globalTargets.chips }, epin: { achieved: epin, target: globalTargets.epin }, phones, comms };
  }, [currentMonthData, globalTargets]);

  // PACE METRICS
  const paceMetrics = useMemo(() => {
    const todayTZ = getNowInTZ();
    const dim = daysInMonthFor(currentDate);
    const isCurrentMonth = currentDate.getFullYear() === todayTZ.getFullYear() && currentDate.getMonth() === todayTZ.getMonth();
    const dayOfMonth = isCurrentMonth ? todayTZ.getDate() : (currentDate < todayTZ ? dim : 0);
    const expectedPct = dim > 0 ? (dayOfMonth / dim) * 100 : 0;
    const actualPct = globalStats.sales.target > 0 ? (globalStats.sales.achieved / globalStats.sales.target) * 100 : 0;
    const pace = actualPct - expectedPct;
    const dailyAvg = dayOfMonth > 0 ? globalStats.sales.achieved / dayOfMonth : 0;
    const remaining = Math.max(0, globalStats.sales.target - globalStats.sales.achieved);
    const daysLeft = Math.max(0, dim - dayOfMonth);
    const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : 0;
    const projected = dayOfMonth > 0 ? dailyAvg * dim : 0;
    return { dayOfMonth, dim, expectedPct, actualPct, pace, dailyAvg, dailyNeeded, remaining, daysLeft, projected, isCurrentMonth };
  }, [currentDate, globalStats]);

  const dateTitle = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const editedDaysCount = Array.isArray(currentMonthData.modifiedDays) ? currentMonthData.modifiedDays.length : 0;
  const editedToday = Array.isArray(currentMonthData.modifiedDays) ? currentMonthData.modifiedDays.includes(toISODateInTZ()) : false;
  const teamRoster = useMemo(() => getTeamRoster(monthKey), [monthKey]);
  // Combine default VACATIONS with any saved in currentMonthData
  const monthVacations = useMemo(() => {
    const defaultVacations = getVacationsForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
    const savedVacations = currentMonthData.vacations || [];
    // Merge: saved vacations override defaults by matching name+start
    const merged = [...defaultVacations];
    savedVacations.forEach(sv => {
      const existingIdx = merged.findIndex(m => m.name === sv.name && m.start === sv.start);
      if (existingIdx >= 0) merged[existingIdx] = sv;
      else merged.push(sv);
    });
    return merged.filter(v => {
      // Exclude deleted vacations
      if (v.type === '__DELETED__') return false;
      const vs = new Date(v.start + 'T00:00:00');
      const ve = new Date(v.end + 'T00:00:00');
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return vs <= monthEnd && ve >= monthStart;
    });
  }, [currentDate, currentMonthData.vacations]);
  const todayISOKey = toISODateInTZ();
  const sellersOnVacationToday = useMemo(() => {
    const today = new Date(todayISOKey + 'T00:00:00');
    return currentMonthData.sellers.filter(s => isOnVacation(s.name, today)).map(s => s.name);
  }, [currentMonthData.sellers, todayISOKey]);
  
  // Active sellers = sellers with status 'active' (or undefined) minus those on vacation today
  const activeSellers = useMemo(() => {
    const activeStatusSellers = currentMonthData.sellers.filter(s => isSellerActive(s));
    const activeNotOnVacation = activeStatusSellers.filter(s => !sellersOnVacationToday.includes(s.name));
    return activeNotOnVacation.length;
  }, [currentMonthData.sellers, sellersOnVacationToday]);
  
  // Count by status for display
  const sellerStatusCounts = useMemo(() => ({
    active: currentMonthData.sellers.filter(s => (s.status || 'active') === 'active').length,
    suspended: currentMonthData.sellers.filter(s => s.status === 'suspended').length,
    inactive: currentMonthData.sellers.filter(s => s.status === 'inactive').length,
  }), [currentMonthData.sellers]);

  const activeSellersList = useMemo(() => currentMonthData.sellers.filter(s => isSellerActive(s)), [currentMonthData.sellers]);
  const bestSales = useMemo(() => getBestPerformer(activeSellersList, 'sales'), [activeSellersList]);
  const bestCredits = useMemo(() => getBestPerformer(activeSellersList, 'credits'), [activeSellersList]);
  const bestAccessories = useMemo(() => getBestPerformer(activeSellersList, 'accessories'), [activeSellersList]);
  const bestChips = useMemo(() => getBestPerformer(activeSellersList, 'chips'), [activeSellersList]);
  const bestEpin = useMemo(() => getBestPerformer(activeSellersList, 'epin'), [activeSellersList]);
  const bestOverall = useMemo(() => getBestOverall(activeSellersList), [activeSellersList]);

  // Mostrar el popup "Vendedor del Mes" automaticamente al entrar al Panel.
  // SOLO en meses CERRADOS: que ya terminaron o que se cerraron manualmente.
  // Nunca aparece durante el mes en curso. Se muestra una vez por mes por sesion.
  useEffect(() => {
    if (isLoading || currentView !== 'dashboard') return;
    const isClosedMonth = !paceMetrics.isCurrentMonth || !!currentMonthData.isClosed;
    if (!isClosedMonth) return;
    if (shownMvpRef.current.has(monthKey)) return;
    const ranked = [...activeSellersList]
      .map(s => ({ s, score: calculateScore(s) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) return;
    shownMvpRef.current.add(monthKey);
    setMvpSeller(ranked[0].s);
    setShowMvp(true);
  }, [isLoading, currentView, monthKey, activeSellersList, paceMetrics.isCurrentMonth, currentMonthData.isClosed]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-8">
        <Image src="/logo.webp" alt="Digimax" width={140} height={45} className="opacity-80" />
        <div className="relative">
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
        <p className="text-[11px] font-semibold uppercase text-slate-400 animate-pulse tracking-[0.2em]">Conectando</p>
      </div>
    );
  }

  const DialogContentAny = DialogContent as React.ComponentType<React.HTMLAttributes<HTMLDivElement> & { className?: string }>;

  return (
    <div className="bg-slate-100 min-h-screen pb-32 font-sans text-slate-900">
      {/* POPUP VENDEDOR DEL MES */}
      <Dialog open={showMvp} onOpenChange={setShowMvp}>
        <DialogContentAny className="sm:max-w-md p-0 overflow-hidden border-0 gap-0">
          <DialogHeader className="sr-only"><DialogTitle>Vendedor del Mes</DialogTitle></DialogHeader>
          {mvpSeller && (() => {
            const mvpScore = calculateScore(mvpSeller);
            const isTigo = mvpSeller.sellerType === 'tigomoney';
            return (
              <div className="relative bg-gradient-to-b from-amber-500 to-amber-600 text-white">
                {/* Banda superior */}
                <div className="flex flex-col items-center text-center px-6 pt-8 pb-7">
                  <div className="flex items-center gap-1.5 text-amber-100 text-[11px] font-bold uppercase tracking-[0.25em] mb-4">
                    <Star className="w-3.5 h-3.5 fill-amber-200 text-amber-200" />
                    Vendedor del Mes
                    <Star className="w-3.5 h-3.5 fill-amber-200 text-amber-200" />
                  </div>
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-white/15 border-4 border-white/40 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-4xl font-black text-white">{mvpSeller.name.charAt(0)}</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
                      <Trophy className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-balance">{mvpSeller.name}</h3>
                  <p className="text-amber-100 text-xs font-semibold mt-1 capitalize">{dateTitle}</p>
                </div>
                {/* Tarjeta inferior */}
                <div className="bg-white text-slate-900 px-6 py-5 rounded-t-2xl">
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Nota Final</p>
                      <p className="text-3xl font-black text-amber-500">{mvpScore.toFixed(1)}<span className="text-lg">%</span></p>
                    </div>
                    <div className="h-12 w-px bg-slate-200" />
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Rol</p>
                      <p className="text-sm font-black text-slate-700 mt-1">{isTigo ? 'TigoMoney' : 'Piso'}</p>
                    </div>
                  </div>
                  <p className="text-center text-xs text-slate-500 mt-4 text-pretty">
                    Lidera el ranking del equipo este mes. Felicitaciones por el excelente desempeno.
                  </p>
                  <button
                    onClick={() => setShowMvp(false)}
                    className="mt-5 w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContentAny>
      </Dialog>
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image src="/logo.webp" alt="Digimax" width={100} height={32} className="object-contain" priority style={{ width: 'auto', height: 32 }} />
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${editedToday ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                <Calendar className="w-3 h-3" /> {editedDaysCount}d
              </span>
              {syncStatus === 'saving'
                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 border border-amber-200"><Cloud className="w-3 h-3 animate-pulse" /> Guardando</span>
                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Sync</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Export PDF Button */}
            <button onClick={handleExportPDF} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 hover:text-slate-700 transition-colors" title="Exportar PDF">
              <Download className="w-4 h-4" />
            </button>
            
            {/* Close/Lock Month Button */}
            <button onClick={handleCloseMonth} className={`p-2 rounded-lg transition-all ${currentMonthData.isClosed ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`} title={currentMonthData.isClosed ? 'Reabrir mes' : 'Cerrar mes'}>
              {currentMonthData.isClosed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            
            {currentView === 'dashboard' && !currentMonthData.isClosed && (
              <button onClick={handleEditClick} className={`p-2 rounded-lg text-sm transition-all ${isEditing ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : isUnlocked ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`} title={isUnlocked ? 'Desbloqueado' : 'Requiere PIN'}>
                {isEditing ? <Save className="w-4 h-4" /> : isUnlocked ? <Unlock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </button>
            )}
            
            {/* Closed Month Indicator */}
            {currentMonthData.isClosed && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Cerrado
              </span>
            )}
            
            <Dialog open={showGlobalSettings} onOpenChange={setShowGlobalSettings}>
              <DialogTrigger asChild>
                <button className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 hover:text-slate-700 transition-colors"><Target className="w-4 h-4" /></button>
              </DialogTrigger>
              <DialogContentAny className="sm:max-w-md">
                <DialogHeader><DialogTitle className="font-heading text-base">Metas de Tienda - {dateTitle}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 py-4">
                  {(Object.keys(globalTargets) as MetricKey[]).map(k => (
                    <div key={k}>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5 tracking-wide">{k}</label>
                      <input type="number" value={globalTargets[k]} onChange={e => handleGlobalTargetChange(k, parseInt(e.target.value) || 0)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg font-semibold text-slate-800 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                    </div>
                  ))}
                </div>
              </DialogContentAny>
            </Dialog>
          </div>
        </div>
      </header>

      {/* MONTH SELECTOR */}
      {currentView !== 'history' && (
        <div className="sticky top-14 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
          <div className="max-w-6xl mx-auto flex justify-center py-2.5 px-4">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-1.5 py-1">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <div className="px-5 font-bold font-heading text-slate-700 uppercase text-[13px] w-36 text-center tracking-wide">{dateTitle}</div>
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        {currentView === 'dashboard' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* HERO KPI ROW */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
              {/* Main Sales Card - Premium Design */}
              <Card className="group border-0 bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 text-white overflow-hidden col-span-2 shadow-xl shadow-slate-900/20 rounded-2xl hover:shadow-2xl hover:shadow-slate-900/30 transition-all duration-500 hover:-translate-y-1 cursor-default relative">
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-[0.03]">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-400 rounded-full blur-3xl transform translate-x-1/4 translate-y-1/4" />
                </div>
                {/* Sparkle decoration */}
                <div className="absolute top-4 right-24 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Sparkles className="w-5 h-5 text-indigo-300" />
                </div>
                <CardContent className="px-7 py-6 flex items-center justify-between gap-6 relative z-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Venta Total</p>
                      <div className={`w-2 h-2 rounded-full animate-pulse ${globalStats.sales.achieved / globalStats.sales.target >= 0.8 ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                    </div>
                    <p className="text-4xl font-black font-heading tracking-tight leading-none transition-transform duration-300 group-hover:scale-105 origin-left">
                      L. {(globalStats.sales.achieved / 1000).toFixed(0)}k
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-[12px] text-slate-400 font-medium">Meta: L. {(globalStats.sales.target / 1000).toFixed(0)}k</p>
                      <div className="h-4 w-px bg-slate-700" />
                      <p className={`text-[12px] font-bold ${paceMetrics.pace >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {paceMetrics.pace >= 0 ? '+' : ''}{paceMetrics.pace.toFixed(0)}% ritmo
                      </p>
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1 bg-slate-700/50 rounded-full mt-3 overflow-hidden max-w-48">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${globalStats.sales.achieved / globalStats.sales.target >= 1 ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'}`}
                        style={{ width: `${Math.min((globalStats.sales.achieved / globalStats.sales.target) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <ProgressRing value={globalStats.sales.achieved} max={globalStats.sales.target} size={90} strokeWidth={6} color="#818cf8" trackColor="#334155" textClass="text-white text-sm" showGlow />
                  </div>
                </CardContent>
              </Card>
              
              {/* Credits Card */}
              <Card className="group border-slate-200/80 bg-white shadow-sm rounded-2xl hover:shadow-lg hover:border-blue-200/80 transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="px-6 py-5 flex items-center justify-between gap-4 relative z-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-blue-500 transition-colors">Creditos</p>
                    </div>
                    <p className="text-2xl font-black font-heading text-slate-800 leading-none transition-transform duration-300 group-hover:scale-105 origin-left">{globalStats.credits.achieved}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">/ {globalStats.credits.target}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${globalStats.credits.achieved / globalStats.credits.target >= 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'}`}>
                        {globalStats.credits.target > 0 ? ((globalStats.credits.achieved / globalStats.credits.target) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                    <ProgressRing value={globalStats.credits.achieved} max={globalStats.credits.target} size={64} strokeWidth={5} color="#3b82f6" showGlow />
                  </div>
                </CardContent>
              </Card>
              
              {/* Accessories Card */}
              <Card className="group border-slate-200/80 bg-white shadow-sm rounded-2xl hover:shadow-lg hover:border-amber-200/80 transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="px-6 py-5 flex items-center justify-between gap-4 relative z-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-amber-500 transition-colors">Accesorios</p>
                    </div>
                    <p className="text-2xl font-black font-heading text-slate-800 leading-none transition-transform duration-300 group-hover:scale-105 origin-left">{globalStats.acc.achieved}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">/ {globalStats.acc.target}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${globalStats.acc.achieved / globalStats.acc.target >= 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                        {globalStats.acc.target > 0 ? ((globalStats.acc.achieved / globalStats.acc.target) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 transition-transform duration-300 group-hover:scale-110">
                    <ProgressRing value={globalStats.acc.achieved} max={globalStats.acc.target} size={64} strokeWidth={5} color="#f59e0b" showGlow />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SECONDARY KPIs - Enhanced Grid */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <MiniKPI icon={<Wifi className="w-3.5 h-3.5 text-purple-500" />} label="Chips" value={globalStats.chips.achieved} target={globalStats.chips.target} />
              <MiniKPI icon={<Smartphone className="w-3.5 h-3.5 text-blue-500" />} label="Celulares" value={globalStats.phones} />
              <MiniKPI icon={<Calculator className="w-3.5 h-3.5 text-emerald-500" />} label="Comisiones" value={globalStats.comms} isMoney />
              {/* Enhanced Activos KPI with status breakdown */}
              <div className="group bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md hover:border-indigo-200/80 transition-all duration-300 hover:-translate-y-0.5 cursor-default">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <Users className="w-3.5 h-3.5 text-indigo-500 transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Activos</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-black font-heading leading-none text-slate-800 transition-all duration-300 group-hover:scale-105 origin-left">
                    {activeSellers}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">/{sellerStatusCounts.active}</span>
                </div>
                {/* Status breakdown badges */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {sellerStatusCounts.active}
                  </span>
                  {sellerStatusCounts.suspended > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-0.5">
                      <Pause className="w-2 h-2" /> {sellerStatusCounts.suspended}
                    </span>
                  )}
                  {sellerStatusCounts.inactive > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-0.5">
                      <UserX className="w-2 h-2" /> {sellerStatusCounts.inactive}
                    </span>
                  )}
                </div>
              </div>
              <MiniKPI icon={<Clock className="w-3.5 h-3.5 text-amber-500" />} label="Dia" value={paceMetrics.dayOfMonth} suffix={`/${paceMetrics.dim}`} />
              <MiniKPI icon={<Activity className="w-3.5 h-3.5" />} label="Ritmo" value={Number(paceMetrics.pace.toFixed(0))} suffix="%" isStatus />
            </div>

            {/* PACE ANALYSIS */}
            {paceMetrics.isCurrentMonth && (
              <Card className={`border-0 shadow-sm ${paceMetrics.pace >= 0 ? 'bg-emerald-50/70' : 'bg-amber-50/70'}`}>
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${paceMetrics.pace >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {paceMetrics.pace >= 0 ? <Flame className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider mb-0.5">Promedio Diario</p>
                      <p className="text-sm font-black font-heading text-slate-800">L. {(paceMetrics.dailyAvg / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider mb-0.5">Necesario/dia</p>
                      <p className="text-sm font-black font-heading text-slate-800">L. {(paceMetrics.dailyNeeded / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider mb-0.5">Proyeccion Mes</p>
                      <p className={`text-sm font-black font-heading ${paceMetrics.projected >= globalStats.sales.target ? 'text-emerald-600' : 'text-amber-600'}`}>
                        L. {(paceMetrics.projected / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider mb-0.5">Faltan</p>
                      <p className="text-sm font-black font-heading text-slate-800">L. {(paceMetrics.remaining / 1000).toFixed(0)}k <span className="text-slate-400 text-[10px] font-medium">({paceMetrics.daysLeft}d)</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* VACACIONES DEL MES */}
            <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-amber-50/60 border-b border-amber-100 py-3.5 px-6">
                <CardTitle className="text-[11px] font-bold font-heading uppercase text-amber-700 tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Vacaciones del Mes</span>
                  <div className="flex items-center gap-2">
                    {monthVacations.length > 0 && <span className="text-[10px] font-semibold bg-amber-100 text-amber-600 px-2.5 py-0.5 rounded-full">{monthVacations.length} {monthVacations.length === 1 ? 'persona' : 'personas'}</span>}
                    <button onClick={() => setShowVacationModal(true)} className="text-[10px] font-bold bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 transition-colors flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {monthVacations.length === 0 ? (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">
                    No hay vacaciones programadas este mes
                  </div>
                ) : (
                <div className="divide-y divide-slate-100">
                  {monthVacations.map((v, i) => {
                    const daysThisMonth = getVacationDaysInMonth(v, currentDate.getFullYear(), currentDate.getMonth() + 1);
                    const isActive = sellersOnVacationToday.includes(v.name);
                    return (
                      <div key={i} className={`flex items-center gap-4 px-6 py-3.5 ${isActive ? 'bg-amber-50/40' : ''}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          v.status === 'Completado' ? 'bg-slate-100 text-slate-400' :
                          v.status === 'En Curso' ? 'bg-amber-100 text-amber-600' :
                          'bg-blue-50 text-blue-400'
                        }`}>
                          {v.status === 'En Curso' ? <Activity className="w-4 h-4" /> : v.status === 'Completado' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-heading text-slate-800">{v.name}</span>
                            {isActive && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 tracking-wide">Ausente hoy</span>}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{v.type}</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                            {new Date(v.start + 'T00:00:00').toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })} - {new Date(v.end + 'T00:00:00').toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold font-heading text-slate-700">{daysThisMonth}d</p>
                            <p className={`text-[10px] font-semibold ${
                              v.status === 'Completado' ? 'text-slate-400' :
                              v.status === 'En Curso' ? 'text-amber-500' :
                              'text-blue-400'
                            }`}>{v.status}</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button onClick={() => { setEditingVacation(v); setShowVacationModal(true); }} className="text-slate-400 hover:text-blue-500 transition-colors p-1">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteVacation(v)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
                {/* Team summary footer */}
                <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    <span>Equipo este mes: <strong className="text-slate-700">{currentMonthData.sellers.filter(s => (s.status || 'active') === 'active').length}</strong> vendedores</span>
                  </div>
                  {sellersOnVacationToday.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{sellersOnVacationToday.length} en vacaciones hoy</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CHANGE LOG (collapsed by default) */}
            {(currentMonthData.changeLog?.length ?? 0) > 0 && (
              <details className="group">
                <summary className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-400 cursor-pointer hover:text-slate-600 transition-colors py-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Historial de Cambios ({currentMonthData.changeLog?.length})</span>
                  <ChevronDown className="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
                </summary>
                <Card className="border-slate-200/80 bg-white shadow-sm rounded-xl overflow-hidden mt-2">
                  <CardContent className="p-0 max-h-48 overflow-y-auto">
                    <div className="divide-y divide-slate-100">
                      {[...(currentMonthData.changeLog || [])].reverse().slice(0, 20).map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            entry.action === 'status_change' ? 'bg-amber-100 text-amber-600' :
                            entry.action === 'delete' ? 'bg-red-100 text-red-600' :
                            entry.action === 'create' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {entry.action === 'status_change' ? <Activity className="w-3 h-3" /> :
                             entry.action === 'delete' ? <Trash2 className="w-3 h-3" /> :
                             entry.action === 'create' ? <UserPlus className="w-3 h-3" /> :
                             <Edit3 className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-700">{entry.sellerName}</span>
                            <span className="text-slate-400 ml-1.5">
                              {entry.action === 'status_change' && entry.field === 'status' ? `cambio a ${entry.newValue}` : 
                               entry.action === 'delete' ? 'eliminado' :
                               entry.action === 'create' ? 'creado' :
                               `${entry.field}: ${entry.oldValue} → ${entry.newValue}`}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-300 shrink-0">
                            {new Date(entry.timestamp).toLocaleDateString('es-HN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </details>
            )}

            {/* BEST PERFORMERS */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <BestCard title="Mejor Ventas" data={bestSales} icon={<Zap className="w-3.5 h-3.5" />} color="text-emerald-600" bgColor="bg-emerald-50/80" />
              <BestCard title="Mejor Creditos" data={bestCredits} icon={<Star className="w-3.5 h-3.5" />} color="text-blue-600" bgColor="bg-blue-50/80" />
              <BestCard title="Mejor Accesorios" data={bestAccessories} icon={<Award className="w-3.5 h-3.5" />} color="text-amber-600" bgColor="bg-amber-50/80" />
              <BestCard title="Mejor Chips" data={bestChips} icon={<Wifi className="w-3.5 h-3.5" />} color="text-cyan-600" bgColor="bg-cyan-50/80" />
              {(globalStats.epin.achieved > 0 || globalStats.epin.target > 0) && <BestCard title="Mejor EPIN" data={bestEpin} icon={<Zap className="w-3.5 h-3.5" />} color="text-purple-600" bgColor="bg-purple-50/80" />}
              <BestCard title="Rendimiento" data={bestOverall ? { name: bestOverall.name, pct: bestOverall.score } : null} icon={<Trophy className="w-3.5 h-3.5" />} color="text-indigo-600" bgColor="bg-indigo-50/80" isGlobal />
            </div>

            {/* SELLER CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...currentMonthData.sellers]
                .sort((a, b) => ((b.metrics.sales.achieved || 0) + (b.metrics.epin?.achieved || 0)) - ((a.metrics.sales.achieved || 0) + (a.metrics.epin?.achieved || 0)))
                .map(seller => (
                  <SellerCard key={seller.id} seller={seller} isEditing={isEditing} onChange={handleSellerChange} onDelete={handleDeleteSeller} onOpenConfig={() => setSellerConfig(seller)} onStatusChange={handleStatusChange} onSellerTypeChange={handleSellerTypeChange} />
                ))}
              {isEditing && (
                <button onClick={() => setShowAddSeller(true)} className="h-full min-h-[120px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-500 transition-all">
                  <UserPlus className="w-7 h-7 mb-1.5" />
                  <span className="font-bold uppercase text-[10px] tracking-widest">Nuevo Vendedor</span>
                </button>
              )}
            </div>

            {/* STORE TABLE */}
            <Card className="shadow-sm overflow-hidden border-slate-200/80 bg-white">
              <CardHeader className="bg-slate-800 text-white py-4 px-6">
                <CardTitle className="text-xs font-bold font-heading uppercase tracking-wider flex justify-between items-center">
                  <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-slate-400" /> Resultados Tienda</span>
                  <span className="text-[10px] bg-white/10 px-2.5 py-1 rounded-full font-medium">{dateTitle}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs font-bold text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[10px]">
                    <tr><th className="px-5 py-3 text-left">KPI</th><th className="px-5 py-3 text-right">Real</th><th className="px-5 py-3 text-center">Meta</th><th className="px-5 py-3 text-right">%</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <GlobalRow label="Ventas Totales" val={globalStats.sales.achieved} goal={globalStats.sales.target} isMoney />
                    <GlobalRow label="Creditos" val={globalStats.credits.achieved} goal={globalStats.credits.target} />
                    <GlobalRow label="Accesorios" val={globalStats.acc.achieved} goal={globalStats.acc.target} />
                    <GlobalRow label="Chips" val={globalStats.chips.achieved} goal={globalStats.chips.target} />
                    {(globalStats.epin.target > 0 || globalStats.epin.achieved > 0) && <GlobalRow label="EPIN" val={globalStats.epin.achieved} goal={globalStats.epin.target} isMoney />}
                  </tbody>
                </table>
                <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Calculator className="w-5 h-5 text-slate-500" />
                    <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Comisiones Extra</div>
                  </div>
                  <div className="text-xl font-black font-heading text-emerald-400">L. {globalStats.comms.toLocaleString()}</div>
                </div>
                {isEditing && (
                  <div className="p-4 bg-slate-50 grid grid-cols-3 gap-3 border-t border-slate-200">
                    <CommissionInput label="Tigo" val={currentMonthData.commissions.tigo} onChange={(v: number) => handleCommissionChange('tigo', v)} />
                    <CommissionInput label="Krediya" val={currentMonthData.commissions.krediya} onChange={(v: number) => handleCommissionChange('krediya', v)} />
                    <CommissionInput label="Ola" val={currentMonthData.commissions.ola} onChange={(v: number) => handleCommissionChange('ola', v)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'compare' && <ComparativeView sellers={currentMonthData.sellers} monthName={dateTitle} />}
        {currentView === 'ai' && <AIInsightsView sellers={currentMonthData.sellers} globalStats={globalStats} currentDate={currentDate} paceMetrics={paceMetrics} />}
        {currentView === 'history' && <HistoricalView history={history} />}
      </div>

      {/* NAV MOBILE */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-6 py-2.5 flex justify-between items-center z-50 md:hidden">
        <NavButton icon={<LayoutDashboard />} label="Panel" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <NavButton icon={<Trophy />} label="Ranking" active={currentView === 'compare'} onClick={() => setCurrentView('compare')} />
        <NavButton icon={<BrainCircuit />} label="IA" active={currentView === 'ai'} onClick={() => setCurrentView('ai')} color="text-indigo-600" />
        <NavButton icon={<History />} label="Historial" active={currentView === 'history'} onClick={() => setCurrentView('history')} />
        <Link href="/vendedores" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-700 transition-all group">
          <Users className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="text-[9px] font-semibold uppercase tracking-wide">Equipo</span>
        </Link>
        <Link href="/reporte" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-700 transition-all group">
          <Printer className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="text-[9px] font-semibold uppercase tracking-wide">Reporte</span>
        </Link>
      </nav>
      {/* NAV DESKTOP */}
      <nav className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-900/5 rounded-2xl px-8 py-3 items-center gap-8 z-50">
        <NavButton icon={<LayoutDashboard />} label="Panel" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <NavButton icon={<Trophy />} label="Ranking" active={currentView === 'compare'} onClick={() => setCurrentView('compare')} />
        <div className="w-px h-5 bg-slate-200" />
        <NavButton icon={<BrainCircuit />} label="IA" active={currentView === 'ai'} onClick={() => setCurrentView('ai')} color="text-indigo-600" />
        <div className="w-px h-5 bg-slate-200" />
        <NavButton icon={<History />} label="Historial" active={currentView === 'history'} onClick={() => setCurrentView('history')} />
        <div className="w-px h-5 bg-slate-200" />
        <Link href="/vendedores" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-700 transition-all group">
          <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-semibold uppercase tracking-wide">Equipo</span>
        </Link>
        <div className="w-px h-5 bg-slate-200" />
        <Link href="/reporte" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-700 transition-all group">
          <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-semibold uppercase tracking-wide">Reporte</span>
        </Link>
      </nav>

      {/* MODALS */}
      {sellerConfig && (() => {
        const totalWeight = Math.round(Object.values(sellerConfig.weights || {}).reduce((a, b) => a + b, 0) * 100);
        const isValid = totalWeight === 100;
        const isClose = totalWeight >= 95 && totalWeight <= 105;
        const effectiveWeights = getEffectiveWeights(sellerConfig);
        
        // Presets de ponderacion
        const PRESETS = {
          standard: { name: 'Estandar', weights: { sales: 0.45, credits: 0.20, accessories: 0.20, chips: 0.15, epin: 0.0 } },
          epinFocus: { name: 'EPIN Focus', weights: { sales: 0.35, credits: 0.15, accessories: 0.15, chips: 0.10, epin: 0.25 } },
          salesHeavy: { name: 'Ventas Heavy', weights: { sales: 0.60, credits: 0.15, accessories: 0.15, chips: 0.10, epin: 0.0 } },
          balanced: { name: 'Balanceado', weights: { sales: 0.25, credits: 0.25, accessories: 0.25, chips: 0.25, epin: 0.0 } },
        };
        
        const applyPreset = (preset: keyof typeof PRESETS) => {
          const weights = PRESETS[preset].weights;
          Object.entries(weights).forEach(([k, v]) => {
            handleSellerWeightUpdate(sellerConfig.id, k as MetricKey, Math.round(v * 100));
          });
        };
        
        const autoBalance = () => {
          const current = sellerConfig.weights || DEFAULT_WEIGHTS;
          const total = Object.values(current).reduce((a, b) => a + b, 0);
          if (total === 0) return;
          const scale = 1 / total;
          Object.entries(current).forEach(([k, v]) => {
            handleSellerWeightUpdate(sellerConfig.id, k as MetricKey, Math.round(v * scale * 100));
          });
        };
        
        return (
          <Dialog open={!!sellerConfig} onOpenChange={() => setSellerConfig(null)}>
            <DialogContentAny className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 uppercase tracking-widest text-slate-800 font-heading">
                  <Scale className="w-5 h-5 text-indigo-600" /> KPIs: {sellerConfig.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                {/* Semaforo de validacion */}
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${isValid ? 'bg-emerald-50 border-emerald-200' : isClose ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`w-4 h-4 rounded-full shrink-0 ${isValid ? 'bg-emerald-500' : isClose ? 'bg-amber-400' : 'bg-red-500'}`} />
                  <span className={`text-xs font-bold ${isValid ? 'text-emerald-700' : isClose ? 'text-amber-700' : 'text-red-700'}`}>
                    {isValid ? 'Pesos correctos (100%)' : isClose ? `Casi listo (${totalWeight}%) - ajusta para llegar a 100%` : `Pesos invalidos (${totalWeight}%) - debe sumar 100%`}
                  </span>
                </div>
                
                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 w-full">Presets:</span>
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <button key={key} onClick={() => applyPreset(key as keyof typeof PRESETS)} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                      {preset.name}
                    </button>
                  ))}
                  <button onClick={autoBalance} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Auto-Balance
                  </button>
                </div>
                
                {/* Sliders */}
                {(['sales', 'credits', 'accessories', 'chips', 'epin'] as MetricKey[]).map(k => {
                  const val = Math.round((sellerConfig.weights?.[k] ?? 0) * 100);
                  const effectiveVal = Math.round(effectiveWeights[k] * 100);
                  const hasTarget = (sellerConfig.metrics[k]?.target ?? 0) > 0;
                  const labelMap: Record<MetricKey, string> = { sales: 'Ventas', credits: 'Creditos', accessories: 'Accesorios', chips: 'Chips', epin: 'EPIN' };
                  return (
                    <div key={k} className={`${!hasTarget && k === 'epin' ? 'opacity-50' : ''}`}>
                      <div className="flex justify-between text-xs font-bold uppercase text-slate-500 mb-1">
                        <span className="flex items-center gap-1.5">
                          {labelMap[k]}
                          {!hasTarget && <span className="text-[9px] font-normal text-slate-400">(sin meta)</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-900">{val}%</span>
                          {val !== effectiveVal && <span className="text-indigo-500 text-[10px]">efectivo: {effectiveVal}%</span>}
                        </span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={val} onChange={e => handleSellerWeightUpdate(sellerConfig.id, k, parseInt(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                  );
                })}
                
                {/* Total con semaforo */}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-slate-400">Total</span>
                    <div className="flex gap-1">
                      <div className={`w-2 h-2 rounded-full ${totalWeight < 95 ? 'bg-red-500' : 'bg-slate-200'}`} />
                      <div className={`w-2 h-2 rounded-full ${totalWeight >= 95 && totalWeight <= 105 && totalWeight !== 100 ? 'bg-amber-400' : 'bg-slate-200'}`} />
                      <div className={`w-2 h-2 rounded-full ${totalWeight === 100 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    </div>
                  </div>
                  <span className={`text-xl font-black ${isValid ? 'text-emerald-600' : isClose ? 'text-amber-500' : 'text-red-500'}`}>
                    {totalWeight}%
                  </span>
                </div>
              </div>
            </DialogContentAny>
          </Dialog>
        );
      })()}
      <Dialog open={showAddSeller} onOpenChange={setShowAddSeller}>
        <DialogContentAny>
          <DialogHeader><DialogTitle className="font-heading">Nuevo Vendedor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <input className="w-full border border-slate-200 p-3 rounded-lg font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Nombre del Vendedor" value={newSellerName} onChange={e => setNewSellerName(e.target.value)} />
            <Button onClick={handleAddSeller} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-lg font-bold">Crear</Button>
          </div>
        </DialogContentAny>
      </Dialog>

      {/* VACATION MODAL */}
      <Dialog open={showVacationModal} onOpenChange={(open) => { setShowVacationModal(open); if (!open) setEditingVacation(null); }}>
        <DialogContentAny>
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Calendar className="w-5 h-5 text-amber-600" /> {editingVacation ? 'Editar' : 'Agregar'} Vacaciones</DialogTitle></DialogHeader>
          <VacationForm 
            editingVacation={editingVacation}
            sellers={currentMonthData.sellers.filter(s => (s.status || 'active') === 'active')}
            onSave={handleSaveVacation}
          />
        </DialogContentAny>
      </Dialog>

      {/* PIN DIALOG */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContentAny className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" /> Modo Edicion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">Ingresa el PIN de seguridad para habilitar el modo de edicion.</p>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className={`w-full border p-4 rounded-xl font-mono text-2xl text-center tracking-[0.5em] outline-none transition-all ${pinError ? 'border-red-400 bg-red-50 text-red-600 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}`}
                placeholder="----"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
                autoFocus
              />
              {pinError && (
                <p className="text-red-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> PIN incorrecto. Intenta de nuevo.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowPinDialog(false)} variant="outline" className="flex-1 h-12">Cancelar</Button>
              <Button onClick={handlePinSubmit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 font-bold">
                <Unlock className="w-4 h-4 mr-2" /> Desbloquear
              </Button>
            </div>
          </div>
        </DialogContentAny>
      </Dialog>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const MiniKPI = ({ icon, label, value, target, isMoney, suffix, isStatus }: { icon: React.ReactNode; label: string; value: number; target?: number; isMoney?: boolean; suffix?: string; isStatus?: boolean }) => {
  const pct = target && target > 0 ? (value / target) * 100 : 0;
  const isComplete = pct >= 100;
  
  return (
    <div className="group bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-300 hover:-translate-y-0.5 cursor-default">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-500 transition-colors">
          <span className="transition-transform duration-300 group-hover:scale-110">{icon}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        </div>
        {target !== undefined && target > 0 && !suffix && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all ${isComplete ? 'bg-emerald-100 text-emerald-600' : pct >= 50 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <p className={`text-lg font-black font-heading leading-none transition-all duration-300 group-hover:scale-105 origin-left ${isStatus ? (value >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-slate-800'}`}>
          {isMoney ? `L.${(value / 1000).toFixed(0)}k` : value}{suffix || ''}
        </p>
        {target !== undefined && target > 0 && !suffix && (
          <span className="text-[10px] text-slate-400 font-medium">/{target}</span>
        )}
      </div>
      {target !== undefined && target > 0 && !suffix && (
        <div className="h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${isComplete ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-500'}`} 
            style={{ width: `${Math.min(pct, 100)}%` }} 
          />
        </div>
      )}
    </div>
  );
};

const BestCard = ({ title, data, icon, color, bgColor, isGlobal }: { title: string; data: { name: string; pct: number } | null; icon: React.ReactNode; color: string; bgColor: string; isGlobal?: boolean }) => (
  <div className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${isGlobal ? `${bgColor} border-indigo-200/60` : `bg-white border-slate-200/80`}`}>
    <div className={`flex items-center gap-1.5 ${color} mb-2.5`}>{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{title}</span></div>
    <p className="font-bold text-slate-800 text-[13px] truncate leading-snug">{data ? data.name : '--'}</p>
    <p className={`text-lg font-black font-heading mt-1 leading-none ${data && data.pct >= 100 ? 'text-emerald-600' : color}`}>{data ? `${data.pct.toFixed(1)}%` : '0%'}</p>
  </div>
);

const NavButton = ({ icon, label, active, onClick, color }: { icon: React.ReactElement; label: string; active: boolean; onClick: () => void; color?: string }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 transition-all group ${active ? (color || 'text-slate-900') : 'text-slate-400 hover:text-slate-700'}`}>
    {React.cloneElement(icon, { className: `w-5 h-5 transition-transform group-hover:scale-110 ${active ? 'scale-110' : ''}` })}
    <span className={`text-[9px] font-semibold uppercase tracking-wide ${active ? 'text-current' : ''}`}>{label}</span>
  </button>
);

const CommissionInput = ({ label, val, onChange }: { label: string; val: number; onChange: (v: number) => void }) => (
  <div className="bg-white p-2.5 rounded-lg border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
    <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">{label}</label>
    <div className="flex items-center"><span className="text-slate-400 text-xs mr-1">L.</span><input type="number" value={val} onChange={e => onChange(parseInt(e.target.value) || 0)} className="w-full font-black text-slate-800 text-sm outline-none bg-transparent" /></div>
  </div>
);

  const SellerCard = ({ seller, isEditing, onChange, onDelete, onOpenConfig, onStatusChange, onSellerTypeChange }: {
  seller: Seller; 
  isEditing: boolean; 
  onChange: (id: number, metricKey: MetricKey | 'celulares' | 'celularesCredito' | 'creditOla' | 'creditKrediya' | 'creditOi' | 'leadCredito' | 'leadHome' | 'leadPospago' | 'utility', value: string, isTarget?: boolean) => void; 
  onDelete: (id: number) => void; 
  onOpenConfig: () => void;
    onStatusChange?: (id: number, status: SellerStatus, reason?: ExitReason) => void;
    onSellerTypeChange?: (id: number, type: SellerType) => void;
}) => {
  const score = calculateScore(seller);
  const [open, setOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const totalSales = (seller.metrics.sales.achieved || 0) + (seller.metrics.epin?.achieved || 0);
  const isActive = isSellerActive(seller);
  const statusInfo = getSellerStatusLabel(seller);
  
  const scoreColor = !isActive ? 'text-slate-400 bg-slate-100' : 
    score >= 100 ? 'text-emerald-600 bg-emerald-50' : 
    score >= 80 ? 'text-blue-600 bg-blue-50' : 
    score >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
  const barColor = !isActive ? 'bg-slate-300' :
    score >= 100 ? 'bg-emerald-500' : score >= 80 ? 'bg-blue-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md shadow-sm ${!isActive ? 'border-slate-200 opacity-60' : 'border-slate-200/80'}`}>
      <div onClick={() => setOpen(!open)} className="p-4 flex justify-between items-center cursor-pointer group">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black font-heading shrink-0 ${scoreColor}`}>
              {!isActive ? <Pause className="w-4 h-4" /> : score.toFixed(0)}
            </div>
            {seller.status === 'suspended' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
            )}
            {seller.status === 'inactive' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border-2 border-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={`font-bold font-heading text-sm truncate ${!isActive ? 'text-slate-400' : 'text-slate-800'}`}>{seller.name}</h4>
              {seller.sellerType === 'tigomoney' && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">TigoMoney</span>}
              {!isActive && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusInfo.bg} ${statusInfo.color}`}>{statusInfo.label}</span>}
              {isEditing && (
                <div className="relative">
                  <button onClick={e => { e.stopPropagation(); setStatusMenuOpen(!statusMenuOpen); }} className="bg-slate-100 p-1 rounded hover:bg-slate-200 transition-colors">
                    <MoreVertical className="w-3 h-3 text-slate-500" />
                  </button>
                  {statusMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { onOpenConfig(); setStatusMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5 text-slate-400" /> Configurar KPIs
                      </button>
                      <button onClick={() => { onSellerTypeChange?.(seller.id, seller.sellerType === 'tigomoney' ? 'piso' : 'tigomoney'); setStatusMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 flex items-center gap-2 text-purple-600">
                        <RefreshCw className="w-3.5 h-3.5" /> {seller.sellerType === 'tigomoney' ? 'Marcar como Ventas (Piso)' : 'Marcar como TigoMoney'}
                      </button>
                      <div className="border-t border-slate-100 my-1" />
                      {seller.status !== 'active' && (
                        <button onClick={() => { onStatusChange?.(seller.id, 'active'); setStatusMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2 text-emerald-600">
                          <RotateCcw className="w-3.5 h-3.5" /> Reactivar
                        </button>
                      )}
                      {seller.status !== 'suspended' && (
                        <button onClick={() => { onStatusChange?.(seller.id, 'suspended'); setStatusMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 flex items-center gap-2 text-amber-600">
                          <Pause className="w-3.5 h-3.5" /> Suspender
                        </button>
                      )}
                      {seller.status !== 'inactive' && (
                        <button onClick={() => { onStatusChange?.(seller.id, 'inactive', 'renuncia'); setStatusMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600">
                          <UserX className="w-3.5 h-3.5" /> Dar de baja
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 bg-slate-100 rounded-full flex-1 max-w-24 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(score, 100)}%` }} /></div>
              <span className="text-[10px] font-semibold text-slate-400">{(totalSales / 1000).toFixed(1)}k</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {isEditing ? (
            <div className="flex flex-col items-end">
              <label className="text-[8px] font-bold uppercase text-emerald-600 tracking-wider mb-0.5">Utilidad %</label>
              <div className="flex items-center gap-0.5">
                <input
                  className="w-16 border border-emerald-200 rounded text-right px-1.5 py-0.5 text-emerald-700 font-bold text-xs bg-emerald-50/50 focus:border-emerald-500 outline-none"
                  value={seller.utility || 0}
                  onChange={e => onChange(seller.id, 'utility', e.target.value)}
                />
                <span className="text-emerald-600 font-bold text-xs">%</span>
              </div>
            </div>
          ) : (seller.utility || 0) > 0 ? (
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Utilidad</span>
              <span className="text-sm font-black text-emerald-600">{Number(seller.utility).toLocaleString()}%</span>
            </div>
          ) : null}
          <ChevronDown className={`text-slate-300 w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} onClick={() => setOpen(!open)} />
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 animate-in slide-in-from-top-2">
          {seller.exitDate && (
            <div className="bg-red-50 text-red-600 text-[10px] font-medium px-2 py-1.5 rounded flex items-center gap-1.5">
              <UserX className="w-3 h-3" />
              <span>Baja: {seller.exitDate} {seller.exitReason ? `- ${EXIT_REASON_LABELS[seller.exitReason] || seller.exitReason}` : ''}</span>
            </div>
          )}
          <MetricRow label="Ventas" val={seller.metrics.sales.achieved} target={seller.metrics.sales.target} isMoney onChange={v => onChange(seller.id, 'sales', v)} onTargetChange={v => onChange(seller.id, 'sales', v, true)} isEditing={isEditing} />
          <MetricRow label="Creditos" val={seller.metrics.credits.achieved} target={seller.metrics.credits.target} onChange={v => onChange(seller.id, 'credits', v)} onTargetChange={v => onChange(seller.id, 'credits', v, true)} isEditing={isEditing} />
          {/* Credit breakdown by financiera */}
          {isEditing && (
            <div className="bg-slate-50 rounded-lg p-2.5 space-y-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Desglose por Financiera</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-purple-600 uppercase block mb-0.5">OLA</label>
                  <input className="w-full border border-slate-200 rounded text-center text-slate-800 font-bold text-xs py-1 focus:border-purple-500 outline-none" value={seller.creditBreakdown?.ola || 0} onChange={e => onChange(seller.id, 'creditOla', e.target.value)} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-emerald-600 uppercase block mb-0.5">KREDIYA</label>
                  <input className="w-full border border-slate-200 rounded text-center text-slate-800 font-bold text-xs py-1 focus:border-emerald-500 outline-none" value={seller.creditBreakdown?.krediya || 0} onChange={e => onChange(seller.id, 'creditKrediya', e.target.value)} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-blue-600 uppercase block mb-0.5">OI</label>
                  <input className="w-full border border-slate-200 rounded text-center text-slate-800 font-bold text-xs py-1 focus:border-blue-500 outline-none" value={seller.creditBreakdown?.oi || 0} onChange={e => onChange(seller.id, 'creditOi', e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {/* Show credit breakdown summary when not editing */}
          {!isEditing && ((seller.creditBreakdown?.ola || 0) + (seller.creditBreakdown?.krediya || 0) + (seller.creditBreakdown?.oi || 0)) > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">Desglose:</span>
              {seller.creditBreakdown?.ola > 0 && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-bold">OLA: {seller.creditBreakdown.ola}</span>}
              {seller.creditBreakdown?.krediya > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold">KREDIYA: {seller.creditBreakdown.krediya}</span>}
              {seller.creditBreakdown?.oi > 0 && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-bold">OI: {seller.creditBreakdown.oi}</span>}
            </div>
          )}
          {/* KPI de Leads para vendedor transaccional (TigoMoney) */}
          {seller.sellerType === 'tigomoney' && (
            <div className="bg-purple-50/60 border border-purple-100 rounded-lg p-2.5 space-y-2">
              <p className="text-[9px] font-bold uppercase text-purple-500 tracking-wider">Personas Generadas con Interes</p>
              <MetricRow label="Credito" val={seller.leads?.credito.achieved || 0} target={seller.leads?.credito.target || 0} onChange={v => onChange(seller.id, 'leadCredito', v)} onTargetChange={v => onChange(seller.id, 'leadCredito', v, true)} isEditing={isEditing} />
              <MetricRow label="Home" val={seller.leads?.home.achieved || 0} target={seller.leads?.home.target || 0} onChange={v => onChange(seller.id, 'leadHome', v)} onTargetChange={v => onChange(seller.id, 'leadHome', v, true)} isEditing={isEditing} />
              <MetricRow label="Pospago" val={seller.leads?.pospago.achieved || 0} target={seller.leads?.pospago.target || 0} onChange={v => onChange(seller.id, 'leadPospago', v)} onTargetChange={v => onChange(seller.id, 'leadPospago', v, true)} isEditing={isEditing} />
            </div>
          )}
          {seller.sellerType === 'tigomoney' && (
            <p className="text-[9px] text-slate-400 italic -mt-1">Metas de venta simbolicas (no afectan el KPI).</p>
          )}
          <MetricRow label="Accesorios" val={seller.metrics.accessories.achieved} target={seller.metrics.accessories.target} onChange={v => onChange(seller.id, 'accessories', v)} onTargetChange={v => onChange(seller.id, 'accessories', v, true)} isEditing={isEditing} />
          <MetricRow label="Chips" val={seller.metrics.chips.achieved} target={seller.metrics.chips.target} onChange={v => onChange(seller.id, 'chips', v)} onTargetChange={v => onChange(seller.id, 'chips', v, true)} isEditing={isEditing} />
          <MetricRow label="EPIN" val={seller.metrics.epin.achieved} target={seller.metrics.epin.target} isMoney onChange={v => onChange(seller.id, 'epin', v)} onTargetChange={v => onChange(seller.id, 'epin', v, true)} isEditing={isEditing} />
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                <Smartphone className="w-3.5 h-3.5" /><span>Cel:</span>
                {isEditing ? <input className="w-14 border rounded text-center text-slate-800 font-black" value={seller.celulares} onChange={e => onChange(seller.id, 'celulares', e.target.value)} /> : <span className="text-slate-800 font-black">{seller.celulares}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                <span className="text-blue-500">Cred:</span>
                {isEditing ? <input className="w-14 border border-blue-200 rounded text-center text-blue-600 font-black bg-blue-50/50" value={seller.celularesCredito || 0} onChange={e => onChange(seller.id, 'celularesCredito', e.target.value)} /> : <span className="text-blue-600 font-black">{seller.celularesCredito || 0}</span>}
              </div>
            </div>
            {isEditing && <button onClick={() => onDelete(seller.id)} className="text-red-500 text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"><Trash2 className="w-3 h-3" /> Eliminar</button>}
          </div>
          {/* Tasa de conversion a credito: creditos hechos / celulares elegibles */}
          {!isEditing && (seller.celularesCredito || 0) > 0 && (() => {
            const conv = getCreditConversion(seller);
            const good = conv.pct >= 70;
            return (
              <div className="bg-slate-50 rounded-lg p-2.5 mt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Conversion a Credito</span>
                  <span className={`text-xs font-black ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{conv.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${good ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(conv.pct, 100)}%` }} />
                </div>
                <p className="text-[10px] text-slate-500">
                  <span className="font-bold text-slate-700">{conv.done}</span> creditos de <span className="font-bold text-blue-600">{conv.eligible}</span> elegibles
                </p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const MetricRow = ({ label, val, target, isMoney, onChange, onTargetChange, isEditing }: { label: string; val: number; target: number; isMoney?: boolean; onChange: (v: string) => void; onTargetChange: (v: string) => void; isEditing: boolean }) => {
  const p = target > 0 ? (val / target) * 100 : 0;
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="font-bold text-slate-500 w-20 truncate text-[11px]">{label}</span>
      <div className="flex-1 px-1"><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${p >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(p, 100)}%` }} /></div></div>
      <div className="flex items-center gap-1 font-bold text-slate-700 w-28 justify-end shrink-0">
        {isEditing ? <input className="w-16 border border-slate-200 rounded text-right px-1 focus:border-indigo-500 outline-none text-[11px]" value={val} onChange={e => onChange(e.target.value)} /> : <span className="text-[11px]">{isMoney ? 'L.' : ''}{Number(val).toLocaleString()}</span>}
        <span className="text-slate-200">/</span>
        {isEditing ? <input className="w-12 border border-slate-100 rounded text-center bg-slate-50 text-slate-500 focus:border-indigo-500 outline-none text-[10px]" value={target} onChange={e => onTargetChange(e.target.value)} /> : <span className="text-slate-400 text-[10px]">{isMoney ? (Number(target) / 1000).toFixed(0) + 'k' : target}</span>}
      </div>
      {!isEditing && (
        <span className={`text-[11px] font-black w-12 text-right shrink-0 ${p >= 100 ? 'text-emerald-600' : p >= 70 ? 'text-indigo-600' : 'text-slate-400'}`}>{p.toFixed(0)}%</span>
      )}
    </div>
  );
};

const GlobalRow = ({ label, val, goal, isMoney }: { label: string; val: number; goal: number; isMoney?: boolean }) => {
  const p = goal > 0 ? (val / goal) * 100 : 0;
  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-5 py-3.5 font-bold text-slate-600 text-xs">{label}</td>
      <td className="px-5 py-3.5 text-right font-black text-slate-800 text-xs">{isMoney ? 'L.' : ''}{Number(val).toLocaleString()}</td>
      <td className="px-5 py-3.5 text-center"><span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{isMoney ? 'L.' + (Number(goal) / 1000).toFixed(0) + 'k' : goal}</span></td>
      <td className="px-5 py-3.5 text-right"><span className={`font-black text-xs ${p >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{p.toFixed(1)}%</span></td>
    </tr>
  );
};

// ============================================================================
// AI INSIGHTS VIEW
// ============================================================================

const AIInsightsView = ({ sellers, globalStats, currentDate, paceMetrics }: { sellers: Seller[]; globalStats: any; currentDate: Date; paceMetrics: any }) => {
  const [simDailySales, setSimDailySales] = useState<number>(paceMetrics.dailyAvg || 0);
  const [showSimulator, setShowSimulator] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const sorted = [...sellers].map(s => ({ ...s, score: calculateScore(s) })).sort((a, b) => b.score - a.score);
  const topSeller = sorted[0];
  const lowSeller = sorted[sorted.length - 1];
  const salesProgress = globalStats.sales.target > 0 ? (globalStats.sales.achieved / globalStats.sales.target) * 100 : 0;

  const runAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await generateAIAnalysis({
        monthName: currentDate.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' }),
        sellers: sorted.filter(s => isSellerActive(s)).map(s => ({
          name: s.name,
          score: s.score,
          sellerType: s.sellerType,
          celulares: s.celulares || 0,
          metrics: {
            sales: { achieved: s.metrics.sales.achieved || 0, target: s.metrics.sales.target || 0 },
            credits: { achieved: s.metrics.credits.achieved || 0, target: s.metrics.credits.target || 0 },
            accessories: { achieved: s.metrics.accessories.achieved || 0, target: s.metrics.accessories.target || 0 },
            chips: { achieved: s.metrics.chips.achieved || 0, target: s.metrics.chips.target || 0 },
            epin: { achieved: s.metrics.epin?.achieved || 0, target: s.metrics.epin?.target || 0 },
          },
        })),
        globalStats: {
          sales: globalStats.sales,
          credits: globalStats.credits,
          acc: globalStats.acc,
          chips: globalStats.chips,
          epin: globalStats.epin,
        },
        pace: {
          pace: paceMetrics.pace || 0,
          projected: paceMetrics.projected || 0,
          daysLeft: paceMetrics.daysLeft || 0,
          dailyNeeded: paceMetrics.dailyNeeded || 0,
          dailyAvg: paceMetrics.dailyAvg || 0,
          dayOfMonth: paceMetrics.dayOfMonth || 0,
          daysInMonth: paceMetrics.dim || 0,
          expectedPct: paceMetrics.expectedPct || 0,
          isCurrentMonth: !!paceMetrics.isCurrentMonth,
        },
      });
      if (res.ok) {
        setAiAnalysis(res.data);
      } else {
        setAiError(res.error);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Error al generar el analisis.');
    } finally {
      setAiLoading(false);
    }
  };

  const kpiStatus = [
    { label: 'Ventas', achieved: globalStats.sales.achieved, target: globalStats.sales.target },
    { label: 'Creditos', achieved: globalStats.credits.achieved, target: globalStats.credits.target },
    { label: 'Accesorios', achieved: globalStats.acc.achieved, target: globalStats.acc.target },
    { label: 'Chips', achieved: globalStats.chips.achieved, target: globalStats.chips.target },
    ...(globalStats.epin.achieved > 0 || globalStats.epin.target > 0 ? [{ label: 'EPIN', achieved: globalStats.epin.achieved, target: globalStats.epin.target }] : []),
  ];

  const weakest = kpiStatus.reduce((min, k) => {
    const p = k.target > 0 ? (k.achieved / k.target) * 100 : 100;
    const mp = min.target > 0 ? (min.achieved / min.target) * 100 : 100;
    return p < mp ? k : min;
  }, kpiStatus[0]);

  // ============================================================================
  // ALERTAS INTELIGENTES
  // ============================================================================
  const alerts: { type: 'danger' | 'warning' | 'info'; icon: React.ReactNode; title: string; message: string }[] = [];
  
  // Alerta: Ritmo muy por debajo
  if (paceMetrics.pace < -15) {
    alerts.push({ type: 'danger', icon: <AlertTriangle className="w-4 h-4" />, title: 'Ritmo Critico', message: `El equipo esta ${Math.abs(paceMetrics.pace).toFixed(0)}% por debajo del ritmo esperado. Se necesitan L.${(paceMetrics.dailyNeeded / 1000).toFixed(1)}k diarios para alcanzar la meta.` });
  } else if (paceMetrics.pace < -5) {
    alerts.push({ type: 'warning', icon: <Clock className="w-4 h-4" />, title: 'Ritmo Bajo', message: `El equipo va ${Math.abs(paceMetrics.pace).toFixed(0)}% por debajo. Hay que aumentar el ritmo de ventas.` });
  }
  
  // Alerta: Vendedor con ritmo bajo SEGUN EL DIA DEL MES
  // El umbral no es fijo: depende del % de avance esperado para el dia actual.
  // Ej. dia 5/28 -> se espera ~18%; dia 25/28 -> se espera ~89%.
  const expectedPctNow = paceMetrics.expectedPct || 0;
  const riskRatio = 0.6; // en riesgo si va a menos del 60% del ritmo esperado del dia
  const riskThreshold = expectedPctNow * riskRatio;
  const criticalSellers = expectedPctNow > 0
    ? sorted.filter(s => s.score < riskThreshold && isSellerActive(s))
    : [];
  if (criticalSellers.length > 0) {
    const dayCtx = paceMetrics.isCurrentMonth
      ? `Al dia ${paceMetrics.dayOfMonth}/${paceMetrics.dim} se espera ~${expectedPctNow.toFixed(0)}% de avance. `
      : `Con el mes cerrado (${expectedPctNow.toFixed(0)}% esperado). `;
    alerts.push({
      type: 'warning',
      icon: <Users className="w-4 h-4" />,
      title: 'Vendedores en Riesgo',
      message: `${dayCtx}${criticalSellers.map(s => s.name).join(', ')} ${criticalSellers.length === 1 ? 'va' : 'van'} por debajo del ritmo esperado (menos de ${riskThreshold.toFixed(0)}%).`,
    });
  }
  
  // Alerta: KPI muy por debajo del ritmo esperado del dia (umbral relativo, no fijo)
  const kpiRiskThreshold = expectedPctNow > 0 ? expectedPctNow * 0.5 : 20;
  const criticalKPIs = kpiStatus.filter(k => k.target > 0 && (k.achieved / k.target) * 100 < kpiRiskThreshold);
  criticalKPIs.forEach(k => {
    alerts.push({ type: 'danger', icon: <Target className="w-4 h-4" />, title: `${k.label} Critico`, message: `Solo ${((k.achieved / k.target) * 100).toFixed(0)}% de meta${expectedPctNow > 0 ? ` (se espera ~${expectedPctNow.toFixed(0)}% al dia ${paceMetrics.dayOfMonth})` : ''}. Se requiere accion inmediata.` });
  });
  
  // Alerta positiva: Buen ritmo
  if (paceMetrics.pace >= 10 && paceMetrics.projected >= globalStats.sales.target * 1.1) {
    alerts.push({ type: 'info', icon: <Flame className="w-4 h-4" />, title: 'Excelente Ritmo', message: `Proyeccion de L.${(paceMetrics.projected / 1000).toFixed(0)}k - ${((paceMetrics.projected / globalStats.sales.target) * 100 - 100).toFixed(0)}% sobre meta.` });
  }

  // ============================================================================
  // SIMULADOR DE ESCENARIOS
  // ============================================================================
  const simProjected = globalStats.sales.achieved + (simDailySales * paceMetrics.daysLeft);
  const simWillMeet = simProjected >= globalStats.sales.target;
  const simPct = globalStats.sales.target > 0 ? (simProjected / globalStats.sales.target) * 100 : 0;

  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">
      {/* ALERTAS INTELIGENTES */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 tracking-wider">
            <Bell className="w-4 h-4" /> Alertas ({alerts.length})
          </div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                alert.type === 'danger' ? 'bg-red-50 border-red-200 text-red-800' :
                alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  alert.type === 'danger' ? 'bg-red-100 text-red-600' :
                  alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>{alert.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{alert.title}</p>
                  <p className="text-[11px] mt-0.5 opacity-80">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-4 right-4 opacity-[0.03]"><BrainCircuit className="w-48 h-48" /></div>
        <div className="flex items-center gap-3 mb-5 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/80 flex items-center justify-center"><Sparkles className="w-5 h-5 text-yellow-300" /></div>
          <div>
            <h2 className="text-base font-bold font-heading uppercase tracking-wide">Digimax Intelligence</h2>
            <p className="text-[11px] text-slate-400 font-medium">Analisis en tiempo real de tu equipo</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
          <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Progreso</p>
            <p className="text-2xl font-black font-heading leading-none">{salesProgress.toFixed(1)}%</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Ritmo</p>
            <p className={`text-2xl font-black font-heading leading-none ${paceMetrics.pace >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{paceMetrics.pace >= 0 ? '+' : ''}{paceMetrics.pace.toFixed(1)}%</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Proyeccion</p>
            <p className={`text-2xl font-black font-heading leading-none ${paceMetrics.projected >= globalStats.sales.target ? 'text-emerald-400' : 'text-amber-400'}`}>L.{(paceMetrics.projected / 1000).toFixed(0)}k</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Dias Restantes</p>
            <p className="text-2xl font-black font-heading leading-none">{paceMetrics.daysLeft}</p>
          </div>
        </div>
      </div>

      {/* ANALISIS GENERADO POR IA */}
      <Card className="shadow-sm border-indigo-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-black font-heading text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> Analisis Inteligente
            </h3>
            <button
              onClick={runAIAnalysis}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : aiAnalysis ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Analizando...' : aiAnalysis ? 'Regenerar' : 'Generar con IA'}
            </button>
          </div>

          {aiError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              No se pudo generar el analisis: {aiError}
            </div>
          )}

          {!aiAnalysis && !aiLoading && !aiError && (
            <p className="text-xs text-slate-500 leading-relaxed">
              Presiona <strong className="text-indigo-600">Generar con IA</strong> para que la inteligencia artificial analice el desempeno del equipo y entregue un diagnostico y recomendaciones accionables basadas en los datos reales del mes.
            </p>
          )}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider animate-pulse">La IA esta analizando tu equipo</p>
            </div>
          )}

          {aiAnalysis && !aiLoading && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1.5">Resumen Ejecutivo</p>
                <p className="text-xs text-slate-700 leading-relaxed">{aiAnalysis.resumen}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Diagnostico</p>
                <p className="text-xs text-slate-700 leading-relaxed">{aiAnalysis.diagnostico}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Vendedor Destacado</p>
                  <p className="text-sm font-bold text-emerald-800">{aiAnalysis.vendedorDestacado.nombre}</p>
                  <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">{aiAnalysis.vendedorDestacado.motivo}</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Necesita Apoyo</p>
                  <p className="text-sm font-bold text-amber-800">{aiAnalysis.vendedorEnRiesgo.nombre}</p>
                  <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">{aiAnalysis.vendedorEnRiesgo.motivo}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-indigo-500" /> Recomendaciones</p>
                <div className="space-y-2">
                  {aiAnalysis.recomendaciones.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        rec.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
                        rec.prioridad === 'media' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>{rec.prioridad}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">{rec.titulo}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{rec.detalle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SIMULADOR DE ESCENARIOS */}
      <Card className="shadow-sm border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black font-heading text-indigo-800 uppercase tracking-wider flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-indigo-500" /> Simulador de Escenarios
            </h3>
            <button onClick={() => setShowSimulator(!showSimulator)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              {showSimulator ? 'Ocultar' : 'Mostrar'} <Play className={`w-3 h-3 transition-transform ${showSimulator ? 'rotate-90' : ''}`} />
            </button>
          </div>
          {showSimulator && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Venta diaria promedio estimada: L.{(simDailySales / 1000).toFixed(1)}k
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(paceMetrics.dailyNeeded * 2, 50000)}
                  step={1000}
                  value={simDailySales}
                  onChange={(e) => setSimDailySales(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>L.0</span>
                  <span className="text-indigo-600 font-semibold">Necesario: L.{(paceMetrics.dailyNeeded / 1000).toFixed(1)}k</span>
                  <span>L.{(Math.max(paceMetrics.dailyNeeded * 2, 50000) / 1000).toFixed(0)}k</span>
                </div>
              </div>
              <div className={`p-4 rounded-xl border ${simWillMeet ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Proyeccion con este ritmo</p>
                    <p className={`text-xl font-black font-heading ${simWillMeet ? 'text-emerald-600' : 'text-red-600'}`}>
                      L.{(simProjected / 1000).toFixed(0)}k
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-500">vs Meta</p>
                    <p className={`text-xl font-black font-heading ${simWillMeet ? 'text-emerald-600' : 'text-red-600'}`}>
                      {simPct.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <p className={`text-[11px] mt-2 font-medium ${simWillMeet ? 'text-emerald-700' : 'text-red-700'}`}>
                  {simWillMeet 
                    ? `Con L.${(simDailySales / 1000).toFixed(1)}k diarios, alcanzaras la meta con L.${((simProjected - globalStats.sales.target) / 1000).toFixed(0)}k de excedente.`
                    : `Necesitas aumentar a L.${(paceMetrics.dailyNeeded / 1000).toFixed(1)}k diarios para alcanzar la meta. Faltan L.${((globalStats.sales.target - simProjected) / 1000).toFixed(0)}k.`
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5">
            <h3 className="text-xs font-black font-heading text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-amber-500" /> Rendimiento Individual</h3>
            <div className="space-y-3">
              {sorted.filter(s => isSellerActive(s)).slice(0, 5).map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{s.name}</p></div>
                  <div className="h-1 w-16 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.score >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(s.score, 100)}%` }} /></div>
                  <span className={`text-xs font-black w-12 text-right ${s.score >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>{s.score.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-black font-heading text-slate-800 uppercase tracking-wider flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Diagnostico</h3>
            <div className={`p-3 rounded-lg border text-xs font-medium leading-relaxed ${paceMetrics.pace >= 5 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : paceMetrics.pace >= -5 ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {paceMetrics.pace >= 5 ? 'El equipo va por encima del ritmo esperado. Excelente trabajo.' : paceMetrics.pace >= -5 ? 'El equipo va a un ritmo constante. Hay que mantener la cadencia.' : 'El equipo esta por debajo del ritmo ideal. Se necesita un impulso.'}
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600"><strong className="text-slate-800">MVP:</strong> {topSeller?.name} con {topSeller?.score?.toFixed(1)}% de nota final.</p>
              </div>
              <div className="flex items-start gap-2">
                <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600"><strong className="text-slate-800">Oportunidad:</strong> {lowSeller?.name} con {lowSeller?.score?.toFixed(1)}%.</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600"><strong className="text-slate-800">KPI mas debil:</strong> {weakest.label} al {(weakest.target > 0 ? (weakest.achieved / weakest.target) * 100 : 0).toFixed(1)}%.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ============================================================================
// COMPARATIVE VIEW
// ============================================================================

const ComparativeView = ({ sellers, monthName }: { sellers: Seller[]; monthName: string }) => {
  const sorted = [...sellers].map(s => ({ ...s, score: calculateScore(s) })).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...sorted.map(s => s.score), 1);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <Card className="shadow-lg overflow-hidden border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
        <CardContent className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-bold font-heading uppercase tracking-wider text-lg">Ranking</h3>
              <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wider mt-0.5">{monthName}</p>
            </div>
            <Trophy className="w-7 h-7 text-amber-400" />
          </div>
          <div className="space-y-4">
            {sorted.map((s, i) => {
              const totalSales = (s.metrics.sales.achieved || 0) + (s.metrics.epin?.achieved || 0);
              const barW = maxScore > 0 ? (s.score / maxScore) * 100 : 0;
              return (
                <div key={s.id} className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg font-black font-heading text-sm flex items-center justify-center shrink-0 ${i === 0 ? 'bg-amber-400 text-amber-900' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-amber-700 text-amber-200' : 'bg-slate-700/50 text-slate-500'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-sm truncate">{s.name}</span>
                      <span className={`text-xs font-black font-heading ml-2 ${s.score >= 100 ? 'text-emerald-400' : 'text-slate-400'}`}>{s.score.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${s.score >= 100 ? 'bg-emerald-500' : s.score >= 80 ? 'bg-blue-500' : 'bg-indigo-500'}`} style={{ width: `${barW}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">L.{(totalSales / 1000).toFixed(1)}k {(s.metrics.epin?.achieved || 0) > 0 ? <span className="text-purple-400">(EPIN: L.{((s.metrics.epin?.achieved || 0) / 1000).toFixed(1)}k)</span> : null} | {s.celulares || 0} cel.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// HISTORICAL VIEW
// ============================================================================

const HistoricalView = ({ history }: { history: HistoryMap }) => {
  const months = Object.keys(history).sort();
  const chartData = months.map(m => {
    const data = history[m];
    const comms = (data.commissions?.tigo || 0) + (data.commissions?.krediya || 0) + (data.commissions?.ola || 0);
    const epin = (data.sellers || []).reduce((acc, s) => acc + (s.metrics?.epin?.achieved || 0), 0);
    const sales = (data.sellers || []).reduce((acc, s) => acc + (s.metrics?.sales?.achieved || 0), 0) + comms + epin;
    const target = data.globalTargets?.sales || DEFAULT_GLOBAL_TARGETS.sales;
    const label = new Date(m + '-02').toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
    return { month: m, label, sales, target, epin };
  });
  const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.target)), 1);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <h3 className="font-bold font-heading text-slate-800 uppercase flex items-center gap-2.5 text-base tracking-wide">
        <TrendingUp className="w-5 h-5 text-indigo-600" /> Historial Anual
      </h3>
      {chartData.length > 0 && (
        <Card className="shadow-sm border-slate-200/80 bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3.5 px-6"><CardTitle className="text-[11px] font-bold font-heading uppercase text-slate-500 tracking-wider flex items-center gap-2"><BarChart2 className="w-3.5 h-3.5" /> Ventas Mes a Mes</CardTitle></CardHeader>
          <CardContent className="p-6">
            <div className="flex items-end gap-3 h-48 md:h-56">
              {chartData.map(d => {
                const barH = maxVal > 0 ? (d.sales / maxVal) * 100 : 0;
                const targetH = maxVal > 0 ? (d.target / maxVal) * 100 : 0;
                const pct = d.target > 0 ? (d.sales / d.target) * 100 : 0;
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <span className={`text-[9px] font-black ${pct >= 100 ? 'text-emerald-600' : 'text-slate-500'}`}>{(d.sales / 1000).toFixed(0)}k</span>
                    <div className="w-full flex flex-col items-center flex-1 justify-end relative">
                      <div className="absolute w-full border-t-2 border-dashed border-red-200 left-0" style={{ bottom: `${targetH}%` }} />
                      <div className={`w-full max-w-8 rounded-t-md transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ height: `${barH}%` }} />
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 mt-0.5">{d.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm inline-block" /> Ventas</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-dashed border-red-200 inline-block" /> Meta</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm inline-block" /> Cumplida</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MONTHLY TABLE */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
            <tr><th className="px-5 py-3 text-left">Mes</th><th className="px-5 py-3 text-right">Venta</th><th className="px-5 py-3 text-right hidden md:table-cell">EPIN</th><th className="px-5 py-3 text-right hidden md:table-cell">Meta</th><th className="px-5 py-3 text-right">%</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {months.map(m => {
              const data = history[m];
              const comms = (data.commissions?.tigo || 0) + (data.commissions?.krediya || 0) + (data.commissions?.ola || 0);
              const epin = (data.sellers || []).reduce((acc, s) => acc + (s.metrics?.epin?.achieved || 0), 0);
              const sales = (data.sellers || []).reduce((acc, s) => acc + (s.metrics?.sales?.achieved || 0), 0) + comms + epin;
              const target = data.globalTargets?.sales || DEFAULT_GLOBAL_TARGETS.sales;
              const pct = target > 0 ? (sales / target) * 100 : 0;
              return (
                <tr key={m} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-bold text-slate-700 capitalize">{new Date(m + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</td>
                  <td className="px-5 py-3 text-right font-black text-emerald-600">L. {Number(sales).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-black text-purple-600 hidden md:table-cell">{epin > 0 ? `L. ${epin.toLocaleString()}` : '-'}</td>
                  <td className="px-5 py-3 text-right text-slate-500 hidden md:table-cell">{(Number(target) / 1000).toFixed(0)}k</td>
                  <td className="px-5 py-3 text-right"><span className={`font-black ${pct >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>{pct.toFixed(1)}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default DigimaxSalesView;
