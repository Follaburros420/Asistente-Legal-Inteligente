// app/api/debug/wompi-config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { wompiConfig, validateWompiConfig } from '@/lib/wompi/config';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

export async function GET(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  try {
    const validation = validateWompiConfig();
    
    // Verificar configuración sin exponer las llaves privadas
    const config = {
      environment: wompiConfig.environment,
      isEnabled: wompiConfig.isEnabled,
      baseUrl: wompiConfig.baseUrl,
      hasPublicKey: !!wompiConfig.publicKey,
      hasPrivateKey: !!wompiConfig.privateKey,
      hasIntegritySecret: !!wompiConfig.integritySecret,
      hasWebhookSecret: !!wompiConfig.webhookSecret,
      publicKeyPrefix: wompiConfig.publicKey ? wompiConfig.publicKey.substring(0, 10) + '...' : 'No configurada',
      validation,
      environmentVariables: {
        WOMPI_ENVIRONMENT: process.env.WOMPI_ENVIRONMENT || 'No configurada',
        NEXT_PUBLIC_WOMPI_PUBLIC_KEY: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ? 'Configurada' : 'No configurada',
        WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY ? 'Configurada' : 'No configurada',
        WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET ? 'Configurada' : 'No configurada',
        WOMPI_WEBHOOK_SECRET: process.env.WOMPI_WEBHOOK_SECRET ? 'Configurada' : 'No configurada',
        NEXT_PUBLIC_WOMPI_BASE_URL: process.env.NEXT_PUBLIC_WOMPI_BASE_URL || 'No configurada',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'No configurada'
      }
    };

    return NextResponse.json({
      success: true,
      config,
      message: wompiConfig.isEnabled ? 'Wompi está activado' : 'Wompi está desactivado',
      status: validation.isValid ? 'Configuración válida' : `Faltan campos: ${validation.missingFields.join(', ')}`
    });

  } catch (error) {
    console.error('Error verificando configuración de Wompi:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error verificando configuración',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
