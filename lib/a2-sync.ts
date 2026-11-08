// ============================================================================
// Sincronización con A2 (sistema de facturación)
// ----------------------------------------------------------------------------
// Un programa en el servidor de A2 calcula lo logrado por cada vendedor y lo
// envía a /api/a2-sync. Aquí se mezcla con los datos de la nube (Apps Script).
//
// Campos que vienen de A2 (lo LOGRADO, nunca las metas):
//   metrics.sales / credits / accessories / chips / epin .achieved,
//   celulares y creditBreakdown { ola, krediya, oi }.
// El estado de la sincronización vive en cada mes, en `a2`.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GOOGLE_SCRIPT_URL =
  process.env.GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxufMWqOv5-cv_DUe4HThGywEMg1CwoJk7a0TH9zZwt44ViJaC3xOHYyd09BFNUQU7B/exec'

export type A2Estado = {
  syncedAt?: string | null     // cuándo se aplicaron los últimos números de A2
  dataAt?: string | null       // hora de la copia de A2 que se usó
  requestedAt?: string | null  // cuándo se presionó "Actualizar"
  error?: string | null
  errorAt?: string | null
  motivo?: string | null
  vendedores?: string[]        // vendedores cuyos números maneja A2
}

export type FilaA2 = {
  vendedor: string
  sales: number
  celulares: number
  credits: number
  creditBreakdown: Record<string, number>
  accessories: number
  chips: number
  epin: number
}

export type EnvioA2 = {
  source?: string
  motivo?: string
  requestedAt?: string | null
  generatedAt?: string
  dataAt?: string | null
  months?: Record<string, FilaA2[]>
  error?: string
}

const METRICAS_A2 = ['sales', 'credits', 'accessories', 'chips', 'epin'] as const

export const nombreClave = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

const tiempo = (iso: unknown): number => {
  const t = new Date(String(iso ?? '')).getTime()
  return Number.isFinite(t) ? t : 0
}

const masReciente = (a?: string | null, b?: string | null): string | null => {
  if (!a) return b ?? null
  if (!b) return a
  return tiempo(a) >= tiempo(b) ? a : b
}

const entero = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

// ----------------------------------------------------------------------------
// Nube (Apps Script)
// ----------------------------------------------------------------------------

export async function leerNube(): Promise<any> {
  const res = await fetch(GOOGLE_SCRIPT_URL, { redirect: 'follow', cache: 'no-store' })
  if (!res.ok) throw new Error(`La nube respondió ${res.status}`)
  const datos = JSON.parse(await res.text())
  if (!datos || typeof datos !== 'object' || !datos.history || typeof datos.history !== 'object') {
    throw new Error('La nube no devolvió el historial')
  }
  return datos
}

export async function escribirNube(datos: any): Promise<string> {
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(datos),
  })
  if (!res.ok) throw new Error(`La nube respondió ${res.status} al guardar`)
  return res.text()
}

// ----------------------------------------------------------------------------
// Estado
// ----------------------------------------------------------------------------

/** Meses con un "Actualizar" pendiente (pedido después del último envío o error). */
export function pendientes(history: Record<string, any>): { pending: boolean; requestedAt: string | null; meses: string[]; lastSyncAt: string | null } {
  const meses: string[] = []
  let requestedAt: string | null = null
  let lastSyncAt: string | null = null
  for (const [mes, m] of Object.entries(history || {})) {
    const a2: A2Estado = m?.a2 || {}
    lastSyncAt = masReciente(lastSyncAt, a2.syncedAt ?? null)
    if (!a2.requestedAt || m?.isClosed) continue
    const atendido = Math.max(tiempo(a2.syncedAt), tiempo(a2.errorAt))
    if (tiempo(a2.requestedAt) > atendido) {
      meses.push(mes)
      requestedAt = masReciente(requestedAt, a2.requestedAt)
    }
  }
  return { pending: meses.length > 0, requestedAt, meses: meses.sort(), lastSyncAt }
}

// ----------------------------------------------------------------------------
// Aplicar lo que envía el servidor de A2
// ----------------------------------------------------------------------------

export type ResumenMes = { mes: string; estado: 'actualizado' | 'sin_mes' | 'cerrado'; vendedores?: string[]; noEncontrados?: string[] }

