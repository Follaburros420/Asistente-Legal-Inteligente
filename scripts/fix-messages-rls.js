/**
 * Fix para políticas RLS de messages
 * Permite usar chat_id (sistema antiguo) o session_id (sistema nuevo)
 */

const fs = require('fs');
const path = require('path');

const sqlContent = `begin;

-- Drop existing messages policies
drop policy if exists messages_owner_all on public.messages;
drop policy if exists messages_no_access on public.messages;
drop policy if exists messages_chat_owner_all on public.messages;

-- Create policy for messages based on chat_id (backward compatibility)
create policy messages_chat_owner_all
on public.messages
for all
to authenticated
using (
  -- Allow if user owns the chat
  exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.user_id = (select auth.uid())
  )
  -- OR if user owns the session (new system)
  or exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select public.current_auth_uid_text())
  )
  -- OR if user is the message owner (legacy)
  or user_id = (select auth.uid())
)
with check (
  -- Allow if user owns the chat
  exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.user_id = (select auth.uid())
  )
  -- OR if user owns the session (new system)
  or exists (
    select 1
    from public.sessions s
    where s.id = messages.session_id
      and s.user_id = (select public.current_auth_uid_text())
  )
  -- OR if user is the message owner (legacy)
  or user_id = (select auth.uid())
);

commit;
`;

console.log('═══════════════════════════════════════════════════════════');
console.log('  FIX PARA POLITICAS RLS DE MESSAGES');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📋 INSTRUCCIONES:');
console.log('1. Ve al dashboard de Supabase: https://supabase.com/dashboard');
console.log('2. Selecciona tu proyecto: givjfonqaiqhsjjjzedc');
console.log('3. Ve a: SQL Editor > New query');
console.log('4. Copia y pega el siguiente SQL:');
console.log('\n' + '─'.repeat(60));
console.log(sqlContent);
console.log('─'.repeat(60) + '\n');

console.log('5. Ejecuta el query (Run)');
console.log('6. Luego intenta escribir desde las cuentas nuevas\n');

// También guardar en archivo
const outputPath = path.join(__dirname, 'fix-messages-rls.sql');
fs.writeFileSync(outputPath, sqlContent);
console.log('✅ SQL tambien guardado en:', outputPath);

console.log('\n🔍 EXPLICACION DEL PROBLEMA:');
console.log('Las politicas RLS de "messages" fueron actualizadas para usar');
console.log('"session_id" en lugar de "chat_id", pero el frontend aun envia');
console.log('mensajes con "chat_id". Esto causaba el error sin texto.\n');

console.log('✅ La solucion permite ambos metodos:');
console.log('   - chat_id (sistema actual)');
console.log('   - session_id (sistema nuevo)');
console.log('   - user_id (legacy)\n');
