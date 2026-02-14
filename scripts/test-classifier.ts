import { classifyDocumentIntent } from "../lib/classifiers/document-classifier"
import { detectDraftIntent } from "../lib/draft-detection"
import dotenv from "dotenv"

dotenv.config()

const testCases = [
    // 1. CHAT RESPONSE (Expected: chat_response)
    "Hola",
    "Como estas",
    "Qué es una tutela?",
    "Explícame cómo funciona un derecho de petición",
    "Requisitos para contrato de arrendamiento",
    "Dime sobre el derecho administrativo",
    "Cuáles son las causales de despido justo",
    "Diferencia entre tutela y demanda",
    "Hola, qué puedes hacer", // Classic failure case
    "Buenos días, necesito información",

    // 2. DOCUMENT WRITE (Expected: document_write)
    "Redacta una tutela por salud",
    "Escribe un derecho de petición para colpensiones",
    "Elabora un contrato de trabajo a término indefinido",
    "Hazme una demanda de alimentos",
    "Necesito que crees un documento de autorización",
    "Genera una minuta de constitución de sociedad",
    "Prepara un memorial para el juzgado",
    "Quiero que redactes una carta de despido",
    "Diseña un contrato de prestación de servicios",
    "Escribe una respuesta a un derecho de petición",

    // 3. AMBIGUOUS / TRICKY (Expected: ambiguous or chat_response, NEVER document_write if not explicit)
    "Necesito una tutela", // Ambiguous: Do I write it or explain it?
    "Tutela derechos fundamentales",
    "Formato contrato",
    "Modelo demanda ejecutivo",
    "Ejemplo de derecho de petición",
    "Quiero un contrato", // Ambiguous
    "Me ayudas con una tutela", // Ambiguous
    "Borrador de carta", // Strong hint but maybe just asking for template
    "Minuta",
    "Documento legal"
]

import fs from "fs"

function log(msg: string) {
    console.log(msg)
    fs.appendFileSync("test_results.log", msg + "\n")
}

async function runTests() {
    fs.writeFileSync("test_results.log", "") // Clear file
    log("🚀 Iniciando pruebas de clasificación...\n")

    let passed = 0
    let failed = 0
    let ambiguities = 0

    for (const text of testCases) {
        // Simular heurística (part of the real flow)
        const heuristic = detectDraftIntent(text)

        const result = await classifyDocumentIntent(text, heuristic)

        const color = result.intent === "document_write" ? "\x1b[32m" :
            result.intent === "ambiguous" ? "\x1b[33m" : "\x1b[36m"

        log(`Input: "${text}"`)
        log(`Intent: ${result.intent} | Conf: ${result.confidence} | Reason: ${result.reason_short}`)
        log("---")

        if (result.intent === "ambiguous") ambiguities++
    }

    log(`\nResultados Finales:`)
    log(`Total: ${testCases.length}`)
    log(`Ambiguos detectados: ${ambiguities} (Sistema preguntará aclaración)`)
}

runTests().catch(console.error)
