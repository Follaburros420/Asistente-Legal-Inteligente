// Test del endpoint /api/chat/openrouter con búsqueda web
require('dotenv').config({ path: '.env.local' });

async function testOpenRouterEndpoint() {
  console.log('\n🔥 TEST: Endpoint /api/chat/openrouter con búsqueda web');
  console.log('========================================================\n');

  const testPayload = {
    chatSettings: {
      model: "alibaba/tongyi-deepresearch-30b-a3b",
      prompt: "Eres un asistente legal especializado en derecho colombiano.",
      temperature: 0.5,
      contextLength: 4096,
      includeProfileContext: true,
      includeWorkspaceInstructions: true,
      embeddingsProvider: "openai"
    },
    messages: [
      {
        role: "user",
        content: "¿Qué dice el artículo 11 de la Constitución colombiana sobre el derecho a la vida?"
      }
    ]
  };

  try {
    console.log('📡 Enviando petición a /api/chat/openrouter...');
    console.log('   Modelo:', testPayload.chatSettings.model);
    console.log('   Mensaje:', testPayload.messages[0].content);
    
    const response = await fetch('http://localhost:3000/api/chat/openrouter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify(testPayload)
    });

    console.log('📊 Respuesta del servidor:');
    console.log('   Status:', response.status);
    console.log('   Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      console.log('✅ Endpoint funcionando correctamente');
      
      // Leer el stream de respuesta
      const reader = response.body.getReader();
      let result = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        result += chunk;
        
        // Mostrar los primeros chunks para verificar que está funcionando
        if (result.length < 500) {
          console.log('📝 Chunk recibido:', chunk.substring(0, 100) + '...');
        }
      }
      
      console.log('\n📄 Respuesta completa (primeros 500 chars):');
      console.log(result.substring(0, 500) + '...');
      
    } else {
      const errorText = await response.text();
      console.log('❌ Error en el endpoint:', errorText);
    }

  } catch (error) {
    console.error('❌ Error en la petición:', error);
  }
}

// Esperar a que el servidor esté listo
setTimeout(() => {
  testOpenRouterEndpoint();
}, 5000);







