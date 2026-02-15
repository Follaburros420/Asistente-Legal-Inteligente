import { NormalizedCitation } from "@/types/model-answer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ExternalLink,
  BookOpen,
  Scale,
  FileText,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CitationsPanelProps {
  items?: NormalizedCitation[];
  className?: string;
}

const TECHNICAL_TAG_REGEX = /^[A-Z0-9_]+$/i;

const SOURCE_LABELS_BY_DOMAIN: Record<string, string> = {
  "corteconstitucional.gov.co": "Corte Constitucional",
  "cortesuprema.gov.co": "Corte Suprema de Justicia",
  "consejodeestado.gov.co": "Consejo de Estado",
  "ramajudicial.gov.co": "Rama Judicial",
  "suin-juriscol.gov.co": "SUIN-Juriscol",
  "funcionpublica.gov.co": "Funcion Publica",
  "secretariasenado.gov.co": "Secretaria del Senado",
  "leyes.co": "Leyes.co",
};

const normalizeType = (type?: string) => {
  const safeType = type?.trim();
  if (!safeType) return undefined;
  if (TECHNICAL_TAG_REGEX.test(safeType)) return undefined;
  return safeType;
};

const sourceFromUrl = (url?: string) => {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    for (const [domain, label] of Object.entries(SOURCE_LABELS_BY_DOMAIN)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return label;
      }
    }

    return hostname;
  } catch {
    return undefined;
  }
};

const getDisplaySource = (item: NormalizedCitation) => {
  if (item.source && !TECHNICAL_TAG_REGEX.test(item.source.trim())) {
    return item.source;
  }

  return sourceFromUrl(item.url);
};

const getFaviconUrl = (url?: string) => {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return undefined;
  }
};

const getTypeIcon = (type?: string) => {
  const t = type?.toLowerCase();
  if (t?.includes("ley") || t?.includes("codigo") || t?.includes("norma"))
    return Scale;
  if (t?.includes("jurisprudencia") || t?.includes("sentencia"))
    return BookOpen;
  return FileText;
};

const getTypeColor = (type?: string) => {
  const t = type?.toLowerCase();
  if (t?.includes("ley") || t?.includes("codigo") || t?.includes("norma")) {
    return "from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  }
  if (t?.includes("jurisprudencia") || t?.includes("sentencia")) {
    return "from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
  }
  return "from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
};

const SourceIcon = ({
  url,
  fallback: FallbackIcon,
}: {
  url?: string;
  fallback: ComponentType<{ className?: string }>;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const faviconUrl = getFaviconUrl(url);

  if (!faviconUrl || imageFailed) {
    return <FallbackIcon className="w-4.5 h-4.5" />;
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      className="h-5 w-5 rounded-sm object-contain"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
};

export const CitationsPanel = ({ items, className }: CitationsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const safeItems = useMemo(
    () =>
      (items ?? []).map((item, idx) => ({
        ...item,
        id: item.id ?? `citation-${idx + 1}`,
      })),
    [items],
  );

  if (safeItems.length === 0) return null;

  const handleOpenLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "mt-6 overflow-hidden",
          "bg-gradient-to-br from-card/80 via-card to-muted/20",
          "border border-border/50",
          "shadow-sm hover:shadow-md transition-shadow duration-300",
          "backdrop-blur-sm",
          className,
        )}
      >
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader
              className={cn(
                "flex cursor-pointer flex-row items-center justify-between gap-3 py-4 px-5",
                "transition-all duration-200",
                "hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent",
                "group",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-200">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Fuentes Consultadas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {safeItems.length}{" "}
                    {safeItems.length === 1
                      ? "referencia legal"
                      : "referencias legales"}
                  </p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/50 group-hover:bg-muted transition-colors"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
          </CollapsibleTrigger>

          <AnimatePresence>
            {isOpen && (
              <CollapsibleContent forceMount>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <CardContent className="px-5 pb-5 pt-1">
                    <div className="space-y-3">
                      {safeItems.map((item, index) => {
                        const displayType = normalizeType(item.type);
                        const displaySource = getDisplaySource(item);
                        const TypeIcon = getTypeIcon(displayType);
                        const typeColorClass = getTypeColor(displayType);
                        const isHovered = hoveredId === item.id;

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.2 }}
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={cn(
                              "group/item relative overflow-hidden",
                              "rounded-xl p-4",
                              "bg-gradient-to-br from-background/90 via-background/70 to-muted/20",
                              "border border-border/40",
                              "shadow-sm",
                              "transition-all duration-200",
                              "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
                              "cursor-default",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute inset-0 opacity-0 group-hover/item:opacity-100",
                                "bg-gradient-to-br from-primary/[0.03] to-transparent",
                                "transition-opacity duration-300 pointer-events-none",
                              )}
                            />

                            <div className="relative flex items-start gap-3">
                              <div
                                className={cn(
                                  "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl",
                                  "bg-gradient-to-br border",
                                  typeColorClass,
                                  "transition-transform duration-200",
                                  isHovered && "scale-105",
                                )}
                              >
                                <SourceIcon
                                  url={item.url}
                                  fallback={TypeIcon}
                                />
                              </div>

                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 group-hover/item:text-foreground/90">
                                    <span className="text-primary/70 font-semibold mr-1.5">
                                      {index + 1}.
                                    </span>
                                    {item.title}
                                  </p>
                                  {item.url && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenLink(item.url!)}
                                      className={cn(
                                        "h-8 w-8 rounded-lg flex-shrink-0",
                                        "hover:bg-primary/10 hover:text-primary",
                                        "transition-all duration-200",
                                        "opacity-60 group-hover/item:opacity-100",
                                      )}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {displayType && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] uppercase tracking-wider font-medium",
                                        "bg-muted/50 border-border/60",
                                        "px-2 py-0.5",
                                      )}
                                    >
                                      {displayType}
                                    </Badge>
                                  )}
                                  {displaySource && (
                                    <span className="text-[11px] text-muted-foreground font-medium">
                                      {displaySource}
                                    </span>
                                  )}
                                  {item.issuedAt && (
                                    <span className="text-[11px] text-muted-foreground/70">
                                      * Ano {item.issuedAt}
                                    </span>
                                  )}
                                </div>

                                {item.description && (
                                  <p className="text-xs leading-relaxed text-muted-foreground/80 line-clamp-2 mt-1">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </Collapsible>
      </Card>
    </motion.div>
  );
};
