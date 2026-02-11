#!/usr/bin/env node

import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const APPLY_UPSERT_MISSING = args.has("--apply-upsert-missing")
const APPLY_MARK_STALE = args.has("--apply-mark-stale")
const APPLY_FIX_PROVIDER = args.has("--apply-fix-provider")
const INCLUDE_MESSAGES = !args.has("--skip-messages")
const WRITE_REPORT = !args.has("--no-report")

const LIMIT_ARG = [...args].find((arg) => arg.startsWith("--limit="))
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1] || "0", 10) : null

const TARGET_BUCKETS = new Set([
  "files",
  "message_images",
  "profile_images",
  "workspace_images",
  "assistant_images"
])

const TARGET_PROVIDER =
  (process.env.OBJECT_STORAGE_PROVIDER || "supabase").trim().toLowerCase() === "wasabi"
    ? "wasabi"
    : "supabase"

const PAGE_SIZE = 1000
const CHUNK_SIZE = 200
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

function normalizePath(value) {
  const raw = String(value || "").trim()
  return raw.replace(/^\/+/, "")
}

function isNonEmptyPath(value) {
  return normalizePath(value).length > 0
}

function toInteger(value) {
  const number = Number.parseInt(String(value || "0"), 10)
  return Number.isFinite(number) ? number : 0
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value
}

function nowIso() {
  return new Date().toISOString()
}

async function selectAll(builderFactory, label) {
  const rows = []
  let offset = 0

  while (true) {
    const { data, error } = await builderFactory().range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      throw new Error(`${label}: ${error.message}`)
    }
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return rows
}

function registerReference(map, input) {
  const bucket = String(input.bucket || "").trim()
  const objectPath = normalizePath(input.objectPath)
  if (!TARGET_BUCKETS.has(bucket) || !objectPath) return

  const key = `${bucket}::${objectPath}`
  const next = {
    bucket,
    objectPath,
    ownerUserId: input.ownerUserId || null,
    workspaceId: input.workspaceId || null,
    sizeBytes: Math.max(0, toInteger(input.sizeBytes)),
    contentType: input.contentType || null,
    sourceTable: input.sourceTable || null,
    sourceId: input.sourceId || null,
    evidence: [input.evidence || input.sourceTable || "unknown"]
  }

  const current = map.get(key)
  if (!current) {
    map.set(key, next)
    return
  }

  map.set(key, {
    ...current,
    ownerUserId: current.ownerUserId || next.ownerUserId,
    workspaceId: current.workspaceId || next.workspaceId,
    sizeBytes: Math.max(current.sizeBytes, next.sizeBytes),
    contentType: current.contentType || next.contentType,
    sourceTable: current.sourceTable || next.sourceTable,
    sourceId: current.sourceId || next.sourceId,
    evidence: [...new Set([...current.evidence, ...next.evidence])]
  })
}

