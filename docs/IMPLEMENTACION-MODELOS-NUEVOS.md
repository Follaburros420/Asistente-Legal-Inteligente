# Implementación de Nuevos Modelos - Asistente Legal Inteligente

## Resumen de Cambios

### 📅 Fecha: Febrero 2025

---

## 🧠 Modelos Implementados

### M1 Pro (Tareas Complejas)
- **Modelo:** `google/gemini-3-pro-preview`
- **Uso:** Investigación legal profunda, casos complejos, análisis jurídico detallado
- **Contexto:** 1M tokens
- **Temperatura:** 0.2-0.3

### M1 (Tareas Simples)
- **Modelo:** `openai/gpt-5-mini`
- **Uso:** Consultas directas de artículos, respuestas rápidas, tareas simples
- **Contexto:** 128K tokens
- **Temperatura:** 0.1

---

## 🔍 Sistema de Búsqueda

### Única Herramienta: Serper
- **Archivo principal:** `lib/tools/search/serper-legal-search.ts`
- **Costo:** ~$0.001 por búsqueda (muy económico)
- **Fuentes prioritarias:**
  - corteconstitucional.gov.co
  - consejodeestado.gov.co
  - cortesuprema.gov.co
  - secretariasenado.gov.co
  - suin-juriscol.gov.co
  - funcionpublica.gov.co

### Funciones principales:
```typescript
searchLegalColombia(query)        // Búsqueda general optimizada
searchJurisprudencia(query)       // Búsqueda de sentencias
searchArticuloLey(numero, norma)  // Búsqueda de artículo específico
```

---

## 📁 Archivos Modificados

### Configuración de Modelos
| Archivo | Cambios |
|---------|---------|
| `lib/langchain/config/models.ts` | Registro de modelos + Router inteligente |
| `lib/models/llm/google-llm-list.ts` | Agregado Gemini 3 Pro |
| `lib/models/llm/openai-llm-list.ts` | Agregado GPT-5 Mini |

### Agente Legal
| Archivo | Cambios |
|---------|---------|
| `lib/langchain/agents/legal-agent.ts` | Integración con router de modelos |
| `lib/langchain/config/prompts.ts` | Prompt optimizado para derecho colombiano |

### Búsqueda
| Archivo | Cambios |
|---------|---------|
| `lib/tools/search/serper-legal-search.ts` | **NUEVO** - Implementación principal |
| `lib/tools/legal/legal-search-toolkit.ts` | Tools para LangChain |
| `lib/tools/search/index.ts` | **NUEVO** - Exportaciones centralizadas |

### API
| Archivo | Cambios |
|---------|---------|
| `app/api/chat/legal-agent/route.ts` | Integración con nuevos modelos y Serper |

---

## 🔧 Router Inteligente

El sistema ahora selecciona automáticamente el modelo según la consulta:

```typescript
// Consultas simples → GPT-5 Mini
"¿Qué dice el artículo 25 del CP?"
"Art 82 CGP"

// Consultas complejas → Gemini 3 Pro
"Analiza la jurisprudencia sobre derecho al trabajo"
"En mi caso, ¿puedo demandar por despido injustificado?"
```

---

## ⚙️ Variables de Entorno Requeridas

```bash
# Obligatorias
OPENROUTER_API_KEY=sk-or-v1-...
SERPER_API_KEY=...

# Opcionales
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🎯 Estructura de Respuesta

Todas las respuestas siguen este formato:

1. **Respuesta Directa** - Respuesta clara a la pregunta
2. **Fundamento Legal** - Normas/sentencias citadas (texto literal)
3. **Análisis Jurídico** - Explicación del contexto y aplicación
4. **Fuentes Consultadas** - URLs de fuentes oficiales

---

## 🚀 Uso del Sistema

### Desde el Frontend
```typescript
const response = await fetch('/api/chat/legal-agent', {
  method: 'POST',
  body: JSON.stringify({
    chatSettings: { model: 'auto' }, // Elige automáticamente
    messages: [{ role: 'user', content: 'Consulta legal' }]
  })
})
```

### Usando el Agente Directamente
```typescript
import { createSmartLegalAgent } from '@/lib/langchain/agents/legal-agent'

const agent = await createSmartLegalAgent()
const response = await agent.invoke({ input: 'Consulta legal' })
```

---

## 📊 Métricas Esperadas

| Métrica | Valor |
|---------|-------|
| Precisión de citas | > 95% |
| Tiempo respuesta simple | < 3 segundos |
| Tiempo investigación compleja | < 10 segundos |
| Costo por consulta simple | ~$0.001 |
| Costo por investigación | ~$0.01 |

---

## ⚠️ Notas Importantes

1. **Serper es la única herramienta de búsqueda** - Google CSE y otras fueron eliminadas
2. **Siempre se busca en fuentes oficiales primero** - .gov.co tiene prioridad
3. **Las respuestas incluyen fuentes verificables** - URLs incluidas en cada respuesta
4. **Sistema de confianza** - Indica cuando la información requiere verificación adicional

---

## 🔄 Compatibilidad

Los archivos antiguos mantienen compatibilidad mediante re-exports:
- `tongyi-legal-toolkit.ts` → redirige a `legal-search-toolkit.ts`

---

## 📞 Soporte

Para problemas o mejoras:
1. Verificar que `SERPER_API_KEY` esté configurada
2. Verificar que `OPENROUTER_API_KEY` tenga crédito
3. Revisar logs en consola para diagnóstico
