"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ExternalLink, BookOpen, FileText, Scale, Calendar, User, ChevronDown, ChevronUp } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"

interface BibliographyItem {
  id: string
  title: string
  type: 'sentencia' | 'ley' | 'decreto' | 'articulo' | 'jurisprudencia' | 'doctrina'
  source: string
  url?: string
  date?: string
  number?: string
  magistrate?: string
  description?: string
}

interface BibliographySectionProps {
  items: BibliographyItem[]
  className?: string
}

const typeIcons = {
  sentencia: Scale,
  ley: FileText,
  decreto: FileText,
  articulo: BookOpen,
  jurisprudencia: Scale,
  doctrina: BookOpen
}

const typeColors = {
  sentencia: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  ley: 'bg-green-500/10 text-green-300 border-green-500/20',
  decreto: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  articulo: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  jurisprudencia: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  doctrina: 'bg-pink-500/10 text-pink-300 border-pink-500/20'
}

const typeLabels = {
  sentencia: 'Sentencia',
  ley: 'Ley',
  decreto: 'Decreto',
  articulo: 'Artículo',
  jurisprudencia: 'Jurisprudencia',
  doctrina: 'Doctrina'
}

export function BibliographySection({ items, className = '' }: BibliographySectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mt-6 ${className}`}
    >
      <Card className="border-border/50 bg-muted/20">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Bibliografía - Fuentes Oficiales Colombianas
                  <Badge variant="secondary" className="ml-2">
                    {items.length} fuente{items.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4">
          {items.map((item, index) => {
            const IconComponent = typeIcons[item.type]
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/30 hover:bg-background/70 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground text-sm leading-tight">
                        {item.title}
                      </h4>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${typeColors[item.type]}`}
                        >
                          {typeLabels[item.type]}
                        </Badge>
                        
                        <span className="text-xs text-muted-foreground">
                          {item.source}
                        </span>
                      </div>
                      
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {item.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{item.date}</span>
                          </div>
                        )}
                        
                        {item.number && (
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>{item.number}</span>
                          </div>
                        )}
                        
                        {item.magistrate && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{item.magistrate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {item.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLinkClick(item.url!)}
                        className="flex-shrink-0 h-8 w-8 p-0 hover:bg-primary/10"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  )
}
