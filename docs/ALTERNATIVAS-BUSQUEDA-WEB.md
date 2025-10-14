# 🌐 Alternativas para Búsqueda Web con Fuentes

## 📋 Resumen del Problema

**Situación actual:**
- ✅ Tongyi ya responde en español (sin caracteres chinos)
- ⚠️ No todos los modelos Tongyi tienen búsqueda web incorporada
- ⚠️ Cuando buscan, no siempre devuelven URLs de fuentes

**Lo que quieres:**
- ✅ Búsqueda web confiable
- ✅ Fuentes con hipervínculos verificables

---

## 🎯 Opciones Disponibles

### Opción 1: Perplexity AI (Recomendado) ⭐

**Ventajas:**
- ✅ Búsqueda web incorporada y confiable
- ✅ Siempre incluye fuentes con URLs
- ✅ Especializado en búsqueda y razonamiento
- ✅ Formato de respuesta estructurado
- ✅ Muy rápido

**Modelos disponibles:**
```
perplexity/llama-3.1-sonar-small-128k-online    # Más barato
perplexity/llama-3.1-sonar-large-128k-online    # Más inteligente
perplexity/llama-3.1-sonar-huge-128k-online     # Máxima calidad
```

**Costo:**
- Small: ~$0.20 / 1M tokens
- Large: ~$1.00 / 1M tokens
- Huge: ~$5.00 / 1M tokens

**Implementación:**
Ya está integrado en tu aplicación. Solo necesitas:
1. Seleccionar el modelo Perplexity en el chat
2. Hacer tu pregunta
3. Recibirás fuentes automáticamente

**Ejemplo de respuesta:**
```
[Respuesta completa sobre el tema]

Sources:
1. https://ejemplo.com/fuente1
2. https://ejemplo.com/fuente2
3. https://ejemplo.com/fuente3
```

---

### Opción 2: Google Gemini con Extensiones

**Ventajas:**
- ✅ Búsqueda web de Google
- ✅ Muy actualizado
- ✅ Multimodal (puede analizar imágenes también)

**Desventajas:**
- ⚠️ Requiere configuración adicional
- ⚠️ Las fuentes no siempre son explícitas
- ⚠️ Más caro que Perplexity

**Modelos disponibles:**
```
google/gemini-pro-1.5
google/gemini-flash-1.5
```

**Costo:**
- Flash: ~$0.075 / 1M tokens
- Pro: ~$1.25 / 1M tokens

---

### Opción 3: Brave Search API (Manual)

**Ventajas:**
- ✅ Búsqueda confiable (motor de Brave)
- ✅ Sin rastreo de usuarios
- ✅ Resultados de calidad
- ✅ Control total sobre las fuentes

**Desventajas:**
- ⚠️ Requiere desarrollo adicional
- ⚠️ Necesita API key de Brave
- ⚠️ Costo adicional

**Costo:**
- Gratis: 2,000 búsquedas/mes
- Pro: $5/mes por 15,000 búsquedas

**Flujo de trabajo:**
1. Usuario hace pregunta
2. Sistema detecta si requiere búsqueda
3. Llama a Brave Search API
4. Obtiene resultados + URLs
5. Inyecta resultados en el contexto de Tongyi
6. Tongyi responde basándose en los resultados
7. Sistema agrega fuentes al final

**Implementación estimada:** 2-3 horas de desarrollo

---

### Opción 4: Sistema Híbrido (Recomendado para producción) ⭐⭐

**Concepto:**
Usar diferentes modelos según el tipo de pregunta:

```
Pregunta del usuario
    ↓
¿Requiere búsqueda web?
    ↓
  SÍ → Perplexity (con fuentes automáticas)
    ↓
  NO → Tongyi (más rápido y barato)
```

**Ventajas:**
- ✅ Optimiza costos (usa Tongyi cuando no necesitas búsqueda)
- ✅ Garantiza fuentes cuando se necesitan (usa Perplexity)
- ✅ Mejor experiencia de usuario (modelo apropiado para cada caso)

**Detección automática:**
```typescript
const requiresWebSearch = (message: string) => {
  const keywords = [
    'noticias', 'actualidad', 'reciente', 'últimas', 'hoy',
    'actual', 'novedades', 'eventos', 'ahora', 'información actualizada'
  ]
  return keywords.some(kw => message.toLowerCase().includes(kw))
}

// En el frontend:
if (requiresWebSearch(userMessage)) {
  useModel('perplexity/llama-3.1-sonar-large-128k-online')
} else {
  useModel('qwen/qwen-2.5-7b-instruct')
}
```

**Implementación estimada:** 1-2 horas de desarrollo

---

## 📊 Comparativa de Opciones

| Característica | Tongyi | Perplexity | Google Gemini | Brave API + Tongyi |
|----------------|--------|------------|---------------|-------------------|
| **Búsqueda web** | ⚠️ Limitada | ✅ Siempre | ✅ Siempre | ✅ Manual |
| **Fuentes con URLs** | ⚠️ A veces | ✅ Siempre | ⚠️ A veces | ✅ Total control |
| **Costo** | 💰 Bajo | 💰💰 Medio | 💰💰 Medio | 💰 Bajo |
| **Velocidad** | ⚡⚡⚡ Muy rápido | ⚡⚡ Rápido | ⚡⚡ Rápido | ⚡ Depende |
| **Configuración** | ✅ Ya listo | ✅ Ya listo | ⚠️ Requiere setup | ⚠️ Desarrollo |
| **Idioma español** | ✅ Configurado | ✅ Natural | ✅ Natural | ✅ Controlado |

