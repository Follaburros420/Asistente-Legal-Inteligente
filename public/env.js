// Public environment variables for client-side access
// Auto-generated from environment variables during build
// This file provides fallback values; runtime environment variables will take precedence if available

window.__ENV__ = {
  "NEXT_PUBLIC_APP_URL": "http://localhost:3000",
  "NEXT_PUBLIC_SUPABASE_URL": "https://givjfonqaiqhsjjjzedc.supabase.co",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzA1MzY1NjAsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.2niAfGkHpUT6g8_1ymXkTVgOLl_8aTDWHd_f550Q498",
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
