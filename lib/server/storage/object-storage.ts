import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { env } from "@/lib/env/runtime-env"
import { Database } from "@/supabase/types"

type ObjectStorageProvider = "supabase" | "wasabi"

interface UploadObjectInput {
  key: string
  file: File | Blob | Buffer | Uint8Array
  bucket?: string
  contentType?: string
  metadata?: Record<string, string>
  upsert?: boolean
}

const DEFAULT_SUPABASE_BUCKET = "files"
const DEFAULT_WASABI_REGION = "us-east-1"
const DEFAULT_MULTIPART_THRESHOLD_MB = 8

function getProviderName(): ObjectStorageProvider {
  const raw = (process.env.OBJECT_STORAGE_PROVIDER || "supabase").trim().toLowerCase()
  return raw === "wasabi" ? "wasabi" : "supabase"
}

function getSupabaseBucketName(): string {
  return (process.env.OBJECT_STORAGE_SUPABASE_BUCKET || DEFAULT_SUPABASE_BUCKET).trim()
}

function getBucketName(bucket?: string): string {
  return (bucket || getSupabaseBucketName()).trim()
}

function getWasabiObjectKey(bucket: string, key: string): string {
  const normalizedBucket = bucket.replace(/^\/+|\/+$/g, "")
  const normalizedKey = key.replace(/^\/+/, "")
  if (normalizedKey.startsWith(`${normalizedBucket}/`)) {
    return normalizedKey
  }
  return `${normalizedBucket}/${normalizedKey}`
}

function shouldFallbackToSupabaseRead(): boolean {
  return process.env.OBJECT_STORAGE_SUPABASE_READ_FALLBACK !== "false"
}

function shouldRepairWasabiFromFallback(): boolean {
  return process.env.OBJECT_STORAGE_SUPABASE_READ_REPAIR !== "false"
}

function isMissingObjectError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase()
  const name = String(error?.name || "")
  const status = Number(error?.$metadata?.httpStatusCode || error?.status || 0)
  return (
    name === "NoSuchKey" ||
    status === 404 ||
    message.includes("no such key") ||
    message.includes("not found")
  )
}

function getWasabiClient(): S3Client {
  const endpoint = (process.env.WASABI_ENDPOINT || "").trim()
  const region = (process.env.WASABI_REGION || DEFAULT_WASABI_REGION).trim()
  const accessKeyId = (process.env.WASABI_ACCESS_KEY_ID || "").trim()
  const secretAccessKey = (process.env.WASABI_SECRET_ACCESS_KEY || "").trim()

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Wasabi no configurado correctamente. Revisa WASABI_ENDPOINT, WASABI_ACCESS_KEY_ID y WASABI_SECRET_ACCESS_KEY."
    )
  }

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.WASABI_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
}

function getWasabiBucketName(): string {
  const bucket = (process.env.WASABI_BUCKET || "").trim()
  if (!bucket) {
    throw new Error("WASABI_BUCKET no está configurado")
  }
  return bucket
}

function getMultipartThresholdBytes(): number {
  const raw = Number.parseInt(process.env.WASABI_MULTIPART_THRESHOLD_MB || "", 10)
  const mb = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MULTIPART_THRESHOLD_MB
  return mb * 1024 * 1024
}

async function toBuffer(file: File | Blob | Buffer | Uint8Array): Promise<Buffer> {
  if (Buffer.isBuffer(file)) {
    return file
  }
  if (file instanceof Uint8Array) {
    return Buffer.from(file)
  }
  return Buffer.from(await file.arrayBuffer())
}

class SupabaseStorageProvider {
  private getClient() {
    return createSupabaseClient<Database>(env.supabaseUrl(), env.supabaseServiceRole())
  }

