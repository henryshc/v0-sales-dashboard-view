import { NextResponse } from 'next/server'
import { aplicarEnvio, escribirNube, leerNube, pendientes, tokenValido, type EnvioA2 } from '@/lib/a2-sync'

// Endpoint del programa que corre en el servidor de A2.
//  GET  -> ¿alguien presionó "Actualizar"? (y qué meses)
//  POST -> recibe lo logrado por vendedor y lo guarda en la nube
// Ambos requieren el token A2_SYNC_TOKEN (variable de entorno en Vercel).

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const sinCache = { 'cache-control': 'no-store' }

function autorizar(request: Request) {
  const ok = tokenValido(request)
  if (ok === 'sin_configurar') {
    return NextResponse.json({ error: 'Falta configurar A2_SYNC_TOKEN en Vercel' }, { status: 503, headers: sinCache })
  }
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: sinCache })
  return null
}

export async function GET(request: Request) {
  const rechazo = autorizar(request)
  if (rechazo) return rechazo
  try {
    const nube = await leerNube()
    return NextResponse.json(pendientes(nube.history), { headers: sinCache })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502, headers: sinCache })
  }
}

export async function POST(request: Request) {
  const rechazo = autorizar(request)
  if (rechazo) return rechazo
  let envio: EnvioA2
  try {
    envio = (await request.json()) as EnvioA2
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400, headers: sinCache })
  }
  try {
    const nube = await leerNube()
    const ahora = new Date().toISOString()
    const { history, resumen } = aplicarEnvio(nube.history, envio, ahora)
    await escribirNube({ history, globalTargets: nube.globalTargets ?? null, version: nube.version ?? null })
    return NextResponse.json({ ok: true, syncedAt: ahora, resumen }, { headers: sinCache })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502, headers: sinCache })
  }
}
