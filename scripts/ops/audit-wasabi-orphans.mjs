#!/usr/bin/env node

import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT
const WASABI_REGION = process.env.WASABI_REGION || "us-east-1"
const WASABI_BUCKET = process.env.WASABI_BUCKET
const WASABI_ACCESS_KEY_ID = process.env.WASABI_ACCESS_KEY_ID
const WASABI_SECRET_ACCESS_KEY = process.env.WASABI_SECRET_ACCESS_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
if (!WASABI_ENDPOINT || !WASABI_BUCKET || !WASABI_ACCESS_KEY_ID || !WASABI_SECRET_ACCESS_KEY) {
  console.error(
    "Missing WASABI_ENDPOINT/WASABI_BUCKET/WASABI_ACCESS_KEY_ID/WASABI_SECRET_ACCESS_KEY"
  )
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const APPLY_DELETE = args.has("--apply-delete")
const WRITE_REPORT = !args.has("--no-report")

const MIN_AGE_HOURS_ARG = [...args].find((arg) => arg.startsWith("--min-age-hours="))
const MIN_AGE_HOURS = MIN_AGE_HOURS_ARG
  ? Number.parseInt(MIN_AGE_HOURS_ARG.split("=")[1] || "24", 10)
  : 24

const LIMIT_ARG = [...args].find((arg) => arg.startsWith("--limit="))
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1] || "0", 10) : null

const TARGET_BUCKETS = ["files", "message_images", "profile_images", "workspace_images", "assistant_images"]
const TARGET_BUCKETS_SET = new Set(TARGET_BUCKETS)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
const s3 = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  forcePathStyle: process.env.WASABI_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY_ID,
    secretAccessKey: WASABI_SECRET_ACCESS_KEY
  }
})

function nowIso() {
  return new Date().toISOString()
}

function parseObjectKey(rawKey) {
  const key = String(rawKey || "").replace(/^\/+/, "")
  const parts = key.split("/")
  const bucket = parts[0]
  const objectPath = parts.slice(1).join("/")
  return { key, bucket, objectPath }
}

function isOldEnough(lastModified, minAgeHours) {
  if (!lastModified) return true
  const ageMs = Date.now() - new Date(lastModified).getTime()
  return ageMs >= Math.max(0, minAgeHours) * 60 * 60 * 1000
}

async function loadInventorySet() {
  const set = new Set()
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from("object_storage_inventory")
      .select("bucket,object_path")
      .eq("status", "active")
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Failed loading object_storage_inventory: ${error.message}`)
    }

    const page = data || []
    for (const row of page) {
      const bucket = String((row || {}).bucket || "")
      const objectPath = String((row || {}).object_path || "").replace(/^\/+/, "")
      if (TARGET_BUCKETS_SET.has(bucket) && objectPath) {
        set.add(`${bucket}/${objectPath}`)
      }
    }

    if (page.length < pageSize) break
    offset += pageSize
  }

  return set
}

async function listWasabiObjects() {
  const rows = []

  for (const prefix of TARGET_BUCKETS) {
    let token
    do {
      const output = await s3.send(
        new ListObjectsV2Command({
          Bucket: WASABI_BUCKET,
          Prefix: `${prefix}/`,
          ContinuationToken: token,
          MaxKeys: 1000
        })
      )
      for (const item of output.Contents || []) {
        rows.push(item)
      }
      token = output.IsTruncated ? output.NextContinuationToken : undefined
    } while (token)
  }

  return rows
}

function chunk(items, size) {
  const output = []
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size))
  }
  return output
}

async function deleteObjects(keys) {
  for (const group of chunk(keys, 500)) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: WASABI_BUCKET,
        Delete: {
          Objects: group.map((key) => ({ Key: key })),
          Quiet: true
        }
      })
    )
  }
}

function ensureReportDir() {
  const reportDir = path.join(process.cwd(), "docs", "reports")
  fs.mkdirSync(reportDir, { recursive: true })
  return reportDir
}

async function main() {
  console.log("[audit-wasabi-orphans] starting")
  console.log(
    `[audit-wasabi-orphans] mode=${APPLY_DELETE ? "delete" : "dry-run"} minAgeHours=${MIN_AGE_HOURS}`
  )

  const inventorySet = await loadInventorySet()
  const wasabiObjects = await listWasabiObjects()

  const orphanCandidates = []
  let totalBytes = 0

  for (const item of wasabiObjects) {
    const parsed = parseObjectKey(item.Key)
    if (!TARGET_BUCKETS_SET.has(parsed.bucket) || !parsed.objectPath) continue
    if (inventorySet.has(parsed.key)) continue
    if (!isOldEnough(item.LastModified, MIN_AGE_HOURS)) continue

    const size = Number.parseInt(String(item.Size || 0), 10) || 0
    orphanCandidates.push({
      key: parsed.key,
      sizeBytes: size,
      lastModified: item.LastModified || null
    })
    totalBytes += size
  }

  const effectiveCandidates =
    LIMIT && Number.isFinite(LIMIT) && LIMIT > 0
      ? orphanCandidates.slice(0, LIMIT)
      : orphanCandidates

  if (APPLY_DELETE && effectiveCandidates.length > 0) {
    await deleteObjects(effectiveCandidates.map((row) => row.key))
  }

  const report = {
    generatedAt: nowIso(),
    mode: APPLY_DELETE ? "delete" : "dry-run",
    minAgeHours: MIN_AGE_HOURS,
    limit: LIMIT || null,
    totals: {
      inventoryActiveKeys: inventorySet.size,
      wasabiObjectsScanned: wasabiObjects.length,
      orphanCandidates: orphanCandidates.length,
      orphanCandidatesBytes: totalBytes,
      effectiveCandidates: effectiveCandidates.length
    },
    preview: effectiveCandidates.slice(0, 20)
  }

  if (WRITE_REPORT) {
    const reportDir = ensureReportDir()
    const reportPath = path.join(reportDir, `wasabi-orphans-${Date.now()}.json`)
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    report.reportPath = reportPath
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error("[audit-wasabi-orphans] fatal:", error)
  process.exit(1)
})
