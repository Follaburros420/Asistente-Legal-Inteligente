# Matriz Ejecutable de Refactor DB (Monolito)

## Estado global (actual)
- Fase A: `DONE`
- Fase B: `DONE`
- Fase C: `IN_PROGRESS`
- Fase D (deuda de stubs `db/*`): `DONE`
- Fase E (hardening pagos + drift tipos): `IN_PROGRESS`
- Fase F (higiene de deploy y bundle): `IN_PROGRESS`
- Fase G (hardening RLS + compat admin post-contract): `DONE`
- Fase H (contract final de tabla legacy `users`): `DONE`

## Fase A - Compatibilidad y RLS minima (DONE)
- Objetivo: eliminar drift entre codigo legacy y esquema real para evitar fallos runtime.
- Cambios en codigo:
  - `db/messages.ts`: adapter `chat_id -> session_id` + metadata legacy + fallback no bloqueante.
  - `db/messages.ts`: remove RPC legacy de borrado por secuencia.
  - `db/chats.ts`: saneo de payload y normalizacion de retorno.
  - `db/chats.ts`: soporte de `assistant_id` restaurado.
  - `components/chat/chat-helpers/index.ts`: evita inserts dependientes de `messages` cuando persistencia legacy esta desactivada.
  - `components/chat/chat-hooks/use-chat-handler.tsx`: payload usa `selectedAssistant`.
  - `components/chat/chat-ui.tsx`: reset de assistant/tools al cargar chat para evitar arrastre de contexto.
  - `app/api/processes/[processId]/chat/route.ts`: se elimina persistencia legacy no necesaria.
  - `app/api/admin/database/tables/route.ts`: columnas reales de `messages`.
- Migraciones DB aplicadas:
  - `supabase/migrations/20260211031611_drop_legacy_message_delete_rpcs.sql`
  - `supabase/migrations/20260211032400_cleanup_orphan_rows_safe.sql`
  - `supabase/migrations/20260211033533_add_chats_assistant_id_back.sql`
  - `supabase/migrations/20260211034237_enable_sessions_messages_owner_rls.sql`
  - `supabase/migrations/20260211040217_backfill_workspace_links_single_workspace_users.sql`
  - `supabase/migrations/20260211040953_repoint_assistant_collections_to_processes.sql`
  - `supabase/migrations/20260211041744_create_wompi_webhook_events.sql`
  - `supabase/migrations/20260211042501_wompi_webhook_events_explicit_deny_policies.sql`
  - `supabase/migrations/20260211050626_drop_legacy_collection_tables.sql`
  - `supabase/migrations/20260211051334_drop_legacy_rag_documents_chunks.sql`
- Resultado:
  - `sessions/messages` ya no tienen politica `no_access`.
  - politicas owner-based activas para rol `authenticated`.

## Fase B - Limpieza segura de datos (DONE)
- Objetivo: limpiar ruido sin riesgo funcional.
- Evidencia:
  - limpieza ejecutada: `message_file_items` huerfanos eliminados (`58` filas).
  - tablas legacy removidas: `collections`, `collection_files`, `collection_workspaces` (filas archivadas en `legacy_cleanup_archive`).
  - bloque RAG legacy interno removido: tablas `documents`/`chunks` + funciones `hybrid_search`/`match_chunks`.
  - checks de orfandad actuales: `0` en `chat_files`, `process_*`, `message_file_items`.
  - inventario `public` actual: `46` tablas (`48` -> `46` tras contract RAG legacy).
  - tablas `public` con `0` filas: `35` (`37` -> `35`).
  - volumen actual relevante:
    - `chats`: `434`
    - `messages`: `0`
    - `sessions`: `0`
    - `processes`: `2`
    - `process_documents`: `2`
    - `process_ingestion_jobs`: `0`

