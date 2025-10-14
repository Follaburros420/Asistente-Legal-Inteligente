/**
 * Herramientas para consultar fuentes oficiales colombianas
 * SUIN-Juriscol, Corte Constitucional, Corte Suprema, Consejo de Estado
 */

import { FuenteOficial } from "@/types/legal-agents"

// ═══════════════════════════════════════════════
// 1. SUIN-Juriscol (Normativa)
// ═══════════════════════════════════════════════

export async function fetch_norma_suin(
  query_or_id: string
): Promise<FuenteOficial | null> {
  try {
    console.log(`📜 SUIN-Juriscol: Buscando normativa "${query_or_id}"`)

    // TODO: Implementar integración real con SUIN-Juriscol API
    // Por ahora, búsqueda web enfocada en SUIN
    const searchUrl = `https://www.suin-juriscol.gov.co/busquedaBasica.html?q=${encodeURIComponent(query_or_id)}`

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LegalBot/1.0; +https://legalbot.co)"
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      console.log(`⚠️ SUIN-Juriscol: Error ${response.status}`)
      return null
    }

    // Extraer información (parseo HTML básico)
    const html = await response.text()

    // Patrón básico para identificar normas
    const normaMatch = html.match(
      /<a[^>]*href="([^"]*viewDocument[^"]*)"[^>]*>([^<]*)<\/a>/i
    )

    if (normaMatch) {
      const url = normaMatch[1].startsWith("http")
        ? normaMatch[1]
        : `https://www.suin-juriscol.gov.co${normaMatch[1]}`
      const titulo = normaMatch[2].trim()

      return {
        id: `SUIN-${Date.now()}`,
        tipo: "NORMA",
        fecha: new Date().toISOString().split("T")[0],
        texto: titulo,
        url: url
      }
    }

    console.log(`⚠️ SUIN-Juriscol: No se encontraron resultados`)
    return null
  } catch (error) {
    console.error(`❌ Error en fetch_norma_suin:`, error)
    return null
  }
}

// ═══════════════════════════════════════════════
// 2. Corte Constitucional (Jurisprudencia)
// ═══════════════════════════════════════════════

export async function fetch_juris_cc(
  query: string
): Promise<FuenteOficial[]> {
  try {
    console.log(
      `⚖️ Corte Constitucional: Buscando jurisprudencia "${query}"`
    )

    // Buscar en relatoría de la Corte Constitucional
    const searchUrl = `https://www.corteconstitucional.gov.co/relatoria/buscador.php?palabra=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LegalBot/1.0; +https://legalbot.co)"
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.log(`⚠️ Corte Constitucional: Error ${response.status}`)
      return []
    }

    const html = await response.text()

    // Extraer sentencias (patrón básico)
    const sentenciaPattern =
      /(C|T|SU)-(\d+)[-\/](\d{4})/gi
    const matches = html.match(sentenciaPattern) || []

    const fuentes: FuenteOficial[] = []

    for (const match of matches.slice(0, 5)) {
      // Máximo 5 resultados
      const [tipo, numero, año] = match.split(/[-\/]/)

      fuentes.push({
        id: match,
        tipo: "SENTENCIA",
        corporacion: "Corte Constitucional",
        numero: match,
        fecha: `${año}-01-01`, // Fecha aproximada
        texto: `Sentencia ${match}`,
        url: `https://www.corteconstitucional.gov.co/relatoria/${año}/${match}.htm`
      })
    }

    console.log(
      `✅ Corte Constitucional: ${fuentes.length} sentencias encontradas`
    )
    return fuentes
  } catch (error) {
    console.error(`❌ Error en fetch_juris_cc:`, error)
    return []
  }
}

// ═══════════════════════════════════════════════
// 3. Corte Suprema de Justicia (Jurisprudencia)
// ═══════════════════════════════════════════════

