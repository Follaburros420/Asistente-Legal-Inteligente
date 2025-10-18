
#!/bin/bash
# Script para eliminar dependencias no utilizadas

echo "🧹 Eliminando dependencias no utilizadas..."

# Dependencias de producción no utilizadas
npm uninstall @anthropic-ai/sdk
npm uninstall @apidevtools/json-schema-ref-parser
npm uninstall @azure/openai
npm uninstall @google/generative-ai
npm uninstall @hookform/resolvers
npm uninstall @mendable/firecrawl-js
npm uninstall @mistralai/mistralai
npm uninstall @supabase/ssr
npm uninstall @supabase/supabase-js
npm uninstall @tiptap/extension-character-count
npm uninstall @tiptap/extension-color
npm uninstall @tiptap/extension-text-align
npm uninstall @tiptap/extension-text-style
npm uninstall @tiptap/extension-underline
npm uninstall @tiptap/starter-kit
npm uninstall @vercel/analytics
npm uninstall @vercel/edge-config
npm uninstall @xenova/transformers
npm uninstall d3-dsv
npm uninstall dotenv
npm uninstall endent
npm uninstall zod

# Dependencias de desarrollo no utilizadas
npm uninstall --save-dev @next/bundle-analyzer
npm uninstall --save-dev @tailwindcss/typography
npm uninstall --save-dev clsx
npm uninstall --save-dev eslint-config-next
npm uninstall --save-dev eslint-config-prettier
npm uninstall --save-dev eslint-plugin-tailwindcss
npm uninstall --save-dev jest-environment-jsdom
npm uninstall --save-dev shadcn
npm uninstall --save-dev tailwind-merge
npm uninstall --save-dev tailwindcss-animate
npm uninstall --save-dev ts-node

echo "✅ Limpieza de dependencias completada"
echo "💾 Espacio ahorrado en node_modules"
