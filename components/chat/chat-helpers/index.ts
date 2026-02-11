// Only used in use-chat-handler.tsx to keep it clean

import { createChatFiles } from "@/db/chat-files"
import { createChat } from "@/db/chats"
import { createMessageFileItems } from "@/db/message-file-items"
import { createMessages, updateMessage } from "@/db/messages"
import { uploadMessageImage } from "@/db/storage/message-images"
import {
  buildFinalMessages,
  adaptMessagesForGoogleGemini
} from "@/lib/build-prompt"
import { consumeReadableStream } from "@/lib/consume-stream"
import { Tables, TablesInsert } from "@/supabase/types"
import {
  ChatFile,
  ChatMessage,
  ChatPayload,
  ChatSettings,
  LLM,
  MessageImage
} from "@/types"
import { BibliographyItem } from "@/types/chat-message"
import React from "react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { getPublicEnvVar } from "@/lib/env/public-env"

export const validateChatSettings = (
  chatSettings: ChatSettings | null,
  modelData: LLM | undefined,
  profile: Tables<"profiles"> | null,
  selectedWorkspace: Tables<"workspaces"> | null,
  messageContent: string
) => {
  if (!chatSettings) {
    throw new Error("Chat settings not found")
  }

  // Permitir que el modelo no se encuentre - usar configuración por defecto

  if (!profile) {
    throw new Error("Profile not found")
  }

  if (!selectedWorkspace) {
    throw new Error("Workspace not found")
  }

  if (!messageContent) {
    throw new Error("Message content not found")
  }
}

export const handleRetrieval = async (
  userInput: string,
  newMessageFiles: ChatFile[],
  chatFiles: ChatFile[],
  embeddingsProvider: "openai" | "local" | "openrouter",
  sourceCount: number
) => {
  const response = await fetch("/api/retrieval/retrieve", {
    method: "POST",
    body: JSON.stringify({
      userInput,
      fileIds: [...newMessageFiles, ...chatFiles].map(file => file.id),
      embeddingsProvider,
      sourceCount
    })
  })

  if (!response.ok) {
    console.error("Error retrieving:", response)
  }

  const { results } = (await response.json()) as {
    results: Tables<"file_items">[]
  }

  return results
}

export const createTempMessages = (
  messageContent: string,
  chatMessages: ChatMessage[],
  chatSettings: ChatSettings,
  b64Images: string[],
  isRegeneration: boolean,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  selectedAssistant: Tables<"assistants"> | null
) => {
  let tempUserChatMessage: ChatMessage = {
    message: {
      chat_id: "",
      assistant_id: null,
      content: messageContent,
      created_at: "",
      id: uuidv4(),
      image_paths: b64Images,
      model: chatSettings.model,
      role: "user",
      sequence_number: chatMessages.length,
      updated_at: "",
      user_id: ""
    },
    fileItems: []
  }

  let tempAssistantChatMessage: ChatMessage = {
    message: {
      chat_id: "",
      assistant_id: selectedAssistant?.id || null,
      content: "",
      created_at: "",
      id: uuidv4(),
      image_paths: [],
      model: chatSettings.model,
      role: "assistant",
      sequence_number: chatMessages.length + 1,
      updated_at: "",
      user_id: ""
    },
    fileItems: []
  }

  let newMessages = []

  if (isRegeneration) {
    const lastMessageIndex = chatMessages.length - 1
    chatMessages[lastMessageIndex].message.content = ""
    newMessages = [...chatMessages]
  } else {
    newMessages = [
      ...chatMessages,
      tempUserChatMessage,
      tempAssistantChatMessage
    ]
  }

  setChatMessages(newMessages)

  return {
    tempUserChatMessage,
    tempAssistantChatMessage
  }
}

export const handleLocalChat = async (
  payload: ChatPayload,
  profile: Tables<"profiles">,
  chatSettings: ChatSettings,
  tempAssistantMessage: ChatMessage,
  isRegeneration: boolean,
  newAbortController: AbortController,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  const formattedMessages = await buildFinalMessages(payload, profile, [])

  const baseUrl = getPublicEnvVar('NEXT_PUBLIC_OLLAMA_URL')
  if (!baseUrl) {
    toast.error('Ollama no est\u00e1 configurado. Define NEXT_PUBLIC_OLLAMA_URL para usar modelos locales.')
    throw new Error('Missing NEXT_PUBLIC_OLLAMA_URL')
  }

  // Ollama API: https://github.com/jmorganca/ollama/blob/main/docs/api.md
  const response = await fetchChatResponse(
    `${baseUrl.replace(/\/+$/, '')}/api/chat`,
    {
      model: chatSettings.model,
      messages: formattedMessages,
      options: {
        temperature: payload.chatSettings.temperature
      }
    },
    false,
    newAbortController,
    setIsGenerating,
    setChatMessages
  )

  return await processResponse(
    response,
    isRegeneration
      ? payload.chatMessages[payload.chatMessages.length - 1]
      : tempAssistantMessage,
    false,
    newAbortController,
    setFirstTokenReceived,
    setChatMessages,
    setToolInUse
  )
}

