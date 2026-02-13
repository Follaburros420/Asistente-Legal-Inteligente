import { env } from "@/lib/env/runtime-env"
import { Database, Tables } from "@/supabase/types"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createSupabaseSafeFetch, isSupabaseAuthHtmlParseError } from "@/lib/supabase/safe-fetch"
import { validateAndNormalizeSupabaseUrl } from "@/lib/supabase/url-validation"
import { applySupabaseAuthResilience, isSupabaseAuthUpstreamError } from "@/lib/supabase/auth-resilience"

export type ProfileWithKeys = Tables<"profiles"> & {
  openai_api_key?: string
  anthropic_api_key?: string
  google_gemini_api_key?: string
  mistral_api_key?: string
  groq_api_key?: string
  perplexity_api_key?: string
  azure_openai_api_key?: string
  openrouter_api_key?: string
  openai_organization_id?: string
  azure_openai_endpoint?: string
  azure_openai_35_turbo_id?: string
  azure_openai_45_vision_id?: string
  azure_openai_45_turbo_id?: string
  azure_openai_embeddings_id?: string
  use_azure_openai?: boolean
}

export type ServerProfileErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "SUPABASE_CONFIG_ERROR"
  | "SUPABASE_AUTH_UPSTREAM_ERROR"
  | "SUPABASE_AUTH_ERROR"

export class ServerProfileError extends Error {
  readonly code: ServerProfileErrorCode
  readonly status: number

  constructor(code: ServerProfileErrorCode, status: number, message: string) {
    super(message)
    this.name = "ServerProfileError"
    this.code = code
    this.status = status
  }
}

export function isServerProfileError(error: unknown): error is ServerProfileError {
  return error instanceof ServerProfileError
}

function isLikelyHtmlResponseError(error: unknown): boolean {
  return isSupabaseAuthHtmlParseError(error)
}

function normalizeSupabaseUrl(rawUrl: string): string {
  const validation = validateAndNormalizeSupabaseUrl(rawUrl)
  if (!validation.ok) {
    throw new ServerProfileError(
      "SUPABASE_CONFIG_ERROR",
      503,
      validation.reason
    )
  }
  return validation.url
}

export async function getServerProfile(): Promise<ProfileWithKeys> {
  const cookieStore = cookies()
  const supabaseUrl = normalizeSupabaseUrl(env.supabaseUrl())
  const rawSupabase = createServerClient<Database>(
    supabaseUrl,
    env.supabaseAnonKey(),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      },
      global: {
        fetch: createSupabaseSafeFetch("server-chat-helpers")
      }
    }
  )
  const supabase = applySupabaseAuthResilience(rawSupabase, "server-chat-helpers")

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null = null

  try {
    const authResult = await supabase.auth.getUser()
    if (authResult.error) {
      throw authResult.error
    }
    user = authResult.data.user
  } catch (error) {
    if (isLikelyHtmlResponseError(error) || isSupabaseAuthUpstreamError(error)) {
      throw new ServerProfileError(
        "SUPABASE_AUTH_UPSTREAM_ERROR",
        503,
        "Supabase Auth devolvio HTML en lugar de JSON. Verifica NEXT_PUBLIC_SUPABASE_URL y DNS"
      )
    }

    throw new ServerProfileError(
      "SUPABASE_AUTH_ERROR",
      503,
      `Error consultando Supabase Auth: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!user) {
    throw new ServerProfileError("UNAUTHORIZED", 401, "User not found")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!profile) {
    throw new ServerProfileError("PROFILE_NOT_FOUND", 401, "Profile not found")
  }

  const profileWithKeys = addApiKeysToProfile(profile)

  return profileWithKeys
}

function addApiKeysToProfile(profile: Tables<"profiles">): ProfileWithKeys {
  const apiKeys = {
    [VALID_ENV_KEYS.OPENAI_API_KEY]: "openai_api_key",
    [VALID_ENV_KEYS.ANTHROPIC_API_KEY]: "anthropic_api_key",
    [VALID_ENV_KEYS.GOOGLE_GEMINI_API_KEY]: "google_gemini_api_key",
    [VALID_ENV_KEYS.MISTRAL_API_KEY]: "mistral_api_key",
    [VALID_ENV_KEYS.GROQ_API_KEY]: "groq_api_key",
    [VALID_ENV_KEYS.PERPLEXITY_API_KEY]: "perplexity_api_key",
    [VALID_ENV_KEYS.AZURE_OPENAI_API_KEY]: "azure_openai_api_key",
    [VALID_ENV_KEYS.OPENROUTER_API_KEY]: "openrouter_api_key",

    [VALID_ENV_KEYS.OPENAI_ORGANIZATION_ID]: "openai_organization_id",

    [VALID_ENV_KEYS.AZURE_OPENAI_ENDPOINT]: "azure_openai_endpoint",
    [VALID_ENV_KEYS.AZURE_GPT_35_TURBO_NAME]: "azure_openai_35_turbo_id",
    [VALID_ENV_KEYS.AZURE_GPT_45_VISION_NAME]: "azure_openai_45_vision_id",
    [VALID_ENV_KEYS.AZURE_GPT_45_TURBO_NAME]: "azure_openai_45_turbo_id",
    [VALID_ENV_KEYS.AZURE_EMBEDDINGS_NAME]: "azure_openai_embeddings_id"
  }

  const profileWithKeys = profile as ProfileWithKeys

  for (const [envKey, profileKey] of Object.entries(apiKeys)) {
    if (process.env[envKey]) {
      (profileWithKeys as any)[profileKey] = process.env[envKey]
    }
  }

  return profileWithKeys
}

export function checkApiKey(apiKey: string | null, keyName: string) {
  if (apiKey === null || apiKey === "") {
    throw new Error(`${keyName} API Key not found`)
  }
}
