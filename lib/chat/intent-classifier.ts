/**
 * Clasificador de Intención - Versión Thin
 * 
 * Usa LLM directo, sin heurísticas. Más simple, más predecible.
 */

import OpenAI from "openai"
import { IntentClassification } from "./types"

const CLASSIFICATION_PROMPT = `Eres un clasificador de intenciones ESTRICTO para un asistente legal.

Tu ÚNICA misión: determinar si el usuario quiere que la IA REDACTE/GENERE un documento legal formal.

CATEGORÍAS:
1. "document_write": El usuario pide EXPLÍCITAMENTE CREAR, REDACTAR, ELABORAR, HACER un documento.
   Ejemplos: "Redacta una tutela", "Escribe un contrato", "Elabora un memorial"

2. "ambiguous": Menciona un documento pero NO es claro si quiere redacción o información.
   Ejemplos: "Necesito una tutela", "Tutela salud", "Formato de contrato"

3. "chat_response": Todo lo demás. Preguntas, saludos, definiciones, teoría, requisitos.
   Ejemplos: "¿Qué es una tutela?", "Requisitos para un contrato", "Explícame la ley 80"

Responde SOLO con este JSON exacto:
{
  "intent": "chat_response" | "document_write" | "ambiguous",
  "confidence": 0.0-1.0,
  "doc_type": "contrato|tutela|memorial|derecho_de_peticion|comunicado|otro",
  "reason": "máx 10 palabras"
}`

export async function classifyIntent(
  client: OpenAI,
  userMessage: string
): Promise<IntentClassification> {
  try {
    const response = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",  // Rápido y barato para clasificación
      messages: [
        {
          role: "system",
          content: CLASSIFICATION_PROMPT
        },
        {
          role: "user",
          content: `Mensaje del usuario: "${userMessage}"`
        }
      ],
      temperature: 0.0,  // Máxima determinismo
      max_tokens: 150,
      response_format: { type: "json_object" }
    })
    
    const content = response.choices[0]?.message?.content
    
    if (!content) {
      return fallbackClassification("Empty response")
    }
    
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      // Intentar extraer JSON de markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch {
          return fallbackClassification("JSON parse error")
        }
      } else {
        return fallbackClassification("Invalid JSON format")
      }
    }
    
    // Normalizar y validar
    const intent = normalizeIntent(parsed.intent)
    const confidence = typeof parsed.confidence === "number" 
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5
    
    return {
      intent,
      confidence,
      docType: parsed.doc_type || "otro",
      reason: parsed.reason || "No reason provided"
    }
    
  } catch (error: any) {
    console.error("Intent classification failed:", error)
    return fallbackClassification(error.message)
  }
}

function normalizeIntent(intent: string): "chat_response" | "document_write" | "ambiguous" {
  if (intent === "document_write") return "document_write"
  if (intent === "ambiguous") return "ambiguous"
  return "chat_response"  // Default seguro
}

function fallbackClassification(reason: string): IntentClassification {
  return {
    intent: "chat_response",  // Default más seguro
    confidence: 0.1,
    docType: "otro",
    reason: `Fallback: ${reason}`
  }
}
