// Re-export everything from browser-client to ensure single client instance
export { 
  supabase, 
  createClient,
  resetSupabaseClient,
  createFreshClient,
  executeWithSchemaRetry,
  canCreateSupabaseClient 
} from "@/lib/supabase/browser-client"
