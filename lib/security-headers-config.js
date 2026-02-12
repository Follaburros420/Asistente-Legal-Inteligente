/**
 * Security headers configuration
 * Protects against XSS, clickjacking, MIME sniffing, and other attacks
 */

/**
 * Build Content Security Policy based on environment
 *
 * CSP directives restrict sources of content (scripts, styles, images, etc.)
 * to prevent XSS attacks and data exfiltration
 */
function buildCSP() {
    const isDev = process.env.NODE_ENV === 'development';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
    const openAiUrl = 'https://api.openai.com';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    // const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Unused in original code

    const getOrigin = (value) => {
        if (!value || typeof value !== 'string') return null;
        try {
            return new URL(value).origin;
        } catch {
            return null;
        }
    };

    const formActionSources = [`'self'`];
    const appOrigin = getOrigin(appUrl);
    const siteOrigin = getOrigin(siteUrl);
    if (appOrigin && !formActionSources.includes(appOrigin)) formActionSources.push(appOrigin);
    if (siteOrigin && !formActionSources.includes(siteOrigin)) formActionSources.push(siteOrigin);

    const directives = [
        // Default: Only allow same-origin
        `default-src 'self'`,

        // Scripts: Self, unsafe-eval for Next.js, unsafe-inline for both dev and production
        // Note: Next.js requires inline scripts for proper hydration and functionality
        `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net`,

        // Styles: Self + unsafe-inline (required for CSS-in-JS)
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,

        // Images: Self, data, blob, Supabase storage
        `img-src 'self' data: blob: ${supabaseUrl.replace(/https:\/\/\*\.?/, 'https://*')}`,

        // Fonts: Self + Google Fonts
        `font-src 'self' https://fonts.gstatic.com`,

        // Connect: API endpoints
        `connect-src 'self' ${supabaseUrl} ${openAiUrl} wss://*.supabase.co`,

        // Frame: None (prevent clickjacking)
        `frame-src 'none'`,
        `frame-ancestors 'none'`,

        // Object: None (prevent plugins)
        `object-src 'none'`,

        // Base: Self
        `base-uri 'self'`,

        // Form actions: self plus configured canonical origins.
        `form-action ${formActionSources.join(' ')}`,

        // Manifest: Self
        `manifest-src 'self'`,

        // Upgrade insecure requests in production
        ...(isDev ? [] : ['upgrade-insecure-requests']),

        // Worker sources
        `worker-src 'self' blob:`,

        // Media: Self + Supabase
        `media-src 'self' ${supabaseUrl.replace(/https:\/\/\*\.?/, 'https://*')}`,
    ];

    return directives.join('; ');
}

/**
 * Get security headers configuration
 */
function getSecurityHeaders() {
    const isDev = process.env.NODE_ENV === 'development';

    return {
        // Control DNS prefetching
        'X-DNS-Prefetch-Control': 'on',

        // HSTS: Enforce HTTPS for 2 years (include subdomains, preload)
        // Only in production, as localhost doesn't use HTTPS
        'Strict-Transport-Security': isDev
            ? 'max-age=0'
            : 'max-age=63072000; includeSubDomains; preload',

        // Prevent clickjacking
        'X-Frame-Options': 'DENY',

        // Prevent MIME sniffing
        'X-Content-Type-Options': 'nosniff',

        // XSS protection (legacy, modern browsers use CSP)
        'X-XSS-Protection': '1; mode=block',

        // Referrer policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',

        // Permissions policy (formerly Feature-Policy)
        'Permissions-Policy':
            'camera=(), microphone=(), geolocation=(), payment=()',

        // Content Security Policy
        'Content-Security-Policy': buildCSP(),

        // Additional security headers for modern browsers
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
    };
}

module.exports = {
    buildCSP,
    getSecurityHeaders,
};
