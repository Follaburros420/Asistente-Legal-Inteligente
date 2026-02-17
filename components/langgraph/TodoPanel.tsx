"use client"

/**
 * TodoPanel Component
 * 
 * Displays the checklist/progress of the legal assistant pipeline.
 */

import * as React from "react"
import { CheckCircle2, Circle, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ============================================================================
// TYPES
// ============================================================================

export type TodoStatus = "pending" | "running" | "done" | "error"

export interface TodoItem {
  id: string
  label: string
  status: TodoStatus
  details?: string
  started_at?: string
  completed_at?: string
}

export interface TodoPanelProps {
  items: TodoItem[]
  title?: string
  className?: string
  compact?: boolean
}

// ============================================================================
// STATUS ICON COMPONENT
// ============================================================================

function StatusIcon({ status, className }: { status: TodoStatus; className?: string }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className={cn("text-green-500", className)} />
    case "running":
      return <Loader2 className={cn("text-blue-500 animate-spin", className)} />
    case "error":
      return <AlertCircle className={cn("text-red-500", className)} />
    default:
      return <Circle className={cn("text-gray-400", className)} />
  }
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: TodoStatus }) {
  const variants: Record<TodoStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    done: { label: "Completado", variant: "default" },
    running: { label: "En progreso", variant: "secondary" },
    error: { label: "Error", variant: "destructive" },
    pending: { label: "Pendiente", variant: "outline" }
  }
  
  const config = variants[status]
  
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  )
}

// ============================================================================
// TODO ITEM COMPONENT
// ============================================================================

function TodoItemComponent({ item, compact }: { item: TodoItem; compact?: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const hasDetails = item.details || item.started_at || item.completed_at
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <StatusIcon status={item.status} className="h-4 w-4" />
        <span className={cn(
          "text-sm",
          item.status === "done" && "text-muted-foreground line-through",
          item.status === "running" && "font-medium"
        )}>
          {item.label}
        </span>
      </div>
    )
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 py-2">
        <StatusIcon status={item.status} className="h-5 w-5" />
        <div className="flex-1">
          <CollapsibleTrigger asChild disabled={!hasDetails}>
            <button className="flex items-center gap-1 text-left w-full group">
              {hasDetails && (
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen && "rotate-90"
                )} />
              )}
              <span className={cn(
                "text-sm font-medium",
                item.status === "done" && "text-muted-foreground",
                item.status === "running" && "text-blue-600"
              )}>
                {item.label}
              </span>
            </button>
          </CollapsibleTrigger>
        </div>
        <StatusBadge status={item.status} />
      </div>
      
      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-7 pb-2 text-sm text-muted-foreground">
            {item.details && (
              <p className="mb-1">{item.details}</p>
            )}
            {item.started_at && (
              <p className="text-xs">Iniciado: {new Date(item.started_at).toLocaleTimeString()}</p>
            )}
            {item.completed_at && (
              <p className="text-xs">Completado: {new Date(item.completed_at).toLocaleTimeString()}</p>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TodoPanel({ 
  items, 
  title = "Progreso", 
  className,
  compact = false 
}: TodoPanelProps) {
  // Calculate progress
  const completed = items.filter(i => i.status === "done").length
  const total = items.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  
  // Group items by status
  const runningItems = items.filter(i => i.status === "running")
  const pendingItems = items.filter(i => i.status === "pending")
  const doneItems = items.filter(i => i.status === "done")
  const errorItems = items.filter(i => i.status === "error")
  
  // Sort: running first, then pending, then done, then errors
  const sortedItems = [...runningItems, ...pendingItems, ...doneItems, ...errorItems]
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {completed}/{total}
          </Badge>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
          <div 
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className={cn(compact ? "max-h-32" : "max-h-64")}>
          <div className="space-y-1">
            {sortedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin tareas pendientes
              </p>
            ) : (
              sortedItems.map(item => (
                <TodoItemComponent key={item.id} item={item} compact={compact} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// MINI VERSION FOR SIDEBAR
// ============================================================================

export function TodoMini({ items }: { items: TodoItem[] }) {
  const completed = items.filter(i => i.status === "done").length
  const total = items.length
  const hasRunning = items.some(i => i.status === "running")
  const hasError = items.some(i => i.status === "error")
  
  return (
    <div className="flex items-center gap-2 text-sm">
      {hasRunning ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      ) : hasError ? (
        <AlertCircle className="h-4 w-4 text-red-500" />
      ) : completed === total && total > 0 ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Circle className="h-4 w-4 text-gray-400" />
      )}
      <span className="text-muted-foreground">
        {completed}/{total} completado
      </span>
    </div>
  )
}