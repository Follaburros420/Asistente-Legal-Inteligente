# Wasabi Rollout - Fase 1

## Objetivo
- Migrar el monolito de procesos/transcripciones a un backend de object storage configurable (`supabase` o `wasabi`) sin cambiar UX.
- Mantener fallback de lectura a Supabase durante la transición.

## Alcance de Fase 1
- API de procesos:
  - upload de documentos
  - delete de documentos
  - creación de proceso con archivos iniciales
- API de transcripciones:
  - upload de audio
  - descarga para transcripción
- Worker de ingestion:
  - descarga de documentos para enviar al backend RAG
- Flujos legacy cliente:
  - `files`, `message_images`, `profile_images`, `workspace_images`, `assistant_images`
  - migrados a API server-side (`/api/storage/upload`, `/api/storage/object`)
  - sin acceso directo desde cliente a `supabase.storage`
- Resiliencia de indexación:
  - auto-reingesta al detectar ausencia de vectores/grafo en chat/graph
- Cuotas:
  - límite de almacenamiento por plan en uploads (responde `402` al exceder)

## Variables requeridas
- `OBJECT_STORAGE_PROVIDER` (`supabase` | `wasabi`)
- `OBJECT_STORAGE_SUPABASE_BUCKET`
- `OBJECT_STORAGE_SUPABASE_READ_FALLBACK`
- `OBJECT_STORAGE_SUPABASE_READ_REPAIR`
- `WASABI_ENDPOINT`
- `WASABI_REGION`
- `WASABI_BUCKET`
- `WASABI_ACCESS_KEY_ID`
- `WASABI_SECRET_ACCESS_KEY`
- `WASABI_FORCE_PATH_STYLE`
- `WASABI_MULTIPART_THRESHOLD_MB`

## Matriz ejecutable

### Paso 1 - Preparacion
- Configurar credenciales Wasabi en entorno de staging.
- Aplicar migraciones (incluye `object_storage_inventory`):
  - `npm run db-push`
- Mantener:
  - `OBJECT_STORAGE_PROVIDER=wasabi`
  - `OBJECT_STORAGE_SUPABASE_READ_FALLBACK=true`
  - `OBJECT_STORAGE_SUPABASE_READ_REPAIR=true`
- Validar build:
  - `npm run build`

### Paso 2 - Smoke funcional
- Probar upload de documento en proceso.
- Confirmar que se crea `process_documents.storage_path`.
- Probar ingestion y chat del proceso.
- Probar upload/transcribe de audio.
- Probar eliminación de documento de proceso.

### Paso 3 - Validacion de consistencia
- Verificar que documentos y transcripciones tengan objeto accesible:
  - `process_documents.storage_path`
  - `transcriptions.audio_path`
- Ejecutar migracion de objetos historicos (si aplica):
  - `npm run ops:storage:migrate:wasabi -- --dry-run`
  - `npm run ops:storage:migrate:wasabi -- --buckets=files,message_images,profile_images,workspace_images,assistant_images`
- Validar cuota por inventario:
  - `select public.get_object_storage_usage_bytes('<user_uuid>'::uuid);`
- Verificar que jobs de ingestion no queden colgados:
  - `process_ingestion_jobs.status` sin acumulación en `running`/`retrying`.

### Paso 4 - Observabilidad operativa
- Monitorear por 24h:
  - tasa de error 5xx en rutas de procesos/transcripciones
  - latencia p95/p99 en upload/download
  - backlog de `process_ingestion_jobs`

### Paso 5 - Cutover
- Cuando staging esté estable, replicar variables en producción.
- Mantener fallback (`OBJECT_STORAGE_SUPABASE_READ_FALLBACK=true`) durante ventana de estabilización.

### Paso 6 - Hardening posterior (Fase 2)
- Desactivar fallback:
  - `OBJECT_STORAGE_SUPABASE_READ_FALLBACK=false`
- Validar comportamiento de reconciliación automática:
  - si faltan vectores/grafo para un documento existente en object storage, se re-encola ingestion.
- Ajustar límites de storage por plan según negocio:
  - `STORAGE_LIMIT_NONE_MB`
  - `STORAGE_LIMIT_BASIC_MB`
  - `STORAGE_LIMIT_PRO_MB`
  - `STORAGE_LIMIT_ENTERPRISE_MB`

### Paso 6.1 - Reconciliacion operativa de inventario
- Ejecutar reconciliacion de inventario (dry-run):
  - `npm run ops:storage:reconcile`
- Reparar inventario faltante (sin borrar objetos):
  - `npm run ops:storage:reconcile -- --apply-upsert-missing --apply-fix-provider`
- Marcar inventario huerfano como eliminado (sin borrar fisicamente):
  - `npm run ops:storage:reconcile -- --apply-mark-stale`
- Reportes JSON:
  - se guardan en `docs/reports/storage-reconcile-*.json`

### Paso 6.2 - Auditoria de huerfanos en Wasabi
- Auditar objetos en Wasabi que no tienen referencia activa en inventario:
  - `npm run ops:storage:audit-orphans`
- Modo conservador (ignorar objetos recientes):
  - `npm run ops:storage:audit-orphans -- --min-age-hours=48`
- Borrado controlado por lotes:
  - `npm run ops:storage:audit-orphans -- --apply-delete --min-age-hours=168 --limit=100`
- Reportes JSON:
  - se guardan en `docs/reports/wasabi-orphans-*.json`

## Go/No-Go
- Go:
  - build pasa
  - upload/ingestion/chat/transcription OK
  - sin incremento de 5xx ni backlog anómalo
- No-Go:
  - errores de lectura/escritura en objetos
  - jobs en `running` estancados
  - degradación visible de UX

## Rollback
- Cambiar `OBJECT_STORAGE_PROVIDER=supabase`.
- Mantener despliegue de código actual (el adaptador soporta ambos proveedores).
- Confirmar recuperación de flujos críticos con smoke tests.
