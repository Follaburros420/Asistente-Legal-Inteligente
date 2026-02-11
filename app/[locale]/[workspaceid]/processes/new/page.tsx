"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DocumentUploadZone } from "@/components/processes/document-upload-zone"
import { toast } from "sonner"

export default function NewProcessPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.workspaceid as string

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("El nombre del proceso es requerido")
      return
    }

    if (files.length === 0) {
      toast.error("Debes subir al menos un documento")
      return
    }

    setIsSubmitting(true)

    try {
      // Create process
      const formData = new FormData()
      formData.append("name", name)
      formData.append("description", description || "")
      formData.append("context", description || "")

      const createResponse = await fetch("/api/processes/create", {
        method: "POST",
        body: formData
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(error.error || "Error al crear el proceso")
      }

      const { process } = await createResponse.json()

      // Upload documents
      const uploadFormData = new FormData()
      files.forEach((file) => {
        uploadFormData.append("files", file)
      })

      const uploadResponse = await fetch(`/api/processes/${process.id}/upload`, {
        method: "POST",
        body: uploadFormData
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || "Error al subir documentos")
      }

      toast.success("Proceso creado exitosamente. Los documentos se están indexando...")
      
      // Redirect to processes list page to ensure sidebar refreshes
      // This forces a full reload of the layout which will fetch updated processes
      window.location.href = `/${workspaceId}/processes`

    } catch (error: any) {
      console.error("Error creating process:", error)
      toast.error(error.message || "Error al crear el proceso")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Nuevo Proceso</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre del proceso <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Caso de divorcio - Juan Pérez"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve del proceso (opcional)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Document Upload */}
          <div className="space-y-2">
            <Label>
              Documentos <span className="text-red-500">*</span>
            </Label>
            <DocumentUploadZone
              files={files}
              onFilesChange={setFiles}
            />
            <p className="text-xs text-muted-foreground">
              Sube los documentos relacionados con este proceso. Se indexarán automáticamente.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || files.length === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear proceso e indexar"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