## Fase C - Contract de legado chat (IN_PROGRESS)
- Objetivo: retirar adapters temporales cuando el frontend deje de depender de shape legacy.
- Pendientes:
  - regenerar `supabase/types.ts` completo desde remoto con `SUPABASE_ACCESS_TOKEN` (sin token local disponible).
  - decidir modelo final de persistencia chat:
    - opcion 1: mantener `sessions/messages` como storage de chat.
    - opcion 2: desactivarlo por completo y mantener solo estado local + endpoint externo.
  - eliminar adapters temporales en `db/messages.ts` y `db/chats.ts` al hacer cutover.
- Avance:
  - `supabase/types.ts` ya esta en `UTF-8` y alineado en puntos criticos:
    - `assistant_collections.collection_id -> processes(id)`.
    - `files.workspace_id` agregado y `file_workspaces` eliminado del flujo de runtime.
  - endpoints admin y user stats alineados con el nuevo esquema:
    - `app/api/admin/users/route.ts`: `documents` -> `process_documents`.
    - `app/api/admin/analytics/storage/route.ts`: `documents` -> `process_documents`.
    - `app/api/user/stats/route.ts`: conteo de mensajes por `sessions -> messages` (ya no `messages.user_id`).

## Fase D - Deuda critica de stubs `db/*` (DONE, P1)
- Problema:
  - deuda de compatibilidad legacy entre modulos `collections` y dominio real `processes`.
- Evidencia:
  - stubs ya corregidos con operaciones reales:
    - `db/assistants.ts`
    - `db/tools.ts`
    - `db/assistant-files.ts`
    - `db/assistant-tools.ts`
    - `db/assistant-collections.ts`
    - `db/collections.ts`
    - `db/collection-files.ts`
  - stubs aun pendientes:
    - ninguno en flujo principal (solo guardrails legacy)
  - coherencia de dominio aplicada:
    - `assistant_collections.collection_id` ahora referencia `processes(id)` (no `collections(id)`).
    - `db/assistant-collections.ts` resuelve colecciones desde tabla `processes`.
  - guard aplicado:
    - `db/folders.ts` ahora falla con error explicito (ya no retorna exito falso).
  - inconsistencias de datos en tablas puente corregidas:
    - `assistants` sin `assistant_workspaces`: `0`
    - `tools` sin `tool_workspaces`: `0`
    - `collections` sin `collection_workspaces`: `0`
  - inconsistencia runtime corregida:
    - `db/files.ts` ya no usa tabla inexistente `file_workspaces`; ahora usa `files.workspace_id`.
  - uso desde UI en `components/sidebar/items/all/sidebar-create-item.tsx`.

## Fase E - Hardening pagos + drift tipos (IN_PROGRESS)
- Objetivo:
  - asegurar idempotencia de webhooks de pago y cerrar drift restante de tipos.
- Avance:
  - tabla `public.wompi_webhook_events` creada con RLS e indice unico por `idempotency_key`.
  - politicas explicitas de denegacion para `anon` y `authenticated` en `wompi_webhook_events`.
  - flujo `app/api/wompi/webhook/route.ts` deja de depender de tabla faltante.
- Pendiente:
  - regeneracion completa de `supabase/types.ts` desde remoto para eliminar cualquier residuo legacy no critico.

## Fase F - Higiene deploy y performance build (IN_PROGRESS)
- Objetivo:
  - reducir tiempo de deploy y ruido de build eliminando codigo/dependencias no usadas.
