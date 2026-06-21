import { NextResponse } from 'next/server'

// Proxy server-side hacia Google Apps Script para evitar bloqueos de CORS
// que ocurren al hacer fetch directo desde el navegador en produccion.
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxufMWqOv5-cv_DUe4HThGywEMg1CwoJk7a0TH9zZwt44ViJaC3xOHYyd09BFNUQU7B/exec'

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
    const body = await request.text()
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
