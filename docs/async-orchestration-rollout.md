# Async Orchestration Rollout (Monolito + FastAPI externo)

## Estado actual (este repo)
- [x] Cliente RAG con timeout/retries/circuit breaker.
- [x] Ingesta por documento y por proceso en modo `job-based` (`202 Accepted`).
- [x] Encolado automatico al subir documentos (`/upload`) y al crear proceso con archivos inline.
- [x] UI de detalle deja de disparar ingesta automatica por polling.
- [x] Tabla de jobs preparada en migracion: `20260211000000_create_process_ingestion_jobs.sql`.
- [x] Endpoints de jobs: listar, cancelar, reintentar.
- [x] Endpoint interno para drenar cola: `POST /api/internal/process-ingestion/drain`.
- [x] Endpoint interno de metricas: `GET /api/internal/process-ingestion/metrics`.
- [x] Drenado con limite y concurrencia configurables por entorno.
- [x] Claim atomico de jobs para evitar ejecucion duplicada en carrera.
- [x] Estado y metrica explicita de `timeout`.
- [x] Sweep de jobs `running` estancados con transicion a `retrying/timeout`.
- [x] Panel admin operativo (`/admin/operations/ingestion`) con overview + drenado manual.
- [x] Autorun con concurrencia limitada por `PROCESS_INGEST_AUTORUN_CONCURRENCY`.

## Parte 1 (48h) - Contencion inmediata
1. Aplicar migracion de jobs en Supabase.
2. Configurar variables de entorno nuevas (`.env.template`).
3. Desplegar monolito con rutas de enqueue activas.
4. Verificar que `POST /api/processes/:id/ingest` devuelve `202` y no bloquea.

## Parte 2 (2 semanas) - Operacion robusta
1. Configurar cron para `POST /api/internal/process-ingestion/drain`.
2. Consumir endpoints de jobs desde UI para progreso/cancelacion/reintento.
3. Anadir metricas por job (`queued`, `running`, `failed`, `retrying`, `timeout`).
4. Definir politica de concurrencia del drenado (`limit` por ciclo).
5. Proteger cancelacion en carrera (evitar sobrescritura a `succeeded` tras cancelar).

### Cron operativo (implementado en repo)
- Endpoint cron: `GET /api/cron/process-ingestion`
- Auth: `Authorization: Bearer $PROCESS_INGEST_CRON_SECRET` (fallback `WOMPI_CRON_SECRET`)
- Query params opcionales: `limit`, `concurrency`, `stale_scan_limit`
- Ejemplo:
  - `curl -H "Authorization: Bearer $PROCESS_INGEST_CRON_SECRET" "https://tu-dominio.com/api/cron/process-ingestion?limit=10&concurrency=3"`
- Smoke check automatizado:
  - `APP_URL=https://tu-dominio.com PROCESS_INGEST_CRON_SECRET=*** npm run ops:ingestion:smoke`

## Parte 3 (4-8 semanas) - Escalado y contract
1. Mover ejecucion de jobs a worker dedicado (fuera del runtime web).
2. Reemplazar polling por realtime/SSE para estado de jobs.
3. Consolidar duplicaciones `lib/server/*` vs `src/server/*`.
4. Cerrar legado no usado en Supabase y eliminar superficie con RLS debil.

## Validacion tecnica minima
1. `POST /api/processes/:id/upload` -> devuelve `jobs[]` y `queued > 0`.
2. `GET /api/processes/:id/jobs` -> refleja transicion de estados.
3. `POST /api/processes/:id/jobs/:jobId/cancel` -> marca `canceled`.
4. `POST /api/processes/:id/jobs/:jobId/retry` -> vuelve a `queued`.
5. Fallo de FastAPI -> documento pasa a `error` o `pending` segun retry.

## Rollback
1. Desactivar autorun: `PROCESS_INGEST_JOB_AUTORUN=false`.
2. Ejecutar drenado manualmente con endpoint interno para vaciar cola.
3. Restaurar flujo sin jobs solo si se revierte codigo + migracion en ventana controlada.

## Go/No-Go
- Checklist operativo: `docs/process-ingestion-go-no-go.md`
