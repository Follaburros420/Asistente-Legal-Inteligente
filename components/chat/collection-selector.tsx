"use client"

import { useState, useContext, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  FolderOpen, 
  FileText, 
  Search, 
  CheckCircle2,
  X,
  Sparkles
} from "lucide-react"
import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { toast } from "sonner"
import { getCollectionFiles, CollectionWithFiles } from "@/lib/collections/get-collection-files"

interface CollectionSelectorProps {
  onCollectionSelect: (collection: Tables<"collections">, files: Tables<"files">[]) => void
  selectedCollection?: Tables<"collections"> | null
  selectedFiles?: Tables<"files">[]
}

export function CollectionSelector({ 
  onCollectionSelect, 
  selectedCollection, 
  selectedFiles = [] 
}: CollectionSelectorProps) {
  const { collections } = useContext(ChatbotUIContext)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [collectionsWithFiles, setCollectionsWithFiles] = useState<CollectionWithFiles[]>([])
  const [loading, setLoading] = useState(false)

  // Filtrar colecciones basado en búsqueda
  const filteredCollections = collectionsWithFiles.filter(collection =>
    collection.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Cargar colecciones con archivos cuando se abre el diálogo
  useEffect(() => {
    if (isOpen && collectionsWithFiles.length === 0) {
      loadCollectionsWithFiles()
    }
  }, [isOpen])

  const loadCollectionsWithFiles = async () => {
    setLoading(true)
    try {
      const collectionsData = await Promise.all(
        collections.map(async (collection) => {
          const collectionWithFiles = await getCollectionFiles(collection.id)
          return collectionWithFiles || {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            files: []
          }
        })
      )
      setCollectionsWithFiles(collectionsData)
    } catch (error) {
      console.error("Error cargando colecciones:", error)
      toast.error("Error al cargar las colecciones")
    } finally {
      setLoading(false)
    }
  }

  const handleCollectionSelect = async (collection: Tables<"collections">) => {
    try {
      const collectionWithFiles = await getCollectionFiles(collection.id)
      if (collectionWithFiles) {
        onCollectionSelect(collection, collectionWithFiles.files)
        setIsOpen(false)
        toast.success(`Colección "${collection.name}" seleccionada con ${collectionWithFiles.files.length} archivos`)
      } else {
        toast.error("Error al cargar los archivos de la colección")
      }
    } catch (error) {
      console.error("Error seleccionando colección:", error)
      toast.error("Error al seleccionar la colección")
    }
  }

  const handleClearSelection = () => {
    onCollectionSelect(null as any, [])
    toast.success("Selección de colección limpiada")
  }

  return (
    <div className="space-y-1">
      {/* Colección Seleccionada - Compacta */}
      {selectedCollection && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
            <FolderOpen className="w-3 h-3" />
            <span className="truncate max-w-32">{selectedCollection.name}</span>
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {selectedFiles.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Selector de Colección - Compacto */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={collections.length === 0}
          >
            <FolderOpen className="w-3 h-3" />
            {selectedCollection ? "Cambiar" : "Colección"}
            {collections.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {collections.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Seleccionar Colección para Chat
            </DialogTitle>
            <DialogDescription>
              Selecciona una colección para que el modelo pueda acceder a todos sus archivos simultáneamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar colecciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            {/* Lista de Colecciones */}
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-sm">Cargando colecciones...</p>
                  </div>
                ) : filteredCollections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {searchTerm ? "No se encontraron colecciones" : "No hay colecciones disponibles"}
                    </p>
                  </div>
                ) : (
                  filteredCollections.map((collection) => {
                    const isSelected = selectedCollection?.id === collection.id

                    return (
                      <Card
                        key={collection.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => handleCollectionSelect(collection)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                isSelected 
                                  ? "bg-primary/10 text-primary" 
                                  : "bg-muted"
                              }`}>
                                <FolderOpen className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="font-medium text-sm">{collection.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {collection.description || "Sin descripción"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="gap-1">
                                <FileText className="w-3 h-3" />
                                {collection.files.length}
                              </Badge>
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
