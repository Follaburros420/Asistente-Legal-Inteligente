import { NextRequest, NextResponse } from "next/server"
import { VALID_ENV_KEYS } from "@/types/valid-keys"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function GET() {
  try {
    const isUsingEnvKeyMap: Record<string, boolean> = {
      openai: !!OPENAI_API_KEY,
      anthropic: !!ANTHROPIC_API_KEY,
      google: !!GOOGLE_GEMINI_API_KEY,
      mistral: !!MISTRAL_API_KEY,
      groq: !!GROQ_API_KEY,
      perplexity: !!PERPLEXITY_API_KEY,
      azure: !!AZURE_OPENAI_API_KEY,
      openrouter: !!OPENROUTER_API_KEY
    }

    return NextResponse.json({
      isUsingEnvKeyMap
    })
  } catch (error) {
    console.error("Error fetching keys:", error)
    return NextResponse.json(
      { error: "Error fetching keys" },
      { status: 500 }
    )
  }
}
