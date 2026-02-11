#!/usr/bin/env node

import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT
const WASABI_REGION = process.env.WASABI_REGION || "us-east-1"
const WASABI_BUCKET = process.env.WASABI_BUCKET
const WASABI_ACCESS_KEY_ID = process.env.WASABI_ACCESS_KEY_ID
const WASABI_SECRET_ACCESS_KEY = process.env.WASABI_SECRET_ACCESS_KEY
const WASABI_FORCE_PATH_STYLE = process.env.WASABI_FORCE_PATH_STYLE !== "false"
const WASABI_MULTIPART_THRESHOLD_MB = Number.parseInt(
  process.env.WASABI_MULTIPART_THRESHOLD_MB || "8",
  10
)

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has("--dry-run")
const OVERWRITE = args.has("--overwrite")
const LIMIT_ARG = [...args].find((arg) => arg.startsWith("--limit="))
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1], 10) : null

const BUCKETS_ARG = [...args].find((arg) => arg.startsWith("--buckets="))
const BUCKETS = BUCKETS_ARG
  ? BUCKETS_ARG.split("=")[1].split(",").map((bucket) => bucket.trim()).filter(Boolean)
  : ["files", "message_images", "profile_images", "workspace_images", "assistant_images"]

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
if (!WASABI_ENDPOINT || !WASABI_BUCKET || !WASABI_ACCESS_KEY_ID || !WASABI_SECRET_ACCESS_KEY) {
  console.error("Missing Wasabi env vars (WASABI_ENDPOINT, WASABI_BUCKET, WASABI_ACCESS_KEY_ID, WASABI_SECRET_ACCESS_KEY)")
  process.exit(1)
}

const multipartThresholdBytes = Math.max(1, WASABI_MULTIPART_THRESHOLD_MB) * 1024 * 1024
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
const s3 = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  forcePathStyle: WASABI_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY_ID,
    secretAccessKey: WASABI_SECRET_ACCESS_KEY
  }
})

function targetKey(bucket, name) {
  const normalizedBucket = bucket.replace(/^\/+|\/+$/g, "")
  const normalizedName = name.replace(/^\/+/, "")
  return `${normalizedBucket}/${normalizedName}`
}

async function objectExists(key) {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: WASABI_BUCKET,
        Key: key
      })
    )
    return true
  } catch {
    return false
  }
}

async function listObjects() {
  const rows = []
  const hardLimit = LIMIT && Number.isFinite(LIMIT) ? LIMIT : null

  const normalizePrefix = (prefix) => prefix.replace(/^\/+|\/+$/g, "")
  const folderQueue = BUCKETS.map((bucket) => ({
    bucket,
    prefix: ""
  }))
  const visited = new Set()
  const pageSize = 100

  while (folderQueue.length > 0) {
    const current = folderQueue.shift()
    if (!current) {
      continue
    }

    const normalizedPrefix = normalizePrefix(current.prefix)
    const visitKey = `${current.bucket}::${normalizedPrefix}`
    if (visited.has(visitKey)) {
      continue
    }
    visited.add(visitKey)

    let offset = 0
    while (true) {
      const { data, error } = await supabase.storage.from(current.bucket).list(normalizedPrefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" }
      })

      if (error) {
        throw new Error(
          `Failed to list bucket ${current.bucket} at prefix "${normalizedPrefix}": ${error.message}`
        )
      }

      const page = data || []

      for (const entry of page) {
        const entryName = String(entry?.name || "").replace(/^\/+|\/+$/g, "")
        if (!entryName) {
          continue
        }

        const fullPath = normalizedPrefix ? `${normalizedPrefix}/${entryName}` : entryName
        const isFolder = !entry?.id

        if (isFolder) {
          folderQueue.push({ bucket: current.bucket, prefix: fullPath })
          continue
        }

        rows.push({
          bucket_id: current.bucket,
          name: fullPath,
          metadata: entry?.metadata || {}
        })

        if (hardLimit && rows.length >= hardLimit) {
          return rows.slice(0, hardLimit)
        }
      }

      if (page.length < pageSize) {
        break
      }
      offset += pageSize
    }
  }

  return rows
}

async function migrateObject(row) {
  const key = targetKey(row.bucket_id, row.name)
  const size = Number.parseInt(String(row?.metadata?.size || "0"), 10) || 0

  if (!OVERWRITE) {
    const exists = await objectExists(key)
    if (exists) {
      return { status: "skipped_exists", key, size }
    }
  }

  if (DRY_RUN) {
    return { status: "dry_run", key, size }
  }

  const { data: blob, error } = await supabase.storage.from(row.bucket_id).download(row.name)
  if (error || !blob) {
    return { status: "download_error", key, size, error: error?.message || "unknown" }
  }

  const body = Buffer.from(await blob.arrayBuffer())
  const metadata = {
    logical_bucket: row.bucket_id
  }

  if (body.byteLength >= multipartThresholdBytes) {
    const uploader = new Upload({
      client: s3,
      params: {
        Bucket: WASABI_BUCKET,
        Key: key,
        Body: body,
        ContentType: blob.type || "application/octet-stream",
        Metadata: metadata
      }
    })
    await uploader.done()
  } else {
    await s3.send(
      new PutObjectCommand({
        Bucket: WASABI_BUCKET,
        Key: key,
        Body: body,
        ContentType: blob.type || "application/octet-stream",
        Metadata: metadata
      })
    )
  }

  return { status: "migrated", key, size }
}

async function main() {
  console.log("[migrate-storage-to-wasabi] Starting...")
  console.log(`[migrate-storage-to-wasabi] Buckets: ${BUCKETS.join(", ")}`)
  console.log(`[migrate-storage-to-wasabi] Mode: ${DRY_RUN ? "dry-run" : "write"}${OVERWRITE ? " (overwrite)" : ""}`)

  const rows = await listObjects()
  console.log(`[migrate-storage-to-wasabi] Objects discovered: ${rows.length}`)

  let migrated = 0
  let skipped = 0
  let errors = 0
  let bytes = 0

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const result = await migrateObject(row)
    const progress = `${index + 1}/${rows.length}`

    if (result.status === "migrated") {
      migrated += 1
      bytes += result.size || 0
      console.log(`[${progress}] migrated ${result.key}`)
      continue
    }

    if (result.status === "dry_run" || result.status === "skipped_exists") {
      skipped += 1
      console.log(`[${progress}] ${result.status} ${result.key}`)
      continue
    }

    errors += 1
    console.error(`[${progress}] ERROR ${result.key}: ${result.error || result.status}`)
  }

  console.log("[migrate-storage-to-wasabi] Done")
  console.log(
    JSON.stringify(
      {
        discovered: rows.length,
        migrated,
        skipped,
        errors,
        migratedBytes: bytes
      },
      null,
      2
    )
  )

  if (errors > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("[migrate-storage-to-wasabi] Fatal:", error)
  process.exit(1)
})