---

## 🎯 Recomendación por Caso de Uso

### Caso 1: Uso General (Chat + Documentos)
**Solución:** Sistema Híbrido (Tongyi + Perplexity)

**Por qué:**
- Tongyi para responder sobre documentos subidos (rápido, barato)
- Perplexity para búsquedas web (fuentes garantizadas)
- Detección automática del tipo de pregunta

**Costo estimado mensual:** $5-15

---

### Caso 2: Solo Búsqueda Web (Noticias, Actualidad)
**Solución:** Solo Perplexity

**Por qué:**
- Especializado en búsqueda
- Siempre incluye fuentes
- Muy confiable

**Costo estimado mensual:** $10-30

---

### Caso 3: Máximo Control y Privacidad
**Solución:** Brave API + Tongyi

**Por qué:**
- Control total sobre las búsquedas
- Sin rastreo de usuarios
- Puedes filtrar/validar fuentes antes de mostrarlas

**Costo estimado mensual:** $5 (Brave) + $5-10 (Tongyi) = $10-15

---

### Caso 4: Presupuesto Limitado
**Solución:** Tongyi + Instrucciones mejoradas

**Por qué:**
- Más barato
- Funciona para mayoría de casos
- Las fuentes web son un "bonus" cuando están disponibles

**Costo estimado mensual:** $3-8

---

## 🚀 Implementación Rápida: Sistema Híbrido

Si quieres implementar el sistema híbrido, necesitas:

### 1. Crear detector de búsqueda web

**Archivo:** `lib/detect-web-search.ts`

```typescript
export function requiresWebSearch(message: string): boolean {
  const webSearchKeywords = [
    // Actualidad
    'noticias', 'actualidad', 'reciente', 'últimas', 'hoy',
    'actual', 'novedades', 'eventos', 'ahora', 'news',
    
    // Información en tiempo real
    'clima', 'tiempo', 'temperatura', 'precio de', 
    'cotización', 'bolsa', 'acciones',
    
    // Verificación
    'verifica', 'busca', 'investiga', 'comprueba',
    
    // Comparativas actuales
    'mejores', 'top', 'ranking', 'comparar'
  ]
  
  const lowerMessage = message.toLowerCase()
  return webSearchKeywords.some(keyword => lowerMessage.includes(keyword))
}
```

### 2. Usar en el componente de chat

**En:** `components/chat/chat-input.tsx` o donde manejes el envío de mensajes

```typescript
import { requiresWebSearch } from '@/lib/detect-web-search'

// Antes de enviar el mensaje
const shouldUseWebSearch = requiresWebSearch(message)

if (shouldUseWebSearch) {
  console.log('🌐 Usando Perplexity para búsqueda web')
  // Cambiar a modelo Perplexity
  selectedModel = 'perplexity/llama-3.1-sonar-large-128k-online'
} else {
  console.log('💬 Usando Tongyi para respuesta general')
  // Usar Tongyi
  selectedModel = 'qwen/qwen-2.5-7b-instruct'
}
```

### 3. Agregar indicador visual (opcional)

Mostrar al usuario qué tipo de búsqueda se está haciendo:

```typescript
{shouldUseWebSearch && (
  <div className="text-xs text-blue-500">
    🌐 Buscando en internet...
  </div>
)}
```

---

## 💡 Próximos Pasos

### Para probar Perplexity AHORA:

1. Ve a tu chat
2. En la configuración del chat, selecciona modelo:
   ```
   perplexity/llama-3.1-sonar-large-128k-online
   ```
3. Haz una pregunta de actualidad:
   ```
   ¿Cuáles son las últimas noticias sobre inteligencia artificial en Colombia?
   ```
4. Observa la respuesta con fuentes

### Para implementar sistema híbrido:

1. Crea el archivo `lib/detect-web-search.ts`
2. Modifica el componente de chat para usar detección
3. Prueba con diferentes tipos de preguntas
4. Ajusta keywords según tus necesidades

**Tiempo estimado:** 1-2 horas de desarrollo + pruebas

---

## 📞 Resumen Ejecutivo

### ✅ Solución Inmediata (Sin desarrollo):
**Usa Perplexity para búsquedas web**
- Cambiar modelo a `perplexity/llama-3.1-sonar-large-128k-online`
- Fuentes automáticas garantizadas
- Costo: ~$1/1M tokens

### 🎯 Solución Óptima (1-2 horas de desarrollo):
**Sistema Híbrido**
- Tongyi para preguntas generales + documentos
- Perplexity para búsquedas web
- Detección automática
- Costo optimizado: $5-15/mes

### 🔧 Solución Avanzada (2-3 horas de desarrollo):
**Brave API + Tongyi**
- Control total sobre búsquedas
- Máxima privacidad
- Personalización completa
- Costo: $5-10/mes

---

**¿Qué prefieres?**
1. **Probar Perplexity ahora** (0 desarrollo, solo cambiar modelo)
2. **Implementar sistema híbrido** (1-2 horas, mejor experiencia)
3. **Quedarte con Tongyi actual** (fuentes limitadas pero funcional)

¡Dime cuál opción te interesa y te ayudo a implementarla! 🚀














