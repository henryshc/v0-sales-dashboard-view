import { NextResponse } from 'next/server'
import { leerNube } from '@/lib/a2-sync'

// Estado de la sincronización de un mes, para el botón "Actualizar" de la app.
// Solo devuelve horas y mensajes; nunca el token ni los datos de ventas.

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const mes = new URL(request.url).searchParams.get('mes') || ''
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'Mes no válido' }, { status: 400 })
  }
  try {
    const nube = await leerNube()
    const a2 = nube.history?.[mes]?.a2 ?? null
    return NextResponse.json({ mes, a2 }, { headers: { 'cache-control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ mes, a2: null, error: err instanceof Error ? err.message : String(err) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
