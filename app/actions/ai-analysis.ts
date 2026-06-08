'use server'

import { generateText, Output } from 'ai'
import { z } from 'zod'

const analysisSchema = z.object({
  resumen: z.string().describe('Un resumen ejecutivo de 2-3 frases sobre el estado general del equipo de ventas este mes.'),
  diagnostico: z.string().describe('Diagnostico del ritmo de ventas y si se alcanzara la meta, con cifras concretas.'),
  recomendaciones: z.array(z.object({
    titulo: z.string().describe('Titulo corto de la recomendacion'),
    detalle: z.string().describe('Explicacion accionable de la recomendacion'),
    prioridad: z.enum(['alta', 'media', 'baja']).describe('Prioridad de la accion'),
  })).describe('Entre 3 y 5 recomendaciones accionables especificas para mejorar resultados.'),
  vendedorDestacado: z.object({
    nombre: z.string(),
    motivo: z.string().describe('Por que destaca este vendedor'),
  }).describe('El vendedor con mejor desempeno y por que.'),
  vendedorEnRiesgo: z.object({
    nombre: z.string(),
    motivo: z.string().describe('Por que esta en riesgo y que deberia mejorar'),
  }).describe('El vendedor que necesita mas apoyo y por que.'),
})

export type AIAnalysis = z.infer<typeof analysisSchema>

type SellerInput = {
  name: string
  score: number
  sellerType?: string
  metrics: {
    sales: { achieved: number; target: number }
    credits: { achieved: number; target: number }
    accessories: { achieved: number; target: number }
    chips: { achieved: number; target: number }
    epin: { achieved: number; target: number }
  }
  celulares: number
}

export async function generateAIAnalysis(payload: {
  monthName: string
  sellers: SellerInput[]
  globalStats: {
    sales: { achieved: number; target: number }
    credits: { achieved: number; target: number }
    acc: { achieved: number; target: number }
    chips: { achieved: number; target: number }
    epin: { achieved: number; target: number }
  }
  pace: { pace: number; projected: number; daysLeft: number; dailyNeeded: number; dailyAvg: number }
}): Promise<{ ok: true; data: AIAnalysis } | { ok: false; error: string }> {
  try {
    const { monthName, sellers, globalStats, pace } = payload

    const sellersText = sellers.map(s => {
      const pct = (a: number, t: number) => (t > 0 ? ((a / t) * 100).toFixed(0) + '%' : 'sin meta')
      return `- ${s.name}${s.sellerType === 'tigomoney' ? ' (TigoMoney/EPIN)' : ''}: Nota ${s.score.toFixed(1)}%. ` +
        `Ventas L.${s.metrics.sales.achieved.toLocaleString()}/${s.metrics.sales.target.toLocaleString()} (${pct(s.metrics.sales.achieved, s.metrics.sales.target)}), ` +
        `Creditos ${s.metrics.credits.achieved}/${s.metrics.credits.target} (${pct(s.metrics.credits.achieved, s.metrics.credits.target)}), ` +
        `Accesorios ${s.metrics.accessories.achieved}/${s.metrics.accessories.target} (${pct(s.metrics.accessories.achieved, s.metrics.accessories.target)}), ` +
        `Chips ${s.metrics.chips.achieved}/${s.metrics.chips.target} (${pct(s.metrics.chips.achieved, s.metrics.chips.target)}), ` +
        `EPIN L.${s.metrics.epin.achieved.toLocaleString()}/${s.metrics.epin.target.toLocaleString()}, ` +
        `${s.celulares} celulares vendidos.`
    }).join('\n')

    const prompt = `Eres un analista experto de ventas para una tienda de telefonia movil en Honduras (moneda Lempiras, L.). ` +
      `Analiza el desempeno del equipo del mes de ${monthName} y entrega un analisis profesional, concreto y accionable en espanol.\n\n` +
      `META GLOBAL DE TIENDA:\n` +
      `- Ventas: L.${globalStats.sales.achieved.toLocaleString()} de L.${globalStats.sales.target.toLocaleString()} (${globalStats.sales.target > 0 ? ((globalStats.sales.achieved / globalStats.sales.target) * 100).toFixed(1) : 0}%)\n` +
      `- Creditos: ${globalStats.credits.achieved} de ${globalStats.credits.target}\n` +
      `- Accesorios: ${globalStats.acc.achieved} de ${globalStats.acc.target}\n` +
      `- Chips: ${globalStats.chips.achieved} de ${globalStats.chips.target}\n` +
      `- EPIN: L.${globalStats.epin.achieved.toLocaleString()} de L.${globalStats.epin.target.toLocaleString()}\n\n` +
      `RITMO:\n` +
      `- El equipo va ${pace.pace >= 0 ? pace.pace.toFixed(1) + '% por encima' : Math.abs(pace.pace).toFixed(1) + '% por debajo'} del ritmo esperado.\n` +
      `- Proyeccion de cierre: L.${pace.projected.toLocaleString()}\n` +
      `- Dias restantes: ${pace.daysLeft}\n` +
      `- Venta diaria necesaria para meta: L.${pace.dailyNeeded.toLocaleString()}\n` +
      `- Venta diaria promedio actual: L.${pace.dailyAvg.toLocaleString()}\n\n` +
      `DESEMPENO POR VENDEDOR:\n${sellersText}\n\n` +
      `Da recomendaciones especificas mencionando nombres de vendedores y cifras concretas. ` +
      `Se directo y orientado a la accion. No inventes datos que no esten arriba.`

    const { experimental_output } = await generateText({
      model: 'openai/gpt-5-mini',
      prompt,
      experimental_output: Output.object({ schema: analysisSchema }),
    })

    return { ok: true, data: experimental_output }
  } catch (err) {
    console.error('[v0] AI analysis error:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido al generar el analisis.' }
  }
}
