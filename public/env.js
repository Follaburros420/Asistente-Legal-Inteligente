// Public environment variables for client-side access
// Auto-generated from environment variables during build
// This file provides fallback values; runtime environment variables will take precedence if available

window.__ENV__ = {
  "NEXT_PUBLIC_APP_URL": "http://localhost:3000",
  "NEXT_PUBLIC_SUPABASE_URL": "https://givjfonqaiqhsjjjzedc.supabase.co",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpdmpmb25xYWlxaHNqamp6ZWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxODc1NzIsImV4cCI6MjA2Nzc2MzU3Mn0.I5CoIzZF_Rd00ZoQ43urSUTEnXxqmJEMzP7sLptNZw4",
  "NEXT_PUBLIC_BILLING_ENABLED": "false"
};

// Runtime fallback: if build-time values are empty, try to read from meta tags
// (Meta tags can be injected by the server via next/head)
(function() {
  if (!window.__ENV__.NEXT_PUBLIC_SUPABASE_URL || !window.__ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const metaUrl = document.querySelector('meta[name="supabase-url"]');
      const metaKey = document.querySelector('meta[name="supabase-anon-key"]');
      if (metaUrl && metaUrl.content) window.__ENV__.NEXT_PUBLIC_SUPABASE_URL = metaUrl.content;
      if (metaKey && metaKey.content) window.__ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY = metaKey.content;
    } catch (e) {
      // Silently fail if DOM not ready
    }
  }
})();
