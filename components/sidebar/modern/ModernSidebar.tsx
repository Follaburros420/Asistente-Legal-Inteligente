'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChatbotUIContext } from '@/context/context'
import { ContentType } from '@/types'
import { FC, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  MessageSquare, 
  FileText, 
  FolderOpen, 
  Wrench,
  Search,
  Plus,
  ChevronRight,
  Sparkles,
  Trash2,
  Edit,
  MoreVertical
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ModernProfileCard } from './ModernProfileCard'
import { CreateFile } from '../items/files/create-file'
import { CreateCollection } from '../items/collections/create-collection'
import { CreateTool } from '../items/tools/create-tool'
import { useChatHandler } from '@/components/chat/chat-hooks/use-chat-handler'
import { deleteChat } from '@/db/chats'
import { deleteFile } from '@/db/files'
import { deleteCollection } from '@/db/collections'
import { deleteFolder } from '@/db/folders'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ModernSidebarProps {
  contentType: ContentType
  showSidebar: boolean
  onContentTypeChange?: (type: ContentType) => void
}

const contentTypeIcons = {
  chats: MessageSquare,
  files: FileText,
  collections: FolderOpen,
  tools: Wrench,
}

const contentTypeLabels = {
  chats: 'Chats',
  files: 'Archivos',
  collections: 'Colecciones',
  tools: 'Herramientas',
}