  async upload(input: UploadObjectInput): Promise<void> {
    const bucket = getBucketName(input.bucket)
    const client = this.getClient()
    const { error } = await client.storage.from(bucket).upload(input.key, input.file, {
      upsert: input.upsert ?? true,
      contentType: input.contentType
    })
    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`)
    }
  }

  async download(key: string, bucketName?: string): Promise<Blob> {
    const bucket = getBucketName(bucketName)
    const client = this.getClient()
    const { data, error } = await client.storage.from(bucket).download(key)
    if (error || !data) {
      throw new Error(`Supabase storage download failed: ${error?.message || "unknown"}`)
    }
    return data
  }

  async remove(key: string, bucketName?: string): Promise<void> {
    const bucket = getBucketName(bucketName)
    const client = this.getClient()
    const { error } = await client.storage.from(bucket).remove([key])
    if (error) {
      throw new Error(`Supabase storage delete failed: ${error.message}`)
    }
  }
}

class WasabiStorageProvider {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly multipartThresholdBytes: number

  constructor() {
    this.client = getWasabiClient()
    this.bucket = getWasabiBucketName()
    this.multipartThresholdBytes = getMultipartThresholdBytes()
  }

  async upload(input: UploadObjectInput): Promise<void> {
    const bucket = getBucketName(input.bucket)
    const objectKey = getWasabiObjectKey(bucket, input.key)
    const body = await toBuffer(input.file)

    if (body.byteLength >= this.multipartThresholdBytes) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: objectKey,
          Body: body,
          ContentType: input.contentType || "application/octet-stream",
          Metadata: {
            logical_bucket: bucket,
            ...(input.metadata || {})
          }
        }
      })
      await upload.done()
      return
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: input.contentType || "application/octet-stream",
        Metadata: {
          logical_bucket: bucket,
          ...(input.metadata || {})
        }
      })
    )
  }

  async download(key: string, bucketName?: string): Promise<Blob> {
    const bucket = getBucketName(bucketName)
    const objectKey = getWasabiObjectKey(bucket, key)
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })
    )

    if (!response.Body || typeof (response.Body as any).transformToByteArray !== "function") {
      throw new Error("Wasabi download response body is not readable")
    }

    const bytes = await (response.Body as any).transformToByteArray()
    return new Blob([bytes], {
      type: response.ContentType || "application/octet-stream"
    })
  }

  async remove(key: string, bucketName?: string): Promise<void> {
    const bucket = getBucketName(bucketName)
    const objectKey = getWasabiObjectKey(bucket, key)
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })
    )
  }
}

let supabaseProvider: SupabaseStorageProvider | null = null
let wasabiProvider: WasabiStorageProvider | null = null

function getSupabaseProvider(): SupabaseStorageProvider {
  if (!supabaseProvider) {
    supabaseProvider = new SupabaseStorageProvider()
  }
  return supabaseProvider
}

function getWasabiProvider(): WasabiStorageProvider {
  if (!wasabiProvider) {
    wasabiProvider = new WasabiStorageProvider()
  }
  return wasabiProvider
}

export function getObjectStorageProvider(): ObjectStorageProvider {
  return getProviderName()
}

export async function uploadObject(input: UploadObjectInput): Promise<void> {
  if (getProviderName() === "wasabi") {
    await getWasabiProvider().upload(input)
    return
  }
  await getSupabaseProvider().upload(input)
}

export async function downloadObject(key: string): Promise<Blob> {
  return downloadObjectFromBucket(key, undefined)
}

export async function downloadObjectFromBucket(
  key: string,
  bucket?: string
): Promise<Blob> {
  if (getProviderName() === "wasabi") {
    try {
      return await getWasabiProvider().download(key, bucket)
    } catch (error: any) {
      if (shouldFallbackToSupabaseRead() && isMissingObjectError(error)) {
        console.warn(
          `[object-storage] Wasabi key missing, fallback to Supabase read bucket=${getBucketName(
            bucket
          )} key=${key}`
        )
        const fallbackBlob = await getSupabaseProvider().download(key, bucket)
        if (shouldRepairWasabiFromFallback()) {
          await getWasabiProvider()
            .upload({
              bucket: getBucketName(bucket),
              key,
              file: fallbackBlob,
              contentType: fallbackBlob.type || "application/octet-stream",
              metadata: {
                source: "supabase_read_fallback_repair"
              }
            })
            .catch((repairError) => {
              console.warn(
                `[object-storage] Failed to repair Wasabi object from fallback bucket=${getBucketName(
                  bucket
                )} key=${key} error=${String((repairError as any)?.message || repairError)}`
              )
            })
        }
        return fallbackBlob
      }
      throw error
    }
  }
  return await getSupabaseProvider().download(key, bucket)
}

export async function deleteObject(key: string): Promise<void> {
  return deleteObjectFromBucket(key, undefined)
}

export async function deleteObjectFromBucket(
  key: string,
  bucket?: string
): Promise<void> {
  if (getProviderName() === "wasabi") {
    await getWasabiProvider().remove(key, bucket)
    return
  }
  await getSupabaseProvider().remove(key, bucket)
}