- Avance:
  - carpetas legacy eliminadas del repo:
    - `Landing-Design/`
    - `Chatbot Design/`
    - `esfera 3d/`
  - modulo duplicado legacy removido:
    - `src/integrations/wompi/` (el runtime usa `lib/wompi/*`).
  - iconos no referenciados eliminados:
    - `components/icons/ali-svg.tsx`
    - `components/icons/legal-svg.tsx`
    - `components/icons/robot-svg.tsx`
  - componentes huérfanos eliminados:
    - `components/processes/process-management-page.tsx`
    - `components/processes/process-detail-page-v2.tsx`
    - `lib/utils/constants.ts`
    - `lib/utils/index.ts`
  - dependencias removidas de `package.json`/lockfile:
    - `@hookform/resolvers`, `@tailwindcss/typography`, `@tanstack/react-table`
    - `@tiptap/*` (5 paquetes), `@vercel/edge-config`
    - `html2pdf.js`, `jspdf-autotable`, `react-flow`
  - optimizacion de build-time side effects:
    - `app/api/rag/health/route.ts` ahora usa `dynamic = "force-dynamic"` y `revalidate = 0` para evitar llamadas externas en build.
  - contexto de build/deploy recortado:
    - `.dockerignore` endurecido
    - `.vercelignore` agregado
    - cleanup redundante eliminado de `Dockerfile` y `nixpacks.toml`
  - hardening de superficie debug en API:
    - `app/api/debug/*` ahora se bloquea por defecto en producción.
    - gate por entorno agregado en `lib/server/debug-route-gate.ts`.
    - override explícito para troubleshooting: `DEBUG_ROUTES_ENABLED=true`.
  - rutas demo removidas del app router:
    - `app/[locale]/chat-demo/page.tsx`
    - `app/[locale]/chat-completo/page.tsx`
    - `app/[locale]/debug-auth/page.tsx`
    - `app/[locale]/test-signup/page.tsx`
- Resultado validado:
  - `npm run build` en verde tras los recortes.
  - desaparece el error de health check externo durante build de `/api/rag/health`.
- Pendiente:
  - decidir si se eliminan por completo los endpoints `/api/debug/*` en una fase posterior.

## Fase G - Hardening RLS + compat admin post-contract (DONE)
- Objetivo:
  - cerrar lints de RLS y estabilizar endpoints que quedaron tocados tras eliminar legado (`documents/chunks`).
- Migraciones DB aplicadas:
  - `supabase/migrations/20260211052301_harden_rls_policies_phase1.sql`
  - `supabase/migrations/20260211052608_harden_rls_policies_phase2.sql`
  - `supabase/migrations/20260211052640_fix_sessions_messages_rls_initplan.sql`
- Resultado:
  - politicas RLS normalizadas y consolidadas para tablas criticas de orquestacion y billing.
  - advisors de seguridad/performance sin nuevos bloqueantes de RLS; quedan recomendaciones de `unused_index` para poda controlada.
  - rutas admin de storage/usuarios y endpoint de stats de usuario ya no dependen de tablas/columnas eliminadas.
  - dependencia RLS de `user_locations` respecto a `public.users` removida.

## Fase H - Contract final de tabla legacy `users` (DONE)
- Objetivo:
  - retirar `public.users` sin romper runtime, consolidando `auth.users` como fuente de verdad.
- Cambios en codigo:
  - `app/api/admin/users/[userId]/route.ts`: GET/PATCH/DELETE migrados a `supabase.auth.admin.*`.
  - `app/api/admin/users/[userId]/suspend/route.ts`: toggle de suspensión migrado a `ban_duration` en auth.
  - `app/api/admin/database/tables/route.ts`: se elimina tabla `users` del catálogo estático y se agregan tablas de procesos.
- Migraciones DB aplicadas:
  - `supabase/migrations/20260211053550_user_locations_rls_remove_users_dependency.sql`
  - `supabase/migrations/20260211053725_drop_legacy_users_table.sql`
- Resultado:
  - `public.users` eliminada.
  - cero dependencias activas de runtime a `public.users`.
  - panel admin funcional usando `auth.users` + `profiles`.
  - inventario `public` actualizado: `45` tablas.

## Verificacion rapida (queries)
- tablas y volumen:
  - `select relname, n_live_tup::bigint from pg_stat_user_tables where schemaname='public' order by relname;`
- politicas RLS:
  - `select tablename, policyname, roles, cmd from pg_policies where schemaname='public' and tablename in ('sessions','messages','process_ingestion_jobs');`
- funciones legacy eliminadas:
  - `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('delete_messages_including_and_after','delete_message_including_and_after');`
