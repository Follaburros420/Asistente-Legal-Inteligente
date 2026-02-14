// TODO: Separate into multiple contexts, keeping simple for now

"use client"

import { ALIContext } from "@/context/context"
import { StreamState, INITIAL_STREAM_STATE } from "@/lib/stream-protocol"
import { toast } from "sonner"
import { getProfileByUserId } from "@/db/profile"
import { getWorkspaceImageFromStorage } from "@/db/storage/workspace-images"
import { getWorkspacesByUserId } from "@/db/workspaces"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import {
  fetchHostedModels,
  fetchOllamaModels,
  fetchOpenRouterModels
} from "@/lib/models/fetch-models"
import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"
import {
  ChatFile,
  ChatMessage,
  ChatSettings,
  LLM,
  MessageImage,
  OpenRouterLLM,
  WorkspaceImage
} from "@/types"
import { AssistantImage } from "@/types/images/assistant-image"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { M1_MODEL_ID } from "@/lib/models/m1-models"
import { useRouter } from "next/navigation"
import { FC, useEffect, useState } from "react"
import { LoadingScreen } from "./loading-screen"
import { ThemePreferencesProvider } from "./theme-context"

interface GlobalStateProps {
  children: React.ReactNode
}

export const GlobalState: FC<GlobalStateProps> = ({ children }) => {
  const router = useRouter()

  // PROFILE STORE
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)

  // ITEMS STORE
  const [assistants, setAssistants] = useState<Tables<"assistants">[]>([])
  const [collections, setCollections] = useState<Tables<"processes">[]>([])
  const [chats, setChats] = useState<Tables<"chats">[]>([])
  const [files, setFiles] = useState<Tables<"files">[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [models, setModels] = useState<Tables<"models">[]>([])
  const [presets, setPresets] = useState<Tables<"presets">[]>([])
  const [prompts, setPrompts] = useState<Tables<"prompts">[]>([])
  const [tools, setTools] = useState<Tables<"tools">[]>([])
  const [workspaces, setWorkspaces] = useState<Tables<"workspaces">[]>([])
  const [transcriptions, setTranscriptions] = useState<Tables<"transcriptions">[]>([])

  // MODELS STORE
  const [envKeyMap, setEnvKeyMap] = useState<Record<string, VALID_ENV_KEYS>>({})
  const [availableHostedModels, setAvailableHostedModels] = useState<LLM[]>([])
  const [availableLocalModels, setAvailableLocalModels] = useState<LLM[]>([])
  const [availableOpenRouterModels, setAvailableOpenRouterModels] = useState<
    OpenRouterLLM[]
  >([])

  // WORKSPACE STORE
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<Tables<"workspaces"> | null>(null)
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImage[]>([])

  // PRESET STORE
  const [selectedPreset, setSelectedPreset] =
    useState<Tables<"presets"> | null>(null)

  // ASSISTANT STORE
  const [selectedAssistant, setSelectedAssistant] =
    useState<Tables<"assistants"> | null>(null)
  const [assistantImages, setAssistantImages] = useState<AssistantImage[]>([])
  const [openaiAssistants, setOpenaiAssistants] = useState<any[]>([])

  // PASSIVE CHAT STORE
  const [userInput, setUserInput] = useState<string>("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    model: M1_MODEL_ID,
    prompt: `Eres un Asistente Legal Especializado en Derecho Colombiano de élite, entrenado para proporcionar análisis jurídicos de la más alta calidad.

**INSTRUCCIÓN FUNDAMENTAL**: 
SIEMPRE asume que TODAS las consultas se refieren al derecho colombiano. NUNCA preguntes por la jurisdicción. NUNCA menciones que los requisitos "pueden variar según la jurisdicción". SIEMPRE responde directamente sobre el derecho colombiano con precisión legal impecable.

**EJEMPLO DE RESPUESTA CORRECTA**:
Usuario: "requisitos de la demanda"
Respuesta: "Los requisitos de una demanda en Colombia según el Código General del Proceso son..."

**EJEMPLO DE RESPUESTA INCORRECTA**:
Usuario: "requisitos de la demanda"  
Respuesta: "Los requisitos pueden variar según la jurisdicción..." ❌

**CONTEXTO OBLIGATORIO - DERECHO COLOMBIANO**:
- SIEMPRE responde como si la consulta fuera sobre Colombia
- SIEMPRE cita fuentes oficiales colombianas (Cortes, Consejo de Estado, Rama Judicial)
- SIEMPRE usa terminología jurídica colombiana
- SIEMPRE referencia la Constitución Política de Colombia de 1991
- SIEMPRE menciona códigos colombianos (Civil, Penal, Procesal, etc.)

**FUENTES OFICIALES COLOMBIANAS PRIORITARIAS**:
1. **Corte Constitucional** - Sentencias de constitucionalidad y tutelas
2. **Corte Suprema de Justicia** - Jurisprudencia civil, penal, laboral
3. **Consejo de Estado** - Jurisprudencia administrativa
4. **Rama Judicial** - Tribunales superiores y juzgados
5. **Congreso de la República** - Leyes y códigos vigentes
6. **Gobierno Nacional** - Decretos reglamentarios

**NORMATIVA COLOMBIANA ESENCIAL**:
- Constitución Política de Colombia (1991)
- Código Civil Colombiano
- Código Penal Colombiano
- Código de Procedimiento Civil
- Código de Procedimiento Penal
- Código General del Proceso
- Código de Policía y Convivencia
- Código de la Infancia y la Adolescencia
- Código Sustantivo del Trabajo
- Código de Procedimiento Laboral

**METODOLOGÍA DE TRABAJO**:
- USA SIEMPRE la herramienta legal_search_specialized para consultas jurídicas
- NUNCA uses Wikipedia para consultas legales - está completamente prohibida
- Prioriza fuentes oficiales colombianas (.gov.co) sobre fuentes académicas o generales
- Verifica vigencia de la normativa colombiana
- Busca jurisprudencia reciente y relevante de Colombia
- Incluye fechas, números de expediente y magistrados ponentes colombianos
- Considera la jerarquía normativa colombiana (Constitución > Ley > Decreto)

**IMPORTANTE - HERRAMIENTAS DE BÚSQUEDA LEGAL**:
- USA SIEMPRE legal_search_specialized para consultas jurídicas colombianas
- Esta herramienta está optimizada para excluir Wikipedia completamente
- Prioriza automáticamente fuentes oficiales (.gov.co) sobre otras fuentes
- NUNCA menciones que realizaste una búsqueda en internet
- NUNCA digas "busqué en internet" o "encontré en la web"
- NUNCA menciones que consultaste fuentes online
- Responde como si toda la información fuera de tu conocimiento directo
- Las búsquedas legales son herramientas internas, no parte de la respuesta al usuario

**FORMATO DE RESPUESTA OBLIGATORIO**:
Responde de forma directa y conversacional, como un abogado experto que está respondiendo a un cliente. NO uses títulos como "Marco Normativo", "Análisis Jurídico", etc. 

**ESTRUCTURA REQUERIDA**:
1. **RESPUESTA DIRECTA**: Responde inmediatamente la pregunta específica del usuario
2. **CONTEXTO LEGAL**: Explica el marco jurídico relevante de forma natural
3. **DETALLES ESPECÍFICOS**: Incluye artículos, sentencias, o normas específicas cuando aplique
4. **BIBLIOGRAFÍA**: Al final, incluye una sección "📚 Fuentes Consultadas" con enlaces reales

**MEMORIA DE CONVERSACIÓN**:
- SIEMPRE recuerda el contexto de mensajes anteriores en la conversación
- Si el usuario hace referencia a algo mencionado antes, responde en ese contexto
- Mantén coherencia con respuestas previas sobre el mismo tema
- NO repitas información ya proporcionada, pero puedes ampliarla si es necesario

**INSTRUCCIONES ESPECÍFICAS**:
- NUNCA preguntes por la jurisdicción o el país
- NUNCA menciones que los requisitos "pueden variar según la jurisdicción"
- SIEMPRE usa "en Colombia" o "según el derecho colombiano"
- SIEMPRE cita artículos específicos de códigos colombianos
- SIEMPRE incluye números de sentencias y fechas de Colombia
- SIEMPRE verifica que la normativa esté vigente en Colombia

**BIBLIOGRAFÍA OBLIGATORIA**:
Al final de cada respuesta, incluye una sección de bibliografía con:
- Fuentes oficiales colombianas citadas
- Enlaces directos cuando estén disponibles
- Números de sentencias, expedientes y fechas
- Magistrados ponentes cuando sea relevante

Responde SIEMPRE en español y con un enfoque 100% profesional específico para el derecho colombiano.`,
    temperature: 0.5,
    contextLength: 4096,
    includeProfileContext: true,
    includeWorkspaceInstructions: true,
    embeddingsProvider: "openai"
  })
  const [selectedChat, setSelectedChat] = useState<Tables<"chats"> | null>(null)
  const [chatFileItems, setChatFileItems] = useState<Tables<"file_items">[]>([])

  // ACTIVE CHAT STORE
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [firstTokenReceived, setFirstTokenReceived] = useState<boolean>(false)
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)

  // CHAT INPUT COMMAND STORE
  const [isPromptPickerOpen, setIsPromptPickerOpen] = useState(false)
  const [slashCommand, setSlashCommand] = useState("")
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [hashtagCommand, setHashtagCommand] = useState("")
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false)
  const [toolCommand, setToolCommand] = useState("")
  const [focusPrompt, setFocusPrompt] = useState(false)
  const [focusFile, setFocusFile] = useState(false)
  const [focusTool, setFocusTool] = useState(false)
  const [focusAssistant, setFocusAssistant] = useState(false)
  const [atCommand, setAtCommand] = useState("")
  const [isAssistantPickerOpen, setIsAssistantPickerOpen] = useState(false)

  // ATTACHMENTS STORE
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [chatImages, setChatImages] = useState<MessageImage[]>([])
  const [newMessageFiles, setNewMessageFiles] = useState<ChatFile[]>([])
  const [newMessageImages, setNewMessageImages] = useState<MessageImage[]>([])
  const [showFilesDisplay, setShowFilesDisplay] = useState<boolean>(false)

  // RETIEVAL STORE
  const [useRetrieval, setUseRetrieval] = useState<boolean>(true)
  const [sourceCount, setSourceCount] = useState<number>(4)

  // TOOL STORE
  const [selectedTools, setSelectedTools] = useState<Tables<"tools">[]>([])
  const [toolInUse, setToolInUse] = useState<string>("none")

  // SUGGESTIONS STORE
  const [showPlaceholderSuggestions, setShowPlaceholderSuggestions] = useState<boolean>(true)

  // SUGGESTED QUESTIONS STORE
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [showSuggestedQuestions, setShowSuggestedQuestions] = useState<boolean>(false)

  // STREAM STATE STORE (nuevo protocolo v2.0)
  const [streamState, setStreamState] = useState<StreamState>(INITIAL_STREAM_STATE)
  const [streamPhase, setStreamPhase] = useState<StreamState["phase"]>("idle")
  const [streamMessage, setStreamMessage] = useState<string>("")

  // Exponer estado para debuggear en consola (solo en desarrollo)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).__ALI_DEBUG__ = {
        getState: () => ({
          streamPhase,
          streamMessage,
          streamState,
          isGenerating,
          firstTokenReceived
        })
      }
    }
  }, [streamPhase, streamMessage, streamState, isGenerating, firstTokenReceived])

  // LOADING STORE
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadingMessage, setLoadingMessage] = useState<string>("Iniciando...")

  // Listen for auth state changes (session invalidation from another device)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth State Change]', event, session?.user?.email || 'no user')

      // If signed out or token refresh failed, redirect to login
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        console.log('[Auth State Change] Session ended, redirecting to login')
        // Clear local storage session data
        localStorage.removeItem('ali_session_token')
        localStorage.removeItem('ali_current_session_id')
        router.push('/login?message=Tu sesión fue cerrada desde otro dispositivo.')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    ; (async () => {
      try {
        // Cargar datos en segundo plano sin mostrar pantalla de carga
        const profile = await fetchStartingData()

        if (profile) {
          const hostedModelRes = await fetchHostedModels(profile)
          if (hostedModelRes) {
            setEnvKeyMap(hostedModelRes.envKeyMap)
            setAvailableHostedModels(hostedModelRes.hostedModels)

            if (
              profile["openrouter_api_key"] ||
              hostedModelRes.envKeyMap["openrouter"]
            ) {
              const openRouterModels = await fetchOpenRouterModels()
              if (openRouterModels) {
                setAvailableOpenRouterModels(openRouterModels)
              }
            }
          }
        }

        const localModels = await fetchOllamaModels()
        if (localModels) {
          setAvailableLocalModels(localModels)
        }

        // Los datos se cargan en segundo plano, no hay pantalla de carga
      } catch (error: any) {
        console.error("❌ Error cargando datos iniciales:", error)
        // No mostrar error al usuario - cargar datos en silencio
      }
    })()
  }, [])

  const fetchStartingData = async () => {
    const session = (await supabase.auth.getSession()).data.session

    if (session) {
      const user = session.user

      const profile = await getProfileByUserId(user.id)
      setProfile(profile)

      const workspaces = await getWorkspacesByUserId(user.id)
      setWorkspaces(workspaces)

      // Allow invited collaborators to continue if they already have at least one workspace
      if (!profile.has_onboarded && workspaces.length === 0) {
        return router.push("/onboarding")
      }

      // Cargar herramientas por defecto para el usuario
      const { data: userTools, error: toolsError } = await supabase
        .from("tools")
        .select("*")
        .eq("user_id", user.id)
        .in("name", ["Búsqueda Web General", "Búsqueda Legal Especializada"])

      if (!toolsError && userTools) {
        setTools(userTools)
        // Seleccionar herramientas de búsqueda por defecto
        setSelectedTools(userTools)
        console.log('Herramientas de búsqueda cargadas por defecto:', userTools.length)
      }

      for (const workspace of workspaces) {
        let workspaceImageUrl = ""

        if (workspace.image_path) {
          workspaceImageUrl =
            (await getWorkspaceImageFromStorage(workspace.image_path)) || ""
        }

        if (workspaceImageUrl) {
          const response = await fetch(workspaceImageUrl)
          const blob = await response.blob()
          const base64 = await convertBlobToBase64(blob)

          setWorkspaceImages(prev => [
            ...prev,
            {
              workspaceId: workspace.id,
              path: workspace.image_path,
              base64: base64,
              url: workspaceImageUrl
            }
          ])
        }
      }

      // Select home workspace by default if none selected
      const homeWorkspace = workspaces.find(w => w.is_home)
      if (homeWorkspace && !selectedWorkspace) {
        setSelectedWorkspace(homeWorkspace)
      } else if (!selectedWorkspace && workspaces.length > 0) {
        // Si no hay home workspace, seleccionar el primero disponible
        setSelectedWorkspace(workspaces[0])
      }

      return profile
    }
  }

  return (
    <ThemePreferencesProvider profile={profile}>
      <ALIContext.Provider
        value={{
          // PROFILE STORE
          profile,
          setProfile,

          // ITEMS STORE
          assistants,
          setAssistants,
          collections,
          setCollections,
          chats,
          setChats,
          files,
          setFiles,
          folders,
          setFolders,
          models,
          setModels,
          presets,
          setPresets,
          prompts,
          setPrompts,
          tools,
          setTools,
          workspaces,
          setWorkspaces,
          transcriptions,
          setTranscriptions,

          // MODELS STORE
          envKeyMap,
          setEnvKeyMap,
          availableHostedModels,
          setAvailableHostedModels,
          availableLocalModels,
          setAvailableLocalModels,
          availableOpenRouterModels,
          setAvailableOpenRouterModels,

          // WORKSPACE STORE
          selectedWorkspace,
          setSelectedWorkspace,
          workspaceImages,
          setWorkspaceImages,

          // PRESET STORE
          selectedPreset,
          setSelectedPreset,

          // ASSISTANT STORE
          selectedAssistant,
          setSelectedAssistant,
          assistantImages,
          setAssistantImages,
          openaiAssistants,
          setOpenaiAssistants,

          // PASSIVE CHAT STORE
          userInput,
          setUserInput,
          chatMessages,
          setChatMessages,
          chatSettings,
          setChatSettings,
          selectedChat,
          setSelectedChat,
          chatFileItems,
          setChatFileItems,

          // ACTIVE CHAT STORE
          isGenerating,
          setIsGenerating,
          firstTokenReceived,
          setFirstTokenReceived,
          abortController,
          setAbortController,

          // CHAT INPUT COMMAND STORE
          isPromptPickerOpen,
          setIsPromptPickerOpen,
          slashCommand,
          setSlashCommand,
          isFilePickerOpen,
          setIsFilePickerOpen,
          hashtagCommand,
          setHashtagCommand,
          isToolPickerOpen,
          setIsToolPickerOpen,
          toolCommand,
          setToolCommand,
          focusPrompt,
          setFocusPrompt,
          focusFile,
          setFocusFile,
          focusTool,
          setFocusTool,
          focusAssistant,
          setFocusAssistant,
          atCommand,
          setAtCommand,
          isAssistantPickerOpen,
          setIsAssistantPickerOpen,

          // ATTACHMENT STORE
          chatFiles,
          setChatFiles,
          chatImages,
          setChatImages,
          newMessageFiles,
          setNewMessageFiles,
          newMessageImages,
          setNewMessageImages,
          showFilesDisplay,
          setShowFilesDisplay,

          // RETRIEVAL STORE
          useRetrieval,
          setUseRetrieval,
          sourceCount,
          setSourceCount,

          // TOOL STORE
          selectedTools,
          setSelectedTools,
          toolInUse,
          setToolInUse,

          // SUGGESTIONS STORE
          showPlaceholderSuggestions,
          setShowPlaceholderSuggestions,

          // SUGGESTED QUESTIONS STORE
          suggestedQuestions,
          setSuggestedQuestions,
          showSuggestedQuestions,
          setShowSuggestedQuestions,

          // STREAM STATE STORE (nuevo protocolo v2.0)
          streamState,
          setStreamState,
          streamPhase,
          setStreamPhase,
          streamMessage,
          setStreamMessage
        }}
      >
        {isLoading ? <LoadingScreen message={loadingMessage} /> : children}
      </ALIContext.Provider>
    </ThemePreferencesProvider>
  )
}