export const handleHostedChat = async (
  payload: ChatPayload,
  profile: Tables<"profiles">,
  modelData: LLM,
  tempAssistantChatMessage: ChatMessage,
  isRegeneration: boolean,
  newAbortController: AbortController,
  newMessageImages: MessageImage[],
  chatImages: MessageImage[],
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  const provider =
    modelData.provider === "openai" && profile.use_azure_openai
      ? "azure"
      : modelData.provider

  let draftMessages = await buildFinalMessages(payload, profile, chatImages)

  let formattedMessages : any[] = []
  if (provider === "google") {
    formattedMessages = await adaptMessagesForGoogleGemini(payload, draftMessages)
  } else {
    formattedMessages = draftMessages
  }

  // Verificar si está en modo de redacción legal
  const chatMode = typeof window !== 'undefined' ? localStorage.getItem('chatMode') : null
  
  // Determinar endpoint según modelo y modo
  let apiEndpoint = provider === "custom" ? "/api/chat/custom" : "/api/chat/legal-agent"
  
  // Detectar modelos que usan LangChain Agent (tool calling nativo)
  const modelId = payload.chatSettings.model?.toLowerCase() || ''
  // Solo modelos Gemini usan LangChain Agent (tool calling nativo)
  const isLangChainModel = modelId.includes('gemini')
  
  if (chatMode === 'legal-writing') {
    apiEndpoint = "/api/chat/legal-writing"
  } else if (isLangChainModel) {
    apiEndpoint = "/api/chat/langchain-agent"
  }

  const requestBody = {
    chatSettings: payload.chatSettings,
    messages: formattedMessages,
    customModelId: provider === "custom" ? modelData.hostedId : ""
  }

  const response = await fetchChatResponse(
    apiEndpoint,
    requestBody,
    true,
    newAbortController,
    setIsGenerating,
    setChatMessages
  )

  return await processResponse(
    response,
    isRegeneration
      ? payload.chatMessages[payload.chatMessages.length - 1]
      : tempAssistantChatMessage,
    true,
    newAbortController,
    setFirstTokenReceived,
    setChatMessages,
    setToolInUse
  )
}

export const fetchChatResponse = async (
  url: string,
  body: object,
  isHosted: boolean,
  controller: AbortController,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    signal: controller.signal
  })

  if (!response.ok) {
    if (response.status === 404 && !isHosted) {
      toast.error(
        "Model not found. Make sure you have it downloaded via Ollama."
      )
    }

    const errorData = await response.json()

    toast.error(errorData.message)

    setIsGenerating(false)
    setChatMessages(prevMessages => prevMessages.slice(0, -2))
  }

  return response
}

