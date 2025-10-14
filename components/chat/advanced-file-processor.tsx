"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  FileText, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Brain,
  FileImage,
  Table
} from "lucide-react"

interface AdvancedFileProcessorProps {
  fileId: string
  fileName: string
  fileType: string
  onProcessingComplete?: (result: any) => void
  onError?: (error: string) => void
}

interface ProcessingResult {
  chunks: number
  totalTokens: number
  documentMetadata: {
    title?: string
    pages?: number
    wordCount: number
    language?: string
  }
}

export function AdvancedFileProcessor({
  fileId,
  fileName,
  fileType,
  onProcessingComplete,
  onError
}: AdvancedFileProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processFile = async () => {
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      // Simular progreso
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      const formData = new FormData()
      formData.append("file_id", fileId)

      const response = await fetch("/api/retrieval/process-advanced", {
        method: "POST",
        body: formData
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to process file")
      }

      const data = await response.json()
      setResult(data.metadata)
      onProcessingComplete?.(data)

    } catch (err: any) {
      setError(err.message)
      onError?.(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'html':
      case 'htm':
        return <FileImage className="h-5 w-5 text-orange-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getLanguageBadge = (language?: string) => {
    if (!language) return null
    
    const languages = {
      'es': { label: 'Español', color: 'bg-green-100 text-green-800' },
      'en': { label: 'English', color: 'bg-blue-100 text-blue-800' }
    }
    
    const lang = languages[language as keyof typeof languages]
    if (!lang) return null
    
    return (
      <Badge className={lang.color}>
        {lang.label}
      </Badge>
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Procesamiento Avanzado de Documentos
        </CardTitle>
        <CardDescription>
          Utiliza algoritmos avanzados para extraer mejor información de tus documentos
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información del archivo */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          {getFileIcon(fileType)}
          <div className="flex-1">
            <p className="font-medium">{fileName}</p>
            <p className="text-sm text-gray-500">Tipo: {fileType.toUpperCase()}</p>
          </div>
        </div>

        {/* Características del procesamiento avanzado */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <span>Detección de estructura</span>
          </div>
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-green-500" />
            <span>Extracción de tablas</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span>Chunking inteligente</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-orange-500" />
            <span>Detección de idioma</span>
          </div>
        </div>

        {/* Progreso */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Procesando documento...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resultado */}
        {result && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Procesamiento completado exitosamente</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Chunks:</span> {result.chunks}
                  </div>
                  <div>
                    <span className="font-medium">Tokens:</span> {result.totalTokens.toLocaleString()}
                  </div>
                  {result.documentMetadata.pages && (
                    <div>
                      <span className="font-medium">Páginas:</span> {result.documentMetadata.pages}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Palabras:</span> {result.documentMetadata.wordCount.toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  {result.documentMetadata.title && (
                    <Badge variant="outline">
                      {result.documentMetadata.title}
                    </Badge>
                  )}
                  {getLanguageBadge(result.documentMetadata.language)}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Botón de procesamiento */}
        <Button 
          onClick={processFile}
          disabled={isProcessing}
          className="w-full"
          variant={result ? "outline" : "default"}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : result ? (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Reprocesar con IA Avanzada
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Procesar con IA Avanzada
            </>
          )}
        </Button>

        {/* Información adicional */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• El procesamiento avanzado mejora la calidad de los embeddings</p>
          <p>• Detecta automáticamente la estructura del documento</p>
          <p>• Optimiza el chunking para mejor recuperación de información</p>
          <p>• Utiliza OpenRouter para generar embeddings de alta calidad</p>
        </div>
      </CardContent>
    </Card>
  )
}