export function aplicarEnvio(historyOriginal: Record<string, any>, envio: EnvioA2, ahora: string): { history: Record<string, any>; resumen: ResumenMes[] } {
  const history = clonar(historyOriginal || {})
  const resumen: ResumenMes[] = []
  const solicitados = new Set(pendientes(history).meses)

  if (envio.error) {
    // Error leyendo A2: se anota en los meses pedidos (o el mes en curso) para que el botón lo muestre.
    const meses = solicitados.size ? [...solicitados] : Object.keys(envio.months || {})
    for (const mes of meses) {
      if (!history[mes]) continue
      history[mes].a2 = { ...(history[mes].a2 || {}), error: String(envio.error).slice(0, 300), errorAt: ahora }
    }
    return { history, resumen }
  }

  for (const [mes, filas] of Object.entries(envio.months || {})) {
    const m = history[mes]
    if (!m) { resumen.push({ mes, estado: 'sin_mes' }); continue }
    if (m.isClosed) {
      if (solicitados.has(mes)) m.a2 = { ...(m.a2 || {}), error: 'El mes está cerrado', errorAt: ahora }
      resumen.push({ mes, estado: 'cerrado' })
      continue
    }
    const sellers: any[] = Array.isArray(m.sellers) ? m.sellers : []
    const actualizados: string[] = []
    const noEncontrados: string[] = []
    for (const f of filas || []) {
      const s = sellers.find(x => nombreClave(x?.name) === nombreClave(f.vendedor))
      if (!s) { noEncontrados.push(f.vendedor); continue }
      s.metrics = s.metrics || {}
      const valores: Record<(typeof METRICAS_A2)[number], number> = {
        sales: entero(f.sales),
        credits: entero(f.credits),
        accessories: entero(f.accessories),
        chips: entero(f.chips),
        epin: entero(f.epin),
      }
      for (const k of METRICAS_A2) {
        s.metrics[k] = { target: 0, ...(s.metrics[k] || {}), achieved: valores[k] }
      }
      s.celulares = entero(f.celulares)
      const desglose: Record<string, number> = {}
      for (const [fin, n] of Object.entries(f.creditBreakdown || {})) desglose[fin] = entero(n)
      s.creditBreakdown = { ola: 0, krediya: 0, oi: 0, ...(s.creditBreakdown || {}), ...desglose }
      actualizados.push(nombreClave(s.name))
    }
    m.a2 = {
      ...(m.a2 || {}),
      syncedAt: ahora,
      dataAt: envio.dataAt ?? null,
      motivo: envio.motivo ?? null,
      error: null,
      errorAt: null,
      vendedores: actualizados,
    }
    resumen.push({ mes, estado: 'actualizado', vendedores: actualizados, noEncontrados })
  }
  return { history, resumen }
}

// ----------------------------------------------------------------------------
// Protección al guardar desde la app
// ----------------------------------------------------------------------------

/**
 * Si un navegador guarda con números de A2 más viejos que los de la nube (por ejemplo,
 * una pestaña abierta desde hace horas), se conservan los de la nube en los vendedores
 * que maneja A2. Metas, pesos y todo lo demás se guarda tal cual lo mandó la app.
 */
export function protegerCamposA2(historyCliente: Record<string, any>, historyNube: Record<string, any>): Record<string, any> {
  if (!historyCliente || typeof historyCliente !== 'object' || !historyNube) return historyCliente
  for (const [mes, c] of Object.entries(historyCliente)) {
    const n = historyNube[mes]
    const a2Nube: A2Estado | undefined = n?.a2
    if (!c || !a2Nube?.syncedAt) continue
    const a2Cliente: A2Estado = c.a2 || {}
    if (tiempo(a2Cliente.syncedAt) >= tiempo(a2Nube.syncedAt)) continue
    const manejados = new Set((a2Nube.vendedores || []).map(nombreClave))
    const nubePorNombre = new Map<string, any>((n.sellers || []).map((s: any) => [nombreClave(s?.name), s]))
    for (const s of Array.isArray(c.sellers) ? c.sellers : []) {
      const clave = nombreClave(s?.name)
      const ns = nubePorNombre.get(clave)
      if (!ns || !manejados.has(clave)) continue
      s.metrics = s.metrics || {}
      for (const k of METRICAS_A2) {
        const achieved = ns.metrics?.[k]?.achieved
        if (achieved === undefined) continue
        s.metrics[k] = { target: 0, ...(s.metrics[k] || {}), achieved }
      }
      if (ns.celulares !== undefined) s.celulares = ns.celulares
      if (ns.creditBreakdown) s.creditBreakdown = { ...(s.creditBreakdown || {}), ...ns.creditBreakdown }
    }
    c.a2 = { ...a2Nube, requestedAt: masReciente(a2Cliente.requestedAt ?? null, a2Nube.requestedAt ?? null) }
  }
  return historyCliente
}

// ----------------------------------------------------------------------------
// Seguridad
// ----------------------------------------------------------------------------

export function tokenValido(request: Request): boolean | 'sin_configurar' {
  const esperado = process.env.A2_SYNC_TOKEN
  if (!esperado) return 'sin_configurar'
  const recibido = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (recibido.length !== esperado.length) return false
  let diff = 0
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i)
  return diff === 0
}
