import { detectDraftIntent } from "../lib/draft-detection"
import { classifyDocumentIntent } from "../lib/classifiers/document-classifier"
import dotenv from "dotenv"

dotenv.config()

const TEST_INPUTS = [
    "Hola",
    "Hola, necesito una tutela",
    "Redacta una tutela por salud",
    "Qué es una tutela?",
    "Necesito un contrato"
]

import fs from "fs"

function log(msg: string) {
    console.log(msg)
    fs.appendFileSync("debug_output.log", msg + "\n")
}

async function simulateLangchainAgentLogic(input: string) {
    log(`\n--- Input: "${input}" ---`)

    // 1. Heurística
    const heuristicResult = detectDraftIntent(input)
    log(`Heuristic: isDraft=${heuristicResult.isDraft}, conf=${heuristicResult.confidence}, type=${heuristicResult.type}`)

    // 2. Clasificador LLM (Simulated call)
    log("Calling classifier...")
    const classificationResult = await classifyDocumentIntent(input, heuristicResult)
    log(`Classifier: intent=${classificationResult.intent}, is_document=${classificationResult.is_document}, conf=${classificationResult.confidence}`)

    // 3. Logic in route.ts (NEW)
    const isDraft = classificationResult.intent === "document_write" && classificationResult.is_document
    const isAmbiguous = classificationResult.intent === "ambiguous"

    log(`> RESULT: isDraft=${isDraft}, isAmbiguous=${isAmbiguous}`)

    if (isDraft) log("=> ACTIVATES DOCUMENT MODE")
    else if (isAmbiguous) log("=> ASKS CLARIFICATION")
    else log("=> CHAT MODE")
}

async function run() {
    fs.writeFileSync("debug_output.log", "")
    for (const input of TEST_INPUTS) {
        await simulateLangchainAgentLogic(input)
    }
}

run().catch(console.error)