export async function fetch_juris_csj(
  query: string,
  sala?: string
): Promise<FuenteOficial[]> {
  try {
    console.log(
      `⚖️ Corte Suprema: Buscando jurisprudencia "${query}"${sala ? ` (Sala ${sala})` : ""}`
    )

    // Buscar en sistema de la Corte Suprema
    const searchUrl = `https://www.cortesuprema.gov.co/corte/index.php?s=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LegalBot/1.0; +https://legalbot.co)"
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.log(`⚠️ Corte Suprema: Error ${response.status}`)
      return []
    }

    const html = await response.text()

    // Extraer sentencias básicas
    const urlPattern =
      /https?:\/\/www\.cortesuprema\.gov\.co\/[^\s"<>]+/gi
    const urls = html.match(urlPattern) || []

    const fuentes: FuenteOficial[] = []

    for (const url of urls.slice(0, 5)) {
      fuentes.push({
        id: `CSJ-${Date.now()}-${fuentes.length}`,
        tipo: "SENTENCIA",
        corporacion: "Corte Suprema de Justicia",
        sala: sala || "No especificada",
        fecha: new Date().toISOString().split("T")[0],
        texto: `Jurisprudencia Corte Suprema`,
        url: url
      })
    }

    console.log(`✅ Corte Suprema: ${fuentes.length} sentencias encontradas`)
    return fuentes
  } catch (error) {
    console.error(`❌ Error en fetch_juris_csj:`, error)
    return []
  }
}

// ═══════════════════════════════════════════════
// 4. Consejo de Estado (Jurisprudencia)
// ═══════════════════════════════════════════════

export async function fetch_juris_ce(query: string): Promise<FuenteOficial[]> {
  try {
    console.log(`⚖️ Consejo de Estado: Buscando jurisprudencia "${query}"`)

    // Buscar en relatoría del Consejo de Estado
    const searchUrl = `https://www.consejodeestado.gov.co/relatoria/buscador/?q=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LegalBot/1.0; +https://legalbot.co)"
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.log(`⚠️ Consejo de Estado: Error ${response.status}`)
      return []
    }

    const html = await response.text()

    // Extraer URLs de sentencias
    const urlPattern =
      /https?:\/\/www\.consejodeestado\.gov\.co\/[^\s"<>]+/gi
    const urls = html.match(urlPattern) || []

    const fuentes: FuenteOficial[] = []

    for (const url of urls.slice(0, 5)) {
      fuentes.push({
        id: `CE-${Date.now()}-${fuentes.length}`,
        tipo: "SENTENCIA",
        corporacion: "Consejo de Estado",
        fecha: new Date().toISOString().split("T")[0],
        texto: `Jurisprudencia Consejo de Estado`,
        url: url
      })
    }

    console.log(
      `✅ Consejo de Estado: ${fuentes.length} sentencias encontradas`
    )
    return fuentes
  } catch (error) {
    console.error(`❌ Error en fetch_juris_ce:`, error)
    return []
  }
}

// ═══════════════════════════════════════════════
// 5. Consulta de Procesos (Rama Judicial)
// ═══════════════════════════════════════════════

export async function consulta_procesos(params: {
  numero_proceso?: string
  identificacion?: string
  tipo?: string
}): Promise<any> {
  try {
    console.log(`⚖️ Consultando procesos:`, params)

    // TODO: Integrar con Consulta Nacional Unificada
    // Por ahora, retornar estructura básica

    return {
      encontrado: false,
      mensaje:
        "Consulta de procesos requiere integración con sistema CPNU de la Rama Judicial",
      params
    }
  } catch (error) {
    console.error(`❌ Error en consulta_procesos:`, error)
    return { error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

// ═══════════════════════════════════════════════
// 6. Búsqueda Web Enfocada en Fuentes Oficiales
// ═══════════════════════════════════════════════

export async function buscarFuentesOficiales(
  query: string
): Promise<FuenteOficial[]> {
  console.log(`🔍 Búsqueda de fuentes oficiales para: "${query}"`)

  const fuentes: FuenteOficial[] = []

  // Intentar todas las fuentes en paralelo
  const [normaSuin, jurisCC, jurisCSJ, jurisCE] = await Promise.all([
    fetch_norma_suin(query),
    fetch_juris_cc(query),
    fetch_juris_csj(query),
    fetch_juris_ce(query)
  ])

  // Agregar norma si se encontró
  if (normaSuin) {
    fuentes.push(normaSuin)
  }

  // Agregar jurisprudencia
  fuentes.push(...jurisCC, ...jurisCSJ, ...jurisCE)

  console.log(`✅ Total fuentes oficiales encontradas: ${fuentes.length}`)

  return fuentes
}








