'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, MessageSquare, FileText, FolderOpen, Wrench } from 'lucide-react'
import { FC, ElementType, useContext, useMemo, useState } from 'react'
import { ChatbotUIContext } from '@/context/context'
import { ContentType } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WorkspaceSwitcher } from '@/components/utility/workspace-switcher'
import { ModernProfileCard } from './ModernProfileCard'
import { cn } from '@/lib/utils'
import { SidebarCreateButtons } from '../sidebar-create-buttons'
import { SidebarSearch } from '../sidebar-search'
import { SidebarDataList } from '../sidebar-data-list'

interface ModernSidebarProps {
  contentType: ContentType
  showSidebar: boolean
  onContentTypeChange?: (type: ContentType) => void
}

const HEADER_GRADIENT_CLASSES =
  'relative overflow-hidden border-b border-border/40 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 px-4 py-1'

const sidebarVariants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
}

export const ModernSidebar: FC<ModernSidebarProps> = ({
  contentType,
  showSidebar,
  onContentTypeChange
}) => {
  const { chats, files, collections, tools, folders } =
    useContext(ChatbotUIContext)
  const [searchTerm, setSearchTerm] = useState('')

  const data = useMemo(() => {
    switch (contentType) {
      case 'chats':
        return chats
      case 'files':
        return files
      case 'collections':
        return collections
      case 'tools':
        return tools
      default:
        return []
    }
  }, [chats, files, collections, tools, contentType])

  const contentTypeFolders = useMemo(
    () => folders.filter(folder => folder.type === contentType),
    [folders, contentType]
  )

  const navItems: Array<{
    key: ContentType
    label: string
    count: number
    icon: ElementType
  }> = [
    { key: 'chats', label: 'Chats', count: chats.length, icon: MessageSquare },
    { key: 'files', label: 'Archivos', count: files.length, icon: FileText },
    { key: 'collections', label: 'Colecciones', count: collections.length, icon: FolderOpen },
    { key: 'tools', label: 'Herramientas', count: tools.length, icon: Wrench }
  ]

  const handleSelectContentType = (type: ContentType) => {
    if (type === contentType) return
    onContentTypeChange?.(type)
  }

  const filteredData = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return data

    return data.filter(item =>
      (item.name || '').toLowerCase().includes(normalizedSearch)
    )
  }, [data, searchTerm])

  return (
    <AnimatePresence>
      {showSidebar && (
        <motion.div
          key="modern-sidebar"
          initial="closed"
          animate="open"
          exit="closed"
          variants={sidebarVariants}
          className="flex h-full flex-col border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        >
          <div className={HEADER_GRADIENT_CLASSES}>
            <div className="relative z-10">
              <div className="flex items-center justify-center">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent text-center">ALI</h2>
                </div>
              </div>

              <div>
                <WorkspaceSwitcher />
              </div>
            </div>
          </div>

          <div className="px-4 pt-4 pb-2 border-b border-border/40 space-y-3">
            <SidebarCreateButtons contentType={contentType} hasData={data.length > 0} />
            <SidebarSearch
              contentType={contentType}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </div>

          <div className="px-4 py-3 border-b border-border/40">
            <nav className="space-y-1">
              {navItems.map(item => {
                const IconComponent = item.icon
                const isActive = item.key === contentType
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectContentType(item.key)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <IconComponent className={cn('w-4 h-4', !isActive && 'text-muted-foreground')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <span
                      className={cn(
                        'min-w-[32px] rounded-full px-2 py-1 text-center text-xs font-semibold leading-none',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="py-4">
              <SidebarDataList
                contentType={contentType}
                data={filteredData as any}
                folders={contentTypeFolders}
              />
            </div>
          </ScrollArea>

          <ModernProfileCard />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
