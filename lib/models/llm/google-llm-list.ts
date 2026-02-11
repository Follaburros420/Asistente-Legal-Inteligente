import { LLM } from "@/types"

const GOOGLE_PLATORM_LINK = "https://ai.google.dev/"

// Google Models (UPDATED 02/2025) -----------------------------

// Gemini 3 Pro Preview - Modelo principal para derecho colombiano
const GEMINI_3_PRO: LLM = {
  modelId: "google/gemini-3-pro-preview",
  modelName: "Gemini 3 Pro Preview",
  provider: "google",
  hostedId: "google/gemini-3-pro-preview",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0,
    outputCost: 0
  }
}

// Gemini 3 Flash Preview - M1 Small, rápido y eficiente
const GEMINI_3_FLASH: LLM = {
  modelId: "google/gemini-3-flash-preview",
  modelName: "Gemini 3 Flash Preview",
  provider: "google",
  hostedId: "google/gemini-3-flash-preview",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0,
    outputCost: 0
  }
}

// Gemini 1.5 Flash
const GEMINI_1_5_FLASH: LLM = {
  modelId: "gemini-1.5-flash",
  modelName: "Gemini 1.5 Flash",
  provider: "google",
  hostedId: "gemini-1.5-flash",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini 1.5 Pro
const GEMINI_1_5_PRO: LLM = {
  modelId: "gemini-1.5-pro-latest",
  modelName: "Gemini 1.5 Pro",
  provider: "google",
  hostedId: "gemini-1.5-pro-latest",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini Pro
const GEMINI_PRO: LLM = {
  modelId: "gemini-pro",
  modelName: "Gemini Pro",
  provider: "google",
  hostedId: "gemini-pro",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: false
}

export const GOOGLE_LLM_LIST: LLM[] = [
  GEMINI_3_PRO,           // Modelo principal recomendado
  GEMINI_3_FLASH,          // M1 Small - rápido y eficiente
  GEMINI_1_5_PRO,
  GEMINI_1_5_FLASH,
  GEMINI_PRO
]
