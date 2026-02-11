// app/api/debug/wompi-test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { blockIfDebugRouteDisabled } from '@/lib/server/debug-route-gate';

export async function GET(req: NextRequest) {
  const blocked = blockIfDebugRouteDisabled();
  if (blocked) return blocked;

  try {
    // Test Wompi API connection
    const wompiTestUrl = `${process.env.NEXT_PUBLIC_WOMPI_BASE_URL || 'https://sandbox.wompi.co'}/v1/merchants/${process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY}`;
    
    const response = await fetch(wompiTestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      wompiTestUrl,
      responseStatus: response.status,
      responseData: data,
      hasPublicKey: !!process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY,
      hasPrivateKey: !!process.env.WOMPI_PRIVATE_KEY,
      publicKey: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY?.substring(0, 10) + '...',
      baseUrl: process.env.NEXT_PUBLIC_WOMPI_BASE_URL
    });

  } catch (error) {
    console.error('Error testing Wompi connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error testing Wompi connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}




