# Verificación de Modelos - Guía Rápida

## 🔍 Cómo Verificar si los Modelos Funcionan

### 1. Verificar Estado del Endpoint

```bash
curl http://localhost:3000/api/chat/legal-agent
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "models": {
    "primary": {
      "m1_pro": "google/gemini-3-pro-preview",
      "m1": "openai/gpt-5-mini"
    },
    "fallbacks": {
      "m1_pro": ["google/gemini-1.5-pro-latest", "anthropic/claude-3.5-sonnet"],
      "m1": ["openai/gpt-4o-mini", "google/gemini-1.5-flash"]
    }
  },
  "search": {
    "status": "configured"
  }
}
```

### 2. Probar Modelo M1 (Simples)

```bash
curl -X POST http://localhost:3000/api/chat/legal-agent \
  -H "Content-Type: application/json" \
  -d '{
    "chatSettings": { "model": "openai/gpt-5-mini" },
    "messages": [{"role": "user", "content": "Artículo 25 CP"}]
  }'
```

### 3. Probar Modelo M1 Pro (Complejas)

```bash
curl -X POST http://localhost:3000/api/chat/legal-agent \
  -H "Content-Type: application/json" \
  -d '{
    "chatSettings": { "model": "google/gemini-3-pro-preview" },
    "messages": [{"role": "user", "content": "Analiza la jurisprudencia sobre derecho al trabajo"}]
  }'
```

### 4. Probar Router Automático

```bash
curl -X POST http://localhost:3000/api/chat/legal-agent \
  -H "Content-Type: application/json" \
  -d '{
    "chatSettings": { "model": "auto" },
    "messages": [{"role": "user", "content": "Qué dice el artículo 82 CGP"}]
  }'
```

## 🔄 Sistema de Fallbacks

Si el modelo primario falla, el sistema **automáticamente** usa el fallback:

| Selector | Modelo Primario | Fallback 1 | Fallback 2 |
|----------|----------------|------------|------------|
| **M1 Pro** | `google/gemini-3-pro-preview` | `google/gemini-1.5-pro-latest` | `anthropic/claude-3.5-sonnet` |
| **M1** | `openai/gpt-5-mini` | `openai/gpt-4o-mini` | `google/gemini-1.5-flash` |

### Headers de Respuesta

El sistema indica si usó fallback en los headers:

```
X-Model-Used: openai/gpt-4o-mini
X-Model-Original: openai/gpt-5-mini
X-Model-Fallback: true
```

## ⚠️ Si los Modelos No Funcionan

### Error: "Modelo no encontrado"

Significa que el modelo ID no existe en OpenRouter.

**Solución:**
1. Ejecutar script de verificación:
```bash
node scripts/verify-models.js
```

2. Usar modelo fallback garantizado:
- Para complejas: `anthropic/claude-3.5-sonnet`
- Para simples: `openai/gpt-4o-mini`

### Error: "Authentication error"

Verificar variables de entorno:
```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-...
SERPER_API_KEY=...
```

### Error: "Rate limit"

Esperar unos segundos e intentar de nuevo.

## 🛠️ Modelos Garantizados (Siempre Disponibles)

Si todo falla, estos modelos siempre funcionan:

- `anthropic/claude-3.5-sonnet` - Muy capaz, 200K contexto
- `openai/gpt-4o-mini` - Económico, 128K contexto
- `google/gemini-1.5-flash` - Rápido, 1M contexto

## 📊 Verificación de Costos

Puedes verificar el costo real en el header de respuesta:
- OpenRouter proporciona headers con costo por request
- `X-Model-Used` indica qué modelo se usó finalmente

## 🚀 Forzar Modelo Específico

Si sabes que un modelo funciona y quieres usarlo directamente:

```bash
curl -X POST http://localhost:3000/api/chat/legal-agent \
  -H "Content-Type: application/json" \
  -d '{
    "chatSettings": { "model": "anthropic/claude-3.5-sonnet" },
    "messages": [{"role": "user", "content": "Consulta legal"}]
  }'
```

## 📝 Log de Ejecución

El sistema loguea qué modelo se usa:

```
🎯 Modelo solicitado: google/gemini-3-pro-preview
⚠️ Modelo google/gemini-3-pro-preview no disponible
🔄 Intentando fallback: google/gemini-1.5-pro-latest
✅ Usando fallback: google/gemini-1.5-pro-latest
```

## 🔧 Actualizar Modelos Disponibles

Si OpenRouter añade nuevos modelos:

1. Verificar en: https://openrouter.ai/docs#models
2. Actualizar `lib/langchain/config/models.ts`
3. Añadir al array `validModels` en el API route

## 📞 Soporte

Si los modelos siguen sin funcionar:
1. Verificar crédito en OpenRouter
2. Verificar lista de modelos disponibles
3. Usar fallbacks garantizados
4. Contactar soporte de OpenRouter
