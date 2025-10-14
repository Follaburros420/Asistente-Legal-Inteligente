require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('\n🔍 Verificando buckets de almacenamiento en Supabase...\n')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno de Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkBuckets() {
  try {
    console.log('📦 Listando buckets...')
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) {
      console.error('❌ Error obteniendo buckets:', error)
      return
    }
    
    console.log('\n✅ Buckets encontrados:')
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (${bucket.public ? 'público' : 'privado'})`)
    })
    
    // Verificar si existe el bucket "files"
    const filesBucket = buckets.find(b => b.name === 'files')
    if (filesBucket) {
      console.log('\n✅ Bucket "files" existe y está configurado correctamente')
    } else {
      console.log('\n⚠️  Bucket "files" NO existe. Necesitas crearlo.')
      console.log('   Puedes crear el bucket desde el dashboard de Supabase:')
      console.log(`   ${supabaseUrl}/project/_/storage/buckets`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkBuckets()














