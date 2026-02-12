// Only used in use-chat-handler.tsx to keep it clean

import { createChatFiles } from "@/db/chat-files"
import { createChat } from "@/db/chats"
import { createMessageFileItems } from "@/db/message-file-items"
import { createMessages, updateMessage } from "@/db/messages"
import { uploadMessageImage } from "@/db/storage/message-images"
import {
  buildFinalMessages
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

type ProcessedChatResponse = {
  text: string
  bibliography?: BibliographyItem[]
}

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

  // Always send normalized text messages to backend chat endpoints.
  // Endpoints expect OpenAI-style messages with string `content`.
  const formattedMessages = await buildFinalMessages(payload, profile, chatImages)

  // Verificar si está en modo de redacción legal
  const chatMode = typeof window !== 'undefined' ? localStorage.getItem('chatMode') : null
  
  // Determinar endpoint según modo: usar stream con LangChain por defecto
  let apiEndpoint = provider === "custom" ? "/api/chat/custom" : "/api/chat/langchain-agent"
  
  if (chatMode === 'legal-writing') {
    apiEndpoint = "/api/chat/legal-writing"
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
): Promise<ProcessedChatResponse> => {
  let fullText = ""
  let streamedBibliography: BibliographyItem[] = []
  const progressLines: string[] = []

  const pushProgressLine = (value: unknown) => {
    if (typeof value !== "string") return
    const cleaned = value.replace(/\s+/g, " ").trim()
    if (!cleaned) return
    const previous = progressLines[progressLines.length - 1]
    if (previous !== cleaned) {
      progressLines.push(cleaned)
    }
    setToolInUse(cleaned)
  }

  const normalizeSources = (rawSources: any[]): BibliographyItem[] => {
    const normalizedSources = rawSources
      .filter((s: any) => typeof s?.url === "string" && s.url.startsWith("http"))
      .map((s: any, idx: number) => ({
        id: `stream-source-${idx + 1}`,
        title:
          typeof s?.title === "string" && s.title.trim().length > 0
            ? s.title.trim()
            : "Fuente legal",
        url: s.url,
        type:
          typeof s?.type === "string" && s.type.trim().length > 0
            ? s.type.trim()
            : "legal"
      }))

    return normalizedSources.filter(
      (item, idx, arr) => arr.findIndex(x => x.url === item.url) === idx
    )
  }

  const detectDraftFromText = (text: string) => {
    let draft: any = null

    const looksLikeDraft =
      text.trim().startsWith("{") ||
      text.includes('"type": "draft"') ||
      text.includes('"type":"draft"')

    if (looksLikeDraft && text.length > 50) {
      try {
        const { validateDraftContent } = require("@/lib/utils/draft-utils")
        const validation = validateDraftContent(text)
        if (validation.valid && validation.draft) {
          draft = validation.draft
        } else {
          const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/
          const match = text.match(jsonBlockRegex)
          if (match) {
            const revalidation = validateDraftContent(match[1])
            if (revalidation.valid && revalidation.draft) {
              draft = revalidation.draft
            }
          } else {
            const jsonStart = text.indexOf("{")
            if (jsonStart !== -1 && jsonStart < 100) {
              let braceCount = 0
              let jsonEnd = jsonStart
              for (let i = jsonStart; i < text.length; i++) {
                if (text[i] === "{") braceCount++
                if (text[i] === "}") braceCount--
                if (braceCount === 0) {
                  jsonEnd = i + 1
                  break
                }
              }
              if (jsonEnd > jsonStart) {
                const jsonCandidate = text.substring(jsonStart, jsonEnd)
                const candidateValidation = validateDraftContent(jsonCandidate)
                if (candidateValidation.valid && candidateValidation.draft) {
                  draft = candidateValidation.draft
                }
              }
            }
          }
        }
      } catch {
        // ignore invalid draft while streaming
      }
    }

    if (!draft && text.length > 200) {
      const looksLikeDocument =
        text.includes("ARTICULO") ||
        text.includes("CONTRATO") ||
        text.includes("TUTELA") ||
        text.includes("DEMANDA") ||
        text.includes("MEMORIAL")

      if (looksLikeDocument) {
        try {
          const { tryConvertToDraft } = require("@/lib/utils/draft-converter")
          const convertedDraft = tryConvertToDraft(text)
          if (convertedDraft) {
            draft = convertedDraft
          }
        } catch {
          // ignore draft conversion errors during streaming
        }
      }
    }

    return draft
  }

  const updateAssistantMessage = () => {
    const draft = detectDraftFromText(fullText)
    const thinkingContent = progressLines.join("\n")

    setChatMessages(prev =>
      prev.map(chatMessage => {
        if (chatMessage.message.id === lastChatMessage.message.id) {
          const updatedChatMessage: ChatMessage = {
            message: {
              ...chatMessage.message,
              content: fullText
            },
            fileItems: chatMessage.fileItems,
            thinking: thinkingContent || undefined,
            bibliography:
              streamedBibliography.length > 0
                ? streamedBibliography
                : chatMessage.bibliography,
            draft: draft || undefined
          }
          return updatedChatMessage
        }
        return chatMessage
      })
    )
  }

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

      setToolInUse("none")
      return {
        text: messageText,
        bibliography
      }
    } catch (error) {
      console.error('Error parsing JSON response:', error)
      return { text: "" }
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
    setToolInUse("none")
    return { text: fullText }
  }

  // Código para streaming con eventos JSON (langchain-agent) o texto plano
  if (response.body) {
    // Detectar si es streaming con eventos JSON (nuevo formato)
    const isEventStream = contentType.includes('text/event-stream')
    let eventBuffer = ''

    const processEvent = (event: any) => {
      switch (event?.type) {
        case 'thinking':
          pushProgressLine(event.content)
          break

        case 'status':
          pushProgressLine(event.message || event.label)
          break

        case 'thinking_done':
          pushProgressLine("Redactando respuesta final")
          break

        case 'tool_start':
          pushProgressLine(event.label || "Investigando fuentes legales")
          break

        case 'tool_end':
          pushProgressLine(event.message || "Fuentes contrastadas")
          break

        case 'token':
          if (typeof event.content === "string") {
            fullText += event.content
            setFirstTokenReceived(true)
          }
          break

        case 'sources':
          if (Array.isArray(event.sources)) {
            streamedBibliography = normalizeSources(event.sources)
          }
          break

        case 'done':
          setToolInUse("none")
          break

        case 'error':
          if (typeof event.message === "string" && event.message.trim().length > 0) {
            fullText += event.message
            setFirstTokenReceived(true)
          }
          setToolInUse("none")
          break

        case 'tool_error':
          pushProgressLine("Continuando validación con otras fuentes")
          break

        default:
          break
      }
    }

    await consumeReadableStream(
      response.body,
      chunk => {
        const chunkStr = typeof chunk === 'string' ? chunk : String(chunk)

        if (isEventStream || chunkStr.trimStart().startsWith('{')) {
          eventBuffer += chunkStr
          let newlineIndex = eventBuffer.indexOf('\n')

          while (newlineIndex !== -1) {
            const rawLine = eventBuffer.slice(0, newlineIndex).trim()
            eventBuffer = eventBuffer.slice(newlineIndex + 1)

            if (rawLine.length > 0) {
              try {
                const event = JSON.parse(rawLine)
                processEvent(event)
              } catch {
                if (!isEventStream) {
                  fullText += rawLine
                  setFirstTokenReceived(true)
                }
              }
            }

            newlineIndex = eventBuffer.indexOf('\n')
          }

          updateAssistantMessage()
          return
        }

        const contentToAdd = isHosted
          ? chunkStr
          : String(chunkStr)
              .trimEnd()
              .split("\n")
              .reduce((acc: string, line: string) => {
                try {
                  return acc + JSON.parse(line).message.content
                } catch {
                  return acc + line
                }
              }, "")

        fullText += contentToAdd
        setFirstTokenReceived(true)
        updateAssistantMessage()
      },
      controller.signal
    )

    if (eventBuffer.trim().length > 0) {
      try {
        const trailingEvent = JSON.parse(eventBuffer.trim())
        processEvent(trailingEvent)
        updateAssistantMessage()
      } catch {
        if (!isEventStream) {
          fullText += eventBuffer
          setFirstTokenReceived(true)
          updateAssistantMessage()
        }
      }
    }

    setToolInUse("none")

    return {
      text: fullText,
      bibliography:
        streamedBibliography.length > 0 ? streamedBibliography : undefined
    }
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
  const finalUserMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: null,
    user_id: profile.user_id,
    content: messageContent,
    model: modelData.modelId,
    role: "user",
    sequence_number: chatMessages.length,
    image_paths: []
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

    const createdMessageFileItems = await createMessageFileItems(
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
