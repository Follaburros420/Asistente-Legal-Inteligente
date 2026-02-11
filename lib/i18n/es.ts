export const es = {
  processes: {
    title: "Procesos",
    subtitle: "Organiza tus casos y accede a insights legales en segundos.",
    loading: "Cargando procesos...",
    searchPlaceholder: "Buscar por nombre o descripción…",
    filterPlaceholder: "Filtrar por estado",
    filters: {
      all: "Todos los estados",
      active: "Activos",
      archived: "Archivados",
      closed: "Cerrados"
    },
    actions: {
      new: "Nuevo proceso",
      clearFilters: "Limpiar filtros",
      edit: "Editar detalles",
      archive: "Archivar proceso",
      restore: "Restaurar proceso",
      delete: "Eliminar",
      optionsLabel: "Opciones del proceso"
    },
    labels: {
      documents: "documentos",
      defaultProcess: "Proceso legal",
      archived: "Archivado"
    },
    notifications: {
      archived: "Proceso archivado correctamente",
      restored: "Proceso restaurado correctamente",
      archiveError: "Error al archivar el proceso",
      deleted: "Proceso eliminado correctamente",
      deleteError: "Error al eliminar el proceso"
    },
    confirmations: {
      deleteTitle: "¿Eliminar este proceso?",
      deleteDescription: "Se eliminarán todos los documentos y datos asociados. Esta acción no se puede deshacer."
    },
    stats: {
      total: "Procesos totales",
      highRisk: "Riesgos altos",
      pending: "Pendientes de análisis"
    },
    empty: {
      title: "No hay procesos aún",
      description: "Crea tu primer proceso y obtén contexto inmediato sobre hechos, pruebas y normas.",
      cta: "Crear primer proceso"
    },
    emptyFiltered: {
      title: "No se encontraron procesos",
      description: "Prueba con otros términos o ajusta los filtros."
    },
    card: {
      lastActivity: "Última actividad",
      ctaOpen: "Abrir",
      ctaAnalyze: "Analizar",
      riskLabel: "Riesgo",
      metrics: {
        facts: "Hechos",
        evidence: "Pruebas",
        norms: "Normas",
        contradictions: "Contradicciones"
      },
      risk: {
        low: "Bajo",
        medium: "Medio",
        high: "Alto"
      }
    }
  },
  chat: {
    emptyHeadline: "Ya analicé este proceso. Estos son los puntos críticos que encontré.",
    emptyHelper:
      "Puedo señalar hechos, pruebas, riesgos, contradicciones y normas aplicables con base en tus documentos.",
    input: {
      readyPlaceholder: "Pregunta sobre hechos, pruebas, riesgos...",
      waitingPlaceholder: "Espera a que los documentos se indexen..."
    },
    highlights: {
      factsVerified: "Hechos verificados",
      evidenceLinked: "Pruebas vinculadas",
      normsApplied: "Normas aplicables"
    },
    suggestions: {
      facts: "¿Cuáles son los hechos principales?",
      evidence: "¿Qué pruebas respaldan cada hecho?",
      contradictions: "Muéstrame contradicciones",
      norms: "Normas críticas aplicables",
      timeline: "Genera una línea de tiempo",
      detectedContradictions: (count: number | null) =>
        count && count > 0
          ? `Detecté ${count} posibles contradicciones. ¿Quieres revisarlas?`
          : "Detecté posibles contradicciones. ¿Quieres revisarlas?",
      detectedNorms: (count: number | null) =>
        count && count > 0
          ? `Hay ${count} normas aplicables que podrían impactar el caso.`
          : "Hay normas aplicables que podrían impactar el caso.",
      wantTimeline: "¿Quieres una línea de tiempo del caso?"
    }
  },
  documents: {
    title: "Documentos del proceso",
    emptyTitle: "No hay documentos en este proceso",
    emptyDescription: "Sube documentos para que el sistema los analice.",
    summary: {
      empty: "Sin documentos",
      withCounts: (total: number, indexed: number, processing: number) => {
        const base = `${total} documentos · ${indexed} listos`
        return processing > 0 ? `${base} · ${processing} procesando` : base
      }
    },
    actions: {
      upload: "Subir documentos",
      uploadAndIndex: "Subir e indexar",
      uploading: "Subiendo...",
      cancel: "Cancelar",
      filter: "Filtrar",
      sort: "Ordenar"
    },
    messages: {
      selectFile: "Selecciona al menos un archivo",
      uploadError: "Error al subir documentos",
      uploadSuccess: (count: number) => `${count} documentos subidos correctamente`,
      deleteSuccess: "Documento eliminado correctamente",
      deleteError: "Error al eliminar el documento"
    },
    jobs: {
      title: "Jobs",
      active: "activos",
      failed: "fallidos",
      total: "total",
      refreshing: "actualizando...",
      canceled: "Job cancelado",
      retryQueued: "Reintento encolado",
      cancelAction: "Cancelar job",
      retryAction: "Reintentar job",
      cancelError: "No se pudo cancelar el job",
      retryError: "No se pudo reintentar el job",
      loadError: "Error cargando jobs",
      statuses: {
        queued: "Job en cola",
        running: "Job ejecutando",
        retrying: "Job reintentando",
        succeeded: "Job completado",
        failed: "Job con error",
        canceled: "Job cancelado",
        timeout: "Job timeout"
      }
    },
    table: {
      document: "Documento",
      type: "Tipo",
      size: "Tamaño",
      status: "Estado",
      date: "Fecha",
      notAvailable: "N/A"
    },
    status: {
      indexed: "Listo para análisis",
      processing: "Procesando",
      error: "Problema de lectura",
      pending: "En cola"
    },
    delete: {
      title: "¿Eliminar este documento?",
      description: "El documento será eliminado permanentemente del proceso y del sistema de búsqueda."
    },
    badges: {
      evidence: "Fuente probatoria",
      normative: "Normativa",
      generatesFacts: "Genera hechos",
      highRelevance: "Alta relevancia",
      lowRelevance: "Baja relevancia"
    }
  },
  graph: {
    guidedTitle: "Vistas guiadas",
    layersLabel: "Capas",
    loading: "Cargando grafo de conocimiento...",
    error: "Error al cargar el grafo",
    retry: "Reintentar",
    stats: {
      entities: "entidades",
      connections: "conexiones"
    },
    controls: {
      zoomIn: "Acercar",
      zoomOut: "Alejar",
      fit: "Ajustar",
      refresh: "Refrescar"
    },
    guidedViews: {
      contradictions: "Contradicciones",
      criticalNorms: "Normas críticas",
      factsEvidence: "Hechos↔Pruebas",
      keyPeople: "Personas clave"
    },
    layerLabels: {
      facts: "Hechos",
      evidence: "Pruebas",
      norms: "Normas",
      people: "Personas"
    },
    guidedDescriptions: {
      contradictions: "Resalta conflictos y tensiones dentro del caso.",
      criticalNorms: "Normas con mayor impacto jurídico.",
      factsEvidence: "Relaciones directas entre hechos y pruebas.",
      keyPeople: "Personas y organizaciones más conectadas."
    },
    emptyTitle: "El grafo de conocimiento aparecerá aquí",
    emptyDescription:
      "Cuando proceses documentos, el sistema extraerá hechos, pruebas, normas y personas para visualizar sus relaciones.",
    panel: {
      sourceDoc: "Documento fuente",
      whyMatters: "Por qué importa",
      suggestedActions: "Acciones sugeridas",
      askChat: "Preguntar al chat sobre esto",
      viewSource: "Ver documento fuente",
      connections: "conexiones",
      closeLabel: "Cerrar panel",
      fallbackSummary: (type: string) => `Entidad de tipo ${type} identificada en el proceso.`,
      documentFallback: "Documento",
      importance: {
        facts: "Relaciona hechos clave con pruebas críticas dentro del expediente.",
        evidence: "Sustenta la narrativa del caso y reduce incertidumbre probatoria.",
        norms: "Define el marco legal que condiciona decisiones y riesgos.",
        people: "Actor relevante con influencia directa en el resultado del caso.",
        default: "Elemento conectado con aspectos clave del proceso."
      },
      askChatPrompt: (label: string) => `Explícame por qué “${label}” es relevante en el caso.`
    },
    legend: {
      edgeTypes: "Tipos de conexión",
      factEvidence: "Hecho–Prueba",
      factNorm: "Hecho–Norma",
      contradiction: "Contradicción"
    }
  }
}