async function loadReferences() {
  const references = new Map()

  const files = await selectAll(
    () =>
      supabase
        .from("files")
        .select("id,user_id,workspace_id,file_path,size,type")
        .not("file_path", "is", null)
        .neq("file_path", ""),
    "load files references"
  )
  for (const row of files) {
    registerReference(references, {
      bucket: "files",
      objectPath: row.file_path,
      ownerUserId: row.user_id,
      workspaceId: row.workspace_id,
      sizeBytes: row.size || 0,
      contentType: row.type || null,
      sourceTable: "files",
      sourceId: row.id,
      evidence: "files.file_path"
    })
  }

  const processes = await selectAll(
    () => supabase.from("processes").select("id,workspace_id"),
    "load processes"
  )
  const processWorkspaceById = new Map(processes.map((row) => [row.id, row.workspace_id || null]))

  const processDocuments = await selectAll(
    () =>
      supabase
        .from("process_documents")
        .select("id,user_id,process_id,storage_path,size_bytes,mime_type")
        .not("storage_path", "is", null)
        .neq("storage_path", ""),
    "load process_documents references"
  )
  for (const row of processDocuments) {
    registerReference(references, {
      bucket: "files",
      objectPath: row.storage_path,
      ownerUserId: row.user_id,
      workspaceId: processWorkspaceById.get(row.process_id) || null,
      sizeBytes: row.size_bytes || 0,
      contentType: row.mime_type || null,
      sourceTable: "process_documents",
      sourceId: row.id,
      evidence: "process_documents.storage_path"
    })
  }

  const transcriptions = await selectAll(
    () =>
      supabase
        .from("transcriptions")
        .select("id,user_id,workspace_id,audio_path,file_size,audio_format")
        .not("audio_path", "is", null)
        .neq("audio_path", ""),
    "load transcriptions references"
  )
  for (const row of transcriptions) {
    registerReference(references, {
      bucket: "files",
      objectPath: row.audio_path,
      ownerUserId: row.user_id,
      workspaceId: row.workspace_id || null,
      sizeBytes: row.file_size || 0,
      contentType: row.audio_format || null,
      sourceTable: "transcriptions",
      sourceId: row.id,
      evidence: "transcriptions.audio_path"
    })
  }

  const profiles = await selectAll(
    () =>
      supabase
        .from("profiles")
        .select("id,user_id,image_path")
        .not("image_path", "is", null)
        .neq("image_path", ""),
    "load profiles image references"
  )
  for (const row of profiles) {
    registerReference(references, {
      bucket: "profile_images",
      objectPath: row.image_path,
      ownerUserId: row.user_id,
      workspaceId: null,
      sizeBytes: 0,
      contentType: null,
      sourceTable: "profiles",
      sourceId: row.id,
      evidence: "profiles.image_path"
    })
  }

  const workspaces = await selectAll(
    () =>
      supabase
        .from("workspaces")
        .select("id,user_id,image_path")
        .not("image_path", "is", null)
        .neq("image_path", ""),
    "load workspaces image references"
  )
  for (const row of workspaces) {
    registerReference(references, {
      bucket: "workspace_images",
      objectPath: row.image_path,
      ownerUserId: row.user_id,
      workspaceId: row.id,
      sizeBytes: 0,
      contentType: null,
      sourceTable: "workspaces",
      sourceId: row.id,
      evidence: "workspaces.image_path"
    })
  }

  const assistants = await selectAll(
    () =>
      supabase
        .from("assistants")
        .select("id,user_id,image_path")
        .not("image_path", "is", null)
        .neq("image_path", ""),
    "load assistants image references"
  )
  for (const row of assistants) {
    registerReference(references, {
      bucket: "assistant_images",
      objectPath: row.image_path,
      ownerUserId: row.user_id,
      workspaceId: null,
      sizeBytes: 0,
      contentType: null,
      sourceTable: "assistants",
      sourceId: row.id,
      evidence: "assistants.image_path"
    })
  }

  if (INCLUDE_MESSAGES) {
    const chats = await selectAll(
      () => supabase.from("chats").select("id,user_id"),
      "load chats for messages ownership"
    )
    const chatOwnerById = new Map(chats.map((row) => [row.id, row.user_id || null]))

    const messages = await selectAll(
      () =>
        supabase
          .from("messages")
          .select("id,session_id,metadata")
          .not("metadata", "is", null),
      "load messages metadata references"
    )
    for (const row of messages) {
      const metadata = asRecord(row.metadata)
      const metadataPaths = metadata.image_paths
      const paths = Array.isArray(metadataPaths) ? metadataPaths : []
      const metadataUserId = typeof metadata.user_id === "string" ? metadata.user_id : null
      const ownerUserId = metadataUserId || chatOwnerById.get(row.session_id) || null

      for (const messagePath of paths) {
        if (!isNonEmptyPath(messagePath)) continue
        registerReference(references, {
          bucket: "message_images",
          objectPath: messagePath,
          ownerUserId,
          workspaceId: null,
          sizeBytes: 0,
          contentType: null,
          sourceTable: "messages",
          sourceId: row.id,
          evidence: "messages.image_paths"
        })
      }
    }
  }

  return references
}

async function loadActiveInventory() {
  const rows = await selectAll(
    () =>
      supabase
        .from("object_storage_inventory")
        .select(
          "id,owner_user_id,workspace_id,bucket,object_path,size_bytes,content_type,storage_provider,source_table,source_id,status,deleted_at"
        )
        .eq("status", "active"),
    "load object_storage_inventory"
  )

  const filtered = rows.filter(
    (row) => TARGET_BUCKETS.has(String(row.bucket || "")) && isNonEmptyPath(row.object_path)
  )

  const map = new Map()
  for (const row of filtered) {
    const key = `${row.bucket}::${normalizePath(row.object_path)}`
    map.set(key, row)
  }

  return { rows: filtered, map }
}

function chunk(items, size) {
  const output = []
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size))
  }
  return output
}

function limitRows(items) {
  if (!LIMIT || !Number.isFinite(LIMIT) || LIMIT <= 0) return items
  return items.slice(0, LIMIT)
}

async function applyUpsertMissing(rows) {
  const now = nowIso()
  const payload = rows.map((row) => ({
    owner_user_id: row.ownerUserId,
    workspace_id: row.workspaceId,
    bucket: row.bucket,
    object_path: row.objectPath,
    size_bytes: row.sizeBytes,
    content_type: row.contentType,
    storage_provider: TARGET_PROVIDER,
    source_table: row.sourceTable,
    source_id: row.sourceId,
    metadata: {
      source: "reconcile_storage_inventory",
      evidence: row.evidence,
      reconciled_at: now
    },
    status: "active",
    deleted_at: null
  }))

  for (const slice of chunk(payload, CHUNK_SIZE)) {
    const { error } = await supabase
      .from("object_storage_inventory")
      .upsert(slice, { onConflict: "bucket,object_path" })
    if (error) {
      throw new Error(`Failed upserting missing inventory rows: ${error.message}`)
    }
  }
}

