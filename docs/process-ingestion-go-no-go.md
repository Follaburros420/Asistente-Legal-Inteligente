# Process Ingestion Go/No-Go Checklist

## Objetivo
Validar que el monolito orquesta ingestion asíncrona sin bloquear UX ni saturar runtime web cuando FastAPI externo degrada.

## Precondiciones (hard requirements)
1. Migracion aplicada: `supabase/migrations/20260211000000_create_process_ingestion_jobs.sql`.
2. Secret configurado: `PROCESS_INGEST_CRON_SECRET`.
3. Timeout/retry/circuit breaker configurados en runtime:
   - `RAG_BACKEND_TIMEOUT_MS`
   - `RAG_BACKEND_MAX_RETRIES`
   - `RAG_BACKEND_RETRY_BASE_MS`
   - `RAG_BACKEND_CIRCUIT_FAILURE_THRESHOLD`
   - `RAG_BACKEND_CIRCUIT_COOLDOWN_MS`
4. Politica de cola configurada:
   - `PROCESS_INGEST_AUTORUN_CONCURRENCY`
   - `PROCESS_INGEST_DRAIN_LIMIT`
   - `PROCESS_INGEST_DRAIN_CONCURRENCY`
   - `PROCESS_INGEST_STALE_SCAN_LIMIT`
   - `PROCESS_INGEST_RUNNING_GRACE_SECONDS`

## Smoke checks obligatorios
1. Ejecutar:
   - `APP_URL=https://tu-dominio.com PROCESS_INGEST_CRON_SECRET=*** npm run ops:ingestion:smoke`
2. Verificar endpoint admin ops:
   - Abrir `/admin/operations/ingestion`
   - Confirmar que renderiza queue depth, p95/p99, counters y jobs recientes.
3. Verificar flujo usuario:
   - Subir documento en proceso
   - Confirmar enqueue inmediato (sin bloqueo de request)
   - Confirmar transición de estado en jobs y documento.

## Criterios GO (todos)
1. `POST /api/processes/:id/upload` y `POST /api/processes/:id/ingest` responden sin esperar procesamiento largo.
2. `GET /api/processes/:id/jobs` muestra estados coherentes (`queued/running/retrying/succeeded/failed/canceled/timeout`).
3. Cancelación no termina en `succeeded` por carrera.
4. No hay crecimiento sostenido de `running` estancados en `/admin/operations/ingestion`.
5. p95/p99 de procesamiento dentro de umbrales operativos definidos por negocio.
6. Ante caída de FastAPI externo:
   - la UI sigue operativa
   - jobs pasan a `retrying/failed/timeout` con mensajes claros
   - no hay caída global del monolito.

## NO-GO (cualquiera aplica)
1. Requests de usuario bloqueadas esperando ingestion.
2. Duplicación de ejecución de jobs para el mismo documento por carrera.
3. Cola creciendo sin drenado efectivo durante ventana de observación.
4. Jobs `running` colgados sin recuperación a `retrying/timeout`.
5. Errores 5xx recurrentes en rutas de ingestion bajo carga moderada.

## Rollback operativo
1. Desactivar autorun:
   - `PROCESS_INGEST_JOB_AUTORUN=false`
2. Mantener drenado solo por cron/manual hasta estabilizar.
3. Reducir presión:
   - bajar `PROCESS_INGEST_DRAIN_CONCURRENCY`
   - bajar `PROCESS_INGEST_AUTORUN_CONCURRENCY`
4. Si persiste:
   - congelar nuevas encolaciones en UI temporalmente
   - mantener acceso lectura/chat
   - planificar ventana para revertir código + migración de forma controlada.
