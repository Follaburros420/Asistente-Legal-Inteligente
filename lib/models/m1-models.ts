export const M1_SMALL_MODEL_ID = "openai/gpt-oss-120b"
export const M1_MODEL_ID = "moonshotai/kimi-k2.5"
export const M1_PRO_MODEL_ID = "moonshotai/kimi-k2.5"

export const ALLOWED_M_MODELS = [
  M1_SMALL_MODEL_ID,
  M1_MODEL_ID,
  M1_PRO_MODEL_ID
] as const

export type AllowedMModel = (typeof ALLOWED_M_MODELS)[number]

const LEGACY_MODEL_ALIASES: Record<string, AllowedMModel> = {
  "google/gemini-3-flash-preview": M1_SMALL_MODEL_ID,
  "google/gemini-3-pro-preview": M1_MODEL_ID,
  "google/gemini-1.5-pro-latest": M1_MODEL_ID,
  "google/gemini-1.5-flash": M1_SMALL_MODEL_ID,
  "alibaba/tongyi-deepresearch-30b-a3b": M1_MODEL_ID,
  "moonshotai/kimi-k2-thinking": M1_PRO_MODEL_ID,
  "openai/gpt-oss-120b:free": M1_SMALL_MODEL_ID,
  "openai/gpt-oss-120b:exacto": M1_SMALL_MODEL_ID,
  "deepseek/deepseek-v3.2": M1_MODEL_ID,
  "deepseek/deepseek-v3.2-exp": M1_MODEL_ID,
  "deepseek/deepseek-v3.2-speciale": M1_MODEL_ID
}

export const PROVIDER_HINTS: Partial<Record<AllowedMModel, string>> = {
  [M1_SMALL_MODEL_ID]: "chutes/bf16",
  [M1_MODEL_ID]: "chutes/int4",
  [M1_PRO_MODEL_ID]: "chutes/int4"
}

export function isAllowedMModel(modelId: string | null | undefined): modelId is AllowedMModel {
  if (!modelId) return false
  return (ALLOWED_M_MODELS as readonly string[]).includes(modelId)
}

export function isKnownMModelInput(modelId: string | null | undefined): boolean {
  if (!modelId) return false
  return isAllowedMModel(modelId) || Boolean(LEGACY_MODEL_ALIASES[modelId])
}

export function normalizeMModel(modelId: string | null | undefined): AllowedMModel {
  if (isAllowedMModel(modelId)) {
    return modelId
  }

  if (modelId && LEGACY_MODEL_ALIASES[modelId]) {
    return LEGACY_MODEL_ALIASES[modelId]
  }

  return M1_MODEL_ID
}