export const processResponse = async (
  response: Response,
  lastChatMessage: ChatMessage,
  isHosted: boolean,
  controller: AbortController,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  let fullText = ""
  let contentToAdd = ""

  // Verificar si es respuesta de texto plano (como la del endpoint simple-direct)
  const contentType = response.headers.get('content-type') || ''
  const isPlainText = contentType.includes('text/plain')


  if (contentType.includes('application/json')) {
    try {
      const data = await response.json()
      const messageText =
        typeof data === "string"
          ? data
          : typeof data?.message === "string"
          ? data.message
          : JSON.stringify(data)
      const bibliography = Array.isArray(data?.bibliography)
        ? data.bibliography
        : undefined

      fullText = messageText

      setChatMessages(prev =>
        prev.map(chatMessage => {
          if (chatMessage.message.id === lastChatMessage.message.id) {
            return {
              ...chatMessage,
              message: {
                ...chatMessage.message,
                content: messageText
              },
              bibliography: bibliography ?? chatMessage.bibliography
            }
          }
          return chatMessage
        })
      )

      return messageText
    } catch (error) {
      console.error('Error parsing JSON response:', error)
      return ""
    }
  }

  if (isPlainText) {
    // Si es texto plano, leer toda la respuesta de una vez
    const text = await response.text()
    fullText = text
    
    // Actualizar el mensaje del asistente
    setChatMessages(prev =>
      prev.map(chatMessage => {
        if (chatMessage.message.id === lastChatMessage.message.id) {
          const updatedChatMessage: ChatMessage = {
            message: {
              ...chatMessage.message,
              content: fullText
            },
            fileItems: chatMessage.fileItems,
            bibliography: chatMessage.bibliography
          }
          return updatedChatMessage
        }
        return chatMessage
      })
    )
    
    return fullText
  }

  // Código para streaming con eventos JSON (langchain-agent) o texto plano
  if (response.body) {
    
    // Detectar si es streaming con eventos JSON (nuevo formato)
    const isEventStream = contentType.includes('text/event-stream')
    let thinkingContent = ''
    
    await consumeReadableStream(
      response.body,
      chunk => {
        try {
          const chunkStr = typeof chunk === 'string' ? chunk : String(chunk)
          
          // Procesar eventos JSON (formato: {"type": "...", ...}\n)
          if (isEventStream || chunkStr.startsWith('{')) {
            // Dividir por líneas y procesar cada evento JSON
            const lines = chunkStr.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              try {
                const event = JSON.parse(line)
                
                switch (event.type) {
                  case 'thinking':
                    thinkingContent += (thinkingContent ? '\n' : '') + event.content
                    setToolInUse("thinking")
                    break
                    
                  case 'thinking_done':
                    setToolInUse("none")
                    break
                    
                  case 'tool_start':
                    thinkingContent += `\n🔧 Usando: ${event.tool}`
                    setToolInUse(event.tool)
                    break
                    
                  case 'tool_end':
                    thinkingContent += ` → ${event.output}`
                    setToolInUse("none")
                    break
                    
                  case 'token':
                    // Agregar token a la respuesta - AHORA sí tenemos contenido real
                    fullText += event.content
                    setFirstTokenReceived(true)
                    break
                    
                  case 'sources':
                    break
                    
                  case 'done':
                    break
                    
                  case 'error':
                    fullText += event.message || 'Error desconocido'
                    setFirstTokenReceived(true)
                    break
                    
                  default:
                    // Evento desconocido, intentar agregar como texto
                    if (event.content) {
                      fullText += event.content
                      setFirstTokenReceived(true)
                    }
                }
              } catch (parseError) {
                // No es JSON válido, tratar como texto plano
                fullText += line
                setFirstTokenReceived(true)
              }
            }
          } else {
            // Formato texto plano (legacy)
            contentToAdd = isHosted
              ? chunkStr
              : String(chunkStr)
                  .trimEnd()
                  .split("\n")
                  .reduce(
                    (acc: string, line: string) => {
                      try {
                        return acc + JSON.parse(line).message.content
                      } catch {
                        return acc + line
                      }
                    },
                    ""
                  )
            fullText += contentToAdd
            setFirstTokenReceived(true)
          }
          
        } catch (error) {
          // Error parsing chunk - ignorar
        }

        // Detectar si el contenido acumulado es un draft válido
        // Solo intentar parsear si el stream está completo o si hay suficiente contenido
        let draft: any = null
        
        // Verificar si parece ser un JSON draft
        const looksLikeDraft = fullText.trim().startsWith('{') || 
                               fullText.includes('"type": "draft"') ||
                               fullText.includes('"type":"draft"')
        
        if (looksLikeDraft && fullText.length > 50) {
          try {
            const { validateDraftContent } = require("@/lib/utils/draft-utils")
            
            // Primero intentar validar el texto completo
            const validation = validateDraftContent(fullText)
            if (validation.valid && validation.draft) {
              draft = validation.draft
              console.log("✅ Draft detectado y validado desde contenido completo")
            } else {
              // Intentar extraer JSON de markdown code blocks
              const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/
              const match = fullText.match(jsonBlockRegex)
              if (match) {
                const revalidation = validateDraftContent(match[1])
                if (revalidation.valid && revalidation.draft) {
                  draft = revalidation.draft
                  console.log("✅ Draft detectado y validado desde markdown block")
                }
              } else {
                // Intentar extraer JSON si está al inicio del texto
                const jsonStart = fullText.indexOf('{')
                if (jsonStart !== -1 && jsonStart < 100) {
                  // Buscar el cierre del JSON
                  let braceCount = 0
                  let jsonEnd = jsonStart
                  for (let i = jsonStart; i < fullText.length; i++) {
                    if (fullText[i] === '{') braceCount++
                    if (fullText[i] === '}') braceCount--
                    if (braceCount === 0) {
                      jsonEnd = i + 1
                      break
                    }
                  }
                  if (jsonEnd > jsonStart) {
                    const jsonCandidate = fullText.substring(jsonStart, jsonEnd)
                    const candidateValidation = validateDraftContent(jsonCandidate)
                    if (candidateValidation.valid && candidateValidation.draft) {
                      draft = candidateValidation.draft
                      console.log("✅ Draft detectado y validado desde JSON extraído")
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn("⚠️ Error validando draft durante streaming:", e)
            // Ignorar errores de validación durante streaming
          }
        }
        
        // Si no se detectó como JSON pero parece ser un documento legal, intentar convertir
        if (!draft && fullText.length > 200) {
          const looksLikeDocument = 
            fullText.includes("ARTÍCULO") ||
            fullText.includes("ARTICULO") ||
            fullText.includes("CONTRATO") ||
            fullText.includes("TUTELA") ||
            fullText.includes("DEMANDA") ||
            fullText.includes("MEMORIAL") ||
            fullText.includes("ARRENDAMIENTO") ||
            fullText.includes("LEY APLICABLE")
          
          if (looksLikeDocument) {
            try {
              const { tryConvertToDraft } = require("@/lib/utils/draft-converter")
              const convertedDraft = tryConvertToDraft(fullText)
              if (convertedDraft) {
                draft = convertedDraft
                console.log("📄 Draft convertido desde texto plano durante streaming")
              }
            } catch (e) {
              console.warn("⚠️ Error convirtiendo texto a draft:", e)
            }
          }
        }

        // Actualizar mensaje con contenido, razonamiento y draft
        setChatMessages(prev =>
          prev.map(chatMessage => {
            if (chatMessage.message.id === lastChatMessage.message.id) {
              const updatedChatMessage: ChatMessage = {
                message: {
                  ...chatMessage.message,
                  content: fullText
                },
                fileItems: chatMessage.fileItems,
                // Agregar razonamiento al mensaje si existe
                thinking: thinkingContent || undefined,
                // Agregar draft si se detectó
                draft: draft || undefined
              }

              return updatedChatMessage
            }

            return chatMessage
          })
        )
      },
      controller.signal
    )

    return fullText
  } else {
    throw new Error("Response body is null")
  }
}

export const handleCreateChat = async (
  chatSettings: ChatSettings,
  profile: Tables<"profiles">,
  selectedWorkspace: Tables<"workspaces">,
  messageContent: string,
  selectedAssistant: Tables<"assistants">,
  newMessageFiles: ChatFile[],
  setSelectedChat: React.Dispatch<React.SetStateAction<Tables<"chats"> | null>>,
  setChats: React.Dispatch<React.SetStateAction<Tables<"chats">[]>>,
  setChatFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>
) => {
  const createdChat = await createChat({
    user_id: profile.user_id,
    workspace_id: selectedWorkspace.id,
    assistant_id: selectedAssistant?.id || null,
    context_length: chatSettings.contextLength,
    include_profile_context: chatSettings.includeProfileContext,
    include_workspace_instructions: chatSettings.includeWorkspaceInstructions,
    model: chatSettings.model,
    name: messageContent.substring(0, 100),
    prompt: chatSettings.prompt,
    temperature: chatSettings.temperature,
    embeddings_provider: chatSettings.embeddingsProvider
  })

  setSelectedChat(createdChat)
  setChats(chats => [createdChat, ...chats])

  await createChatFiles(
    newMessageFiles.map(file => ({
      user_id: profile.user_id,
      chat_id: createdChat.id,
      file_id: file.id
    }))
  )

  setChatFiles(prev => [...prev, ...newMessageFiles])

  return createdChat
}

export const handleCreateMessages = async (
  chatMessages: ChatMessage[],
  currentChat: Tables<"chats">,
  profile: Tables<"profiles">,
  modelData: LLM,
  messageContent: string,
  generatedText: string,
  newMessageImages: MessageImage[],
  isRegeneration: boolean,
  retrievedFileItems: Tables<"file_items">[],
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setChatFileItems: React.Dispatch<
    React.SetStateAction<Tables<"file_items">[]>
  >,
  setChatImages: React.Dispatch<React.SetStateAction<MessageImage[]>>,
  selectedAssistant: Tables<"assistants"> | null,
  bibliography?: BibliographyItem[]
) => {
  const legacyMessagesPersistenceEnabled =
    getPublicEnvVar("NEXT_PUBLIC_LEGACY_MESSAGES_PERSISTENCE") === "true"
  const localImagePaths = newMessageImages
    .map(image => image.path || image.base64 || "")
    .filter(Boolean)

  const finalUserMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: null,
    user_id: profile.user_id,
    content: messageContent,
    model: modelData.modelId,
    role: "user",
    sequence_number: chatMessages.length,
    image_paths: legacyMessagesPersistenceEnabled ? [] : localImagePaths
  }

  const finalAssistantMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: selectedAssistant?.id || null,
    user_id: profile.user_id,
    content: generatedText,
    model: modelData.modelId,
    role: "assistant",
    sequence_number: chatMessages.length + 1,
    image_paths: []
  }

  let finalChatMessages: ChatMessage[] = []

  if (isRegeneration) {
    const lastStartingMessage = chatMessages[chatMessages.length - 1].message

    const updatedMessage = await updateMessage(lastStartingMessage.id, {
      ...lastStartingMessage,
      content: generatedText
    })

    chatMessages[chatMessages.length - 1].message = updatedMessage
    if (bibliography !== undefined) {
      chatMessages[chatMessages.length - 1].bibliography = bibliography
    }

    finalChatMessages = [...chatMessages]

    setChatMessages(finalChatMessages)
  } else {
    const createdMessages = await createMessages([
      finalUserMessage,
      finalAssistantMessage
    ])

    if (!legacyMessagesPersistenceEnabled) {
      setChatImages(prevImages => [
        ...prevImages,
        ...newMessageImages.map(obj => {
          const normalizedPath = obj.path || obj.base64 || ""

          return {
            ...obj,
            messageId: createdMessages[0].id,
            path: normalizedPath
          }
        })
      ])

      const userMessageWithImages = {
        ...createdMessages[0],
        image_paths: localImagePaths
      }

      finalChatMessages = [
        ...chatMessages,
        {
          message: userMessageWithImages,
          fileItems: []
        },
        {
          message: createdMessages[1],
          fileItems: retrievedFileItems.map(fileItem => fileItem.id),
          ...(bibliography ? { bibliography } : {})
        }
      ]

      setChatFileItems(prevFileItems => {
        const newFileItems = retrievedFileItems.filter(
          fileItem => !prevFileItems.some(prevItem => prevItem.id === fileItem.id)
        )

        return [...prevFileItems, ...newFileItems]
      })

      setChatMessages(finalChatMessages)
      return
    }

    // Upload each image (stored in newMessageImages) for the user message to message_images bucket
    const uploadPromises = newMessageImages
      .filter(obj => obj.file !== null)
      .map(obj => {
        let filePath = `${profile.user_id}/${currentChat.id}/${
          createdMessages[0].id
        }/${uuidv4()}`

        return uploadMessageImage(filePath, obj.file as File).catch(error => {
          console.error(`Failed to upload image at ${filePath}:`, error)
          return null
        })
      })

    const paths = (await Promise.all(uploadPromises)).filter(
      Boolean
    ) as string[]

    setChatImages(prevImages => [
      ...prevImages,
      ...newMessageImages.map((obj, index) => ({
        ...obj,
        messageId: createdMessages[0].id,
        path: paths[index]
      }))
    ])

    const updatedMessage = await updateMessage(createdMessages[0].id, {
      ...createdMessages[0],
      image_paths: paths
    })

    await createMessageFileItems(
      retrievedFileItems.map(fileItem => {
        return {
          user_id: profile.user_id,
          message_id: createdMessages[1].id,
          file_item_id: fileItem.id
        }
      })
    )

    finalChatMessages = [
      ...chatMessages,
      {
        message: updatedMessage,
        fileItems: []
      },
      {
        message: createdMessages[1],
        fileItems: retrievedFileItems.map(fileItem => fileItem.id),
        ...(bibliography ? { bibliography } : {})
      }
    ]

    setChatFileItems(prevFileItems => {
      const newFileItems = retrievedFileItems.filter(
        fileItem => !prevFileItems.some(prevItem => prevItem.id === fileItem.id)
      )

      return [...prevFileItems, ...newFileItems]
    })

    setChatMessages(finalChatMessages)
  }
}
