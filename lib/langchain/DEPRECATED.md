# DEPRECATED - LangChain/Glanchain

Este directorio está deprecado y será eliminado en una futura versión.

## Reemplazo

El chat ahora usa el **Orquestador Thin** en `lib/chat/`:

- `lib/chat/orchestrator.ts` - Reemplaza a `agents/legal-agent.ts`
- `lib/chat/tools/definitions.ts` - Reemplaza tools de LangChain
- `lib/chat/tools/executor.ts` - Ejecutor directo

## Razón del cambio

1. **Streaming real**: LangChain solo soportaba fake streaming
2. **Menor latencia**: Sin overhead de AgentExecutor
3. **Código explícito**: Más fácil de debuggear
4. **Menos dependencias**: ~150KB menos en bundle

## Fecha de deprecación

2026-02-13

## Migración completada en

- Fase 2: Core del orquestador
- Fase 3: Frontend actualizado
- Fase 4: Limpieza de archivos muertos