async function applyMarkStale(rows) {
  const now = nowIso()
  for (const slice of chunk(rows.map((row) => row.id), CHUNK_SIZE)) {
    const { error } = await supabase
      .from("object_storage_inventory")
      .update({
        status: "deleted",
        deleted_at: now,
        updated_at: now
      })
      .in("id", slice)
    if (error) {
      throw new Error(`Failed marking stale inventory rows as deleted: ${error.message}`)
    }
  }
}

async function applyFixProvider(rows) {
  const now = nowIso()
  for (const slice of chunk(rows.map((row) => row.id), CHUNK_SIZE)) {
    const { error } = await supabase
      .from("object_storage_inventory")
      .update({
        storage_provider: TARGET_PROVIDER,
        updated_at: now
      })
      .in("id", slice)
    if (error) {
      throw new Error(`Failed updating storage_provider on inventory: ${error.message}`)
    }
  }
}

function toPreview(rows, mapper, limit = 10) {
  return rows.slice(0, limit).map(mapper)
}

function ensureReportDir() {
  const reportDir = path.join(process.cwd(), "docs", "reports")
  fs.mkdirSync(reportDir, { recursive: true })
  return reportDir
}

async function main() {
  console.log("[reconcile-storage-inventory] starting")
  console.log(
    `[reconcile-storage-inventory] mode=${APPLY_UPSERT_MISSING || APPLY_MARK_STALE || APPLY_FIX_PROVIDER ? "apply" : "dry-run"} provider=${TARGET_PROVIDER}`
  )

  const references = await loadReferences()
  const { rows: inventoryRows, map: inventoryMap } = await loadActiveInventory()

  const missingInventory = []
  const staleInventory = []
  const ownerMismatches = []
  const workspaceMismatches = []
  const providerMismatches = []

  for (const [key, ref] of references.entries()) {
    const inventory = inventoryMap.get(key)
    if (!inventory) {
      if (ref.ownerUserId) {
        missingInventory.push(ref)
      }
      continue
    }

    if (inventory.owner_user_id && ref.ownerUserId && inventory.owner_user_id !== ref.ownerUserId) {
      ownerMismatches.push({
        key,
        expectedOwner: ref.ownerUserId,
        actualOwner: inventory.owner_user_id
      })
    }

    if (
      inventory.workspace_id &&
      ref.workspaceId &&
      inventory.workspace_id !== ref.workspaceId
    ) {
      workspaceMismatches.push({
        key,
        expectedWorkspace: ref.workspaceId,
        actualWorkspace: inventory.workspace_id
      })
    }

    if (inventory.storage_provider !== TARGET_PROVIDER) {
      providerMismatches.push(inventory)
    }
  }

  for (const [key, row] of inventoryMap.entries()) {
    if (!references.has(key)) {
      staleInventory.push(row)
    }
  }

  const effectiveMissing = limitRows(missingInventory)
  const effectiveStale = limitRows(staleInventory)
  const effectiveProviderMismatches = limitRows(providerMismatches)

  if (APPLY_UPSERT_MISSING && effectiveMissing.length > 0) {
    await applyUpsertMissing(effectiveMissing)
  }
  if (APPLY_MARK_STALE && effectiveStale.length > 0) {
    await applyMarkStale(effectiveStale)
  }
  if (APPLY_FIX_PROVIDER && effectiveProviderMismatches.length > 0) {
    await applyFixProvider(effectiveProviderMismatches)
  }

  const report = {
    generatedAt: nowIso(),
    targetProvider: TARGET_PROVIDER,
    includeMessages: INCLUDE_MESSAGES,
    applied: {
      upsertMissing: APPLY_UPSERT_MISSING,
      markStale: APPLY_MARK_STALE,
      fixProvider: APPLY_FIX_PROVIDER,
      limit: LIMIT || null
    },
    totals: {
      references: references.size,
      inventoryActive: inventoryRows.length,
      missingInventory: missingInventory.length,
      staleInventory: staleInventory.length,
      ownerMismatches: ownerMismatches.length,
      workspaceMismatches: workspaceMismatches.length,
      providerMismatches: providerMismatches.length
    },
    previews: {
      missingInventory: toPreview(
        missingInventory,
        (row) => `${row.bucket}/${row.objectPath} owner=${row.ownerUserId}`
      ),
      staleInventory: toPreview(
        staleInventory,
        (row) => `${row.bucket}/${normalizePath(row.object_path)} id=${row.id}`
      ),
      ownerMismatches: toPreview(ownerMismatches, (row) => row),
      workspaceMismatches: toPreview(workspaceMismatches, (row) => row),
      providerMismatches: toPreview(
        providerMismatches,
        (row) => `${row.bucket}/${normalizePath(row.object_path)} provider=${row.storage_provider}`
      )
    }
  }

  if (WRITE_REPORT) {
    const reportDir = ensureReportDir()
    const filename = `storage-reconcile-${Date.now()}.json`
    const fullPath = path.join(reportDir, filename)
    fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    report.reportPath = fullPath
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error("[reconcile-storage-inventory] fatal:", error)
  process.exit(1)
})
