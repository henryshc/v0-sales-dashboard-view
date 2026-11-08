import { NextResponse } from 'next/server'
import { GOOGLE_SCRIPT_URL, leerNube, protegerCamposA2 } from '@/lib/a2-sync'

// Proxy server-side hacia Google Apps Script para evitar bloqueos de CORS
// que ocurren al hacer fetch directo desde el navegador en produccion.

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET: leer datos desde la nube
export async function GET() {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      redirect: 'follow',
      cache: 'no-store',
    })
    const text = await res.text()
    // Apps Script devuelve JSON; lo reenviamos tal cual
    return new NextResponse(text, {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (err) {
    console.log('[v0] Proxy GET error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ history: {}, version: null, globalTargets: null }, { status: 200 })
  }
}

// POST: guardar datos en la nube
export async function POST(request: Request) {
  try {
    let body = await request.text()
    // Protege los numeros que vienen de A2: si este navegador tiene una copia mas vieja
    // que la ultima sincronizacion, se conservan los de la nube para esos vendedores.
    try {
      const enviado = JSON.parse(body)
      if (enviado && typeof enviado === 'object' && enviado.history) {
        const nube = await leerNube()
        enviado.history = protegerCamposA2(enviado.history, nube.history)
        body = JSON.stringify(enviado)
      }
    } catch (err) {
      console.log('[v0] Proteccion A2 omitida:', err instanceof Error ? err.message : String(err))
    }
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body,
    })
    const text = await res.text()
    return new NextResponse(text || '{"success":true}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (err) {
    console.log('[v0] Proxy POST error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