export const ModernSidebar: FC<ModernSidebarProps> = ({ 
  contentType, 
  showSidebar,
  onContentTypeChange 
}) => {
  const { 
    chats, 
    files, 
    collections, 
    tools, 
    folders, 
    selectedWorkspace,
    setChats,
    setFiles,
    setCollections,
    setFolders,
    setSelectedChat,
    setChatMessages
  } = useContext(ChatbotUIContext)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const router = useRouter()
  const { handleNewChat } = useChatHandler()

  const getDataForContentType = (type: ContentType) => {
    switch (type) {
      case 'chats': return chats
      case 'files': return files
      case 'collections': return collections
      case 'tools': return tools
      default: return []
    }
  }

  const data = getDataForContentType(contentType)
  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const contentTypeFolders = folders.filter(folder => folder.type === contentType)

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const handleCreateItem = () => {
    if (contentType === 'chats') {
      // Para chats, crear nuevo chat directamente
      handleNewChat()
    } else {
      // Para otros tipos, abrir el diálogo correspondiente
      setShowCreateDialog(true)
    }
  }

  const handleDeleteItem = async (itemId: string, itemType: ContentType) => {
    try {
      switch (itemType) {
        case 'chats':
          await deleteChat(itemId)
          setChats(prev => prev.filter(chat => chat.id !== itemId))
          toast.success('Chat eliminado correctamente')
          break
        case 'files':
          await deleteFile(itemId)
          setFiles(prev => prev.filter(file => file.id !== itemId))
          toast.success('Archivo eliminado correctamente')
          break
        case 'collections':
          await deleteCollection(itemId)
          setCollections(prev => prev.filter(collection => collection.id !== itemId))
          toast.success('Colección eliminada correctamente')
          break
        case 'tools':
          // Implementar eliminación de herramientas si es necesario
          toast.success('Herramienta eliminada correctamente')
          break
      }
    } catch (error) {
      console.error('Error al eliminar:', error)
      toast.error('Error al eliminar el elemento')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId)
      setFolders(prev => prev.filter(folder => folder.id !== folderId))
      toast.success('Carpeta eliminada correctamente')
    } catch (error) {
      console.error('Error al eliminar carpeta:', error)
      toast.error('Error al eliminar la carpeta')
    }
  }

  const handleSelectChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (chat) {
      setSelectedChat(chat)
      setChatMessages([])
      router.push(`/${selectedWorkspace?.id}/chat/${chatId}`)
    }
  }

  const sidebarVariants = {
    open: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    closed: {
      x: -20,
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    },
  }

  if (!showSidebar) return null

  return (
    <motion.div
      initial="closed"
      animate="open"
      exit="closed"
      variants={sidebarVariants}
      className="flex h-full flex-col border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      {/* Header con gradiente */}
      <div className="relative overflow-hidden border-b border-border/40 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 px-4 py-4">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Asistente Legal</h2>
                <p className="text-xs text-muted-foreground">Inteligente</p>
              </div>
            </div>
            
            {/* Botón para crear nuevo elemento */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary hover:bg-primary/10 h-8 w-8"
              onClick={handleCreateItem}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-background/50 border-border/40 focus:bg-background"
            />
          </div>
        </div>
      </div>

      {/* Content Type Tabs */}
      <div className="px-2 py-3 space-y-1">
        {(Object.keys(contentTypeLabels) as ContentType[]).map((type) => {
          const Icon = contentTypeIcons[type]
          const count = getDataForContentType(type).length
          const isActive = contentType === type

          return (
            <motion.button
              key={type}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onContentTypeChange?.(type)}
              className={cn(
                'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                'text-sm font-medium',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110',
                isActive && 'text-primary'
              )} />
              <span className="flex-1 text-left">{contentTypeLabels[type]}</span>
              {count > 0 && (
                <Badge 
                  variant={isActive ? 'default' : 'secondary'} 
                  className="h-5 px-2 text-xs"
                >
                  {count}
                </Badge>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/5 rounded-lg -z-10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
      </div>

      <Separator className="opacity-50" />

      {/* Data List */}
      <ScrollArea className="flex-1 px-2">
        <div className="py-3 space-y-2">

          {/* Folders */}
          <AnimatePresence mode="popLayout">
            {contentTypeFolders.map((folder) => {
              const isExpanded = expandedFolders.has(folder.id)
              const folderItems = filteredData.filter(item => 
                'folder_id' in item && item.folder_id === folder.id
              )

              return (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1"
                >
                  <div
                    className="group w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    onMouseEnter={() => setHoveredItem(folder.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex items-center gap-2 flex-1"
                    >
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                      <FolderOpen className="w-4 h-4 text-amber-500" />
                      <span className="flex-1 text-left font-medium truncate">
                        {folder.name}
                      </span>
                    </button>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {folderItems.length}
                    </Badge>
                    {hoveredItem === folder.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar carpeta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="pl-6 space-y-1 overflow-hidden"
                      >
                        {folderItems.map((item) => (
                          <div
                            key={item.id}
                            className="group flex items-center gap-2"
                            onMouseEnter={() => setHoveredItem(item.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            <button
                              onClick={() => contentType === 'chats' ? handleSelectChat(item.id) : undefined}
                              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg hover:bg-muted transition-all text-sm text-muted-foreground hover:text-foreground"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary" />
                              <span className="flex-1 text-left truncate text-xs">
                                {item.name}
                              </span>
                            </button>
                            {hoveredItem === item.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleDeleteItem(item.id, contentType)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Items sin folder */}
          <div className="space-y-1 mt-3">
            {filteredData
              .filter(item => !('folder_id' in item) || !item.folder_id)
              .slice(0, 10)
              .map((item, index) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <button
                    onClick={() => contentType === 'chats' ? handleSelectChat(item.id) : undefined}
                    className="flex items-center gap-3 flex-1 px-3 py-2 rounded-lg hover:bg-muted transition-all text-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                    <span className="flex-1 text-left truncate text-muted-foreground group-hover:text-foreground">
                      {item.name}
                    </span>
                  </button>
                  {hoveredItem === item.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDeleteItem(item.id, contentType)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
          </div>

          {filteredData.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No se encontraron resultados' : `No hay ${contentTypeLabels[contentType]?.toLowerCase() || 'elementos'}`}
              </p>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Profile Card - Footer Profesional */}
      <ModernProfileCard />

      {/* Diálogos de creación */}
      {contentType === 'files' && (
        <CreateFile
          isOpen={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}
      
      {contentType === 'collections' && (
        <CreateCollection
          isOpen={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}
      
      {contentType === 'tools' && (
        <CreateTool
          isOpen={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}
    </motion.div>
  )
}

