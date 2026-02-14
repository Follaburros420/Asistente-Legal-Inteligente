/**
 * Clasificador de intenciones usando LLM para detectar solicitudes de documentos legales.
 * Implementación estricta basada en intención semántica.
 */

import OpenAI from "openai"

export type IntentType = "chat_response" | "document_write" | "ambiguous"

export interface ClassificationResult {
    intent: IntentType
    is_document: boolean
    doc_type: "contrato" | "minuta" | "tutela" | "derecho_de_peticion" | "memorial" | "comunicado" | "correo" | "otro"
    confidence: number
    reason_short: string
}

const CLASSIFICATION_PROMPT = `Eres un clasificador de intenciones estricto para un asistente legal.
Tu ÚNICA misión es determinar si el usuario quiere que la IA REDACTE/GENERE un documento legal formal.

CATEGORIAS:
1. "document_write": El usuario pide explícitamente CREAR, REDACTAR, ELABORAR, HACER un documento (contrato, tutela, derecho de petición, demanda, etc.).
2. "ambiguous": El usuario menciona un documento ("tutela", "contrato") pero NO usa verbos de creación, o es vago ("necesito una tutela" sin más contexto).
3. "chat_response": Todo lo demás. Preguntas ("qué es", "cómo funciona"), saludos, definiciones, teoría, requisitos.

EJEMPLOS NEGATIVOS (chat_response):
- "Qué es una tutela?"
- "Explícame el derecho de petición"
- "Requisitos para un contrato"
- "Hola, qué puedes hacer"
- "Dime sobre la ley 80"

EJEMPLOS POSITIVOS (document_write):
- "Redacta una tutela por salud"
- "Escribe un derecho de petición para colpensiones"
- "Elabora un contrato de arrendamiento"
- "Hazme una demanda de alimentos"

EJEMPLOS AMBIGUOS (ambiguous):
- "Necesito una tutela" (Puede ser redacción o información)
- "Tutela salud"
- "Formato de contrato"

Responde SOLO con este JSON exacto:
{
  "intent": "chat_response" | "document_write" | "ambiguous",
  "confidence": 0.0-1.0,
  "doc_type": "tipo_de_doc_o_otro",
  "reason_short": "máx 10 palabras explicacion"
}

Mensaje del usuario: "{userMessage}"`

/**
 * Clasifica la intención del usuario usando un LLM vía OpenRouter.
 */
export async function classifyWithLLM(
    userMessage: string,
    model?: string
): Promise<ClassificationResult> {
    try {
        const openrouterApiKey = process.env.OPENROUTER_API_KEY
        if (!openrouterApiKey) {
            console.warn("⚠️ OPENROUTER_API_KEY no configurada, usando fallback")
            return { intent: "chat_response", is_document: false, doc_type: "otro", confidence: 0.1, reason_short: "No API Key" }
        }

        const client = new OpenAI({
            apiKey: openrouterApiKey,
            baseURL: "https://openrouter.ai/api/v1"
        })

        const response = await client.chat.completions.create({
            model: model || "openai/gpt-4o-mini", // Modelo rápido y capaz de JSON
            messages: [
                {
                    role: "system",
                    content: "Eres un clasificador JSON estricto. NO hables. SOLO JSON."
                },
                {
                    role: "user",
                    content: CLASSIFICATION_PROMPT.replace("{userMessage}", userMessage)
                }
            ],
            temperature: 0.0, // Cero creatividad para máxima consistencia
            max_tokens: 150,
            response_format: { type: "json_object" }
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
            return { intent: "chat_response", is_document: false, doc_type: "otro", confidence: 0.1, reason_short: "Empty response" }
        }

        let parsed: any
        try {
            parsed = JSON.parse(content)
        } catch (e) {
            // Intento de recuperación básico
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0])
                } catch (e2) {
                    console.warn("Fallo total parsing JSON clasificador:", content)
                    return { intent: "chat_response", is_document: false, doc_type: "otro", confidence: 0.1, reason_short: "JSON parse error" }
                }
            } else {
                return { intent: "chat_response", is_document: false, doc_type: "otro", confidence: 0.1, reason_short: "Invalid JSON format" }
            }
        }

        // Normalizar salida
        const result: ClassificationResult = {
            intent: ["chat_response", "document_write", "ambiguous"].includes(parsed.intent) ? parsed.intent : "chat_response",
            doc_type: parsed.doc_type || "otro",
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
            reason_short: parsed.reason_short || "No reason",
            is_document: false // Se calcula abajo basado en reglas
        }

        // Reglas de Negocio para is_document
        if (result.intent === "document_write" && result.confidence >= 0.7) {
            result.is_document = true
        } else {
            result.is_document = false
        }

        return result

    } catch (error) {
        console.error("Error crítico en clasificador:", error)
        return { intent: "chat_response", is_document: false, doc_type: "otro", confidence: 0.1, reason_short: "Exception caught" }
    }
}

/**
 * Función principal que combina LLM con heurística de seguridad (solo para desambiguar a favor de preguntas).
 */
export async function classifyDocumentIntent(
    userMessage: string,
    heuristicResult: { isDraft: boolean; confidence: number; type?: string }
): Promise<ClassificationResult> {

    // Llamada al LLM
    const llmResult = await classifyWithLLM(userMessage)

    // Lógica de "Ambiguity handling" mejorada
    // Si el LLM dice documento pero con baja confianza -> Ambiguo
    if (llmResult.intent === "document_write" && llmResult.confidence < 0.7) {
        llmResult.intent = "ambiguous"
        llmResult.is_document = false
        llmResult.reason_short = "Low confidence document request"
    }

    // Si el LLM dice chat, pero la heurística detectó palabras fuertes de draft Y hay ambigüedad posible
    // Esto es un "safety net" para no perder requests válidos que el LLM no entendió
    if (llmResult.intent === "chat_response" && heuristicResult.isDraft && heuristicResult.confidence > 0.8) {
        // Ejemplo: "Necesito una tutela" -> LLM a veces dice chat si es muy estricto, heurística dice draft.
        // Lo marcamos como ambiguo para que el sistema pregunte.
        llmResult.intent = "ambiguous"
        llmResult.reason_short = "Heuristic mismatch - potential draft"
    }

    return llmResult
}
