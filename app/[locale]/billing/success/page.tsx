// app/[locale]/billing/success/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  Home,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface TransactionData {
  status: 'success' | 'failed' | 'pending' | 'unknown';
  statusMessage: string;
  transaction?: {
    id: string;
    status: string;
    amount_in_cents: number;
    amount_formatted: string;
    payment_method_type: string;
    created_at: string;
    finalized_at?: string;
    reference: string;
  };
  subscription?: {
    id: string;
    status: string;
    plan_name: string;
    period_end: string;
  };
}

export default function BillingSuccessPage() {
  const [data, setData] = useState<TransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'es';

  const isSubscriptionActivated = (subscription?: TransactionData['subscription']) => {
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  };

  useEffect(() => {
    checkTransactionStatus();
  }, []);

  // Auto-retry para transacciones pendientes o aprobadas sin activación aún
  useEffect(() => {
    const shouldRetry =
      data?.status === 'pending' ||
      (data?.status === 'success' &&
        !!data?.subscription &&
        !isSubscriptionActivated(data.subscription));

    if (shouldRetry && retryCount < 10) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        checkTransactionStatus();
      }, 3000); // Reintentar cada 3 segundos
      return () => clearTimeout(timer);
    }
  }, [data?.status, data?.subscription?.status, retryCount]);

  const checkTransactionStatus = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const transactionId = urlParams.get('id') || urlParams.get('transaction_id');
      const reference = urlParams.get('reference');

      if (!transactionId && !reference) {
        setError('No se encontró información de la transacción');
        setIsLoading(false);
        return;
      }

      // Llamar a nuestra API para verificar (no directamente a Wompi)
      const params = new URLSearchParams();
      if (transactionId) params.set('transaction_id', transactionId);
      if (reference) params.set('reference', reference);

      const response = await fetch(`/api/billing/verify-transaction?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error verificando transacción');
      }

      setData(result.data);

      // Redirigir al chat solo cuando la suscripcion ya este activa
      if (result.data.status === 'success' && isSubscriptionActivated(result.data.subscription)) {
        setTimeout(() => {
          router.push(`/${locale}`);
        }, 2500);
      }

    } catch (err) {
      console.error('Error checking transaction status:', err);
      setError(err instanceof Error ? err.message : 'Error verificando transacción');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="w-16 h-16 animate-spin text-blue-500" />;
    
    switch (data?.status) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500" />;
      case 'pending':
        return <Loader2 className="w-16 h-16 animate-spin text-yellow-500" />;
      default:
        return <AlertCircle className="w-16 h-16 text-gray-500" />;
    }
  };

  const getStatusTitle = () => {
    if (isLoading) return 'Verificando Pago...';
    
    switch (data?.status) {
      case 'success':
        return '¡Pago Exitoso!';
      case 'failed':
        return 'Pago No Procesado';
      case 'pending':
        return 'Procesando Pago...';
      default:
        return 'Estado Desconocido';
    }
  };

  const getStatusDescription = () => {
    if (isLoading) return 'Estamos verificando el estado de tu transacción...';
    
    if (data?.statusMessage) return data.statusMessage;

    switch (data?.status) {
      case 'success':
        return 'Tu suscripción ha sido activada exitosamente. Ya puedes disfrutar de todos los beneficios de tu plan.';
      case 'failed':
        return 'No pudimos procesar tu pago. Por favor, verifica tu método de pago e intenta nuevamente.';
      case 'pending':
        return 'Tu pago está siendo procesado. Esto puede tomar unos momentos...';
      default:
        return 'El estado de tu transacción no pudo ser determinado. Por favor, contacta soporte.';
    }
  };

  const getStatusBadge = () => {
    if (!data?.transaction) return null;

    switch (data.status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Rechazado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Procesando</Badge>;
      default:
        return <Badge variant="secondary">{data.transaction.status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl font-bold">
              {getStatusTitle()}
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              {getStatusDescription()}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Detalles de la transacción */}
            {data?.transaction && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">ID de Transacción:</span>
                  <span className="font-mono text-sm">{data.transaction.id}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Estado:</span>
                  {getStatusBadge()}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Monto:</span>
                  <span className="font-semibold text-lg">
                    {data.transaction.amount_formatted}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Método:</span>
                  <span>{data.transaction.payment_method_type}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Fecha:</span>
                  <span className="text-sm">
                    {formatDate(data.transaction.created_at)}
                  </span>
                </div>
              </div>
            )}

            {/* Detalles de la suscripción */}
            {data?.subscription && data.status === 'success' && isSubscriptionActivated(data.subscription) && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">
                  ✅ Suscripción Activada
                </h4>
                <div className="space-y-2 text-sm text-green-700">
                  <p><strong>Plan:</strong> {data.subscription.plan_name}</p>
                  <p><strong>Válida hasta:</strong> {formatDate(data.subscription.period_end)}</p>
                </div>
                <p className="mt-3 text-green-600 text-sm">
                  Serás redirigido al chat en unos segundos...
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            )}

            {/* Indicador de reintento para pendientes o activacion en curso */}
            {(data?.status === 'pending' ||
              (data?.status === 'success' &&
                !!data?.subscription &&
                !isSubscriptionActivated(data.subscription))) && (
              <div className="flex items-center justify-center gap-2 text-yellow-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verificando estado... ({retryCount}/10)</span>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-3 justify-center pt-4">
              {data?.status === 'success' && data?.subscription && isSubscriptionActivated(data.subscription) && (
                <Button asChild className="bg-green-600 hover:bg-green-700">
                  <Link href={`/${locale}`}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Ir al Chat
                  </Link>
                </Button>
              )}
              
              {data?.status === 'failed' && (
                <Button asChild>
                  <Link href="/precios">
                    Intentar Nuevamente
                  </Link>
                </Button>
              )}
              
              <Button asChild variant="outline">
                <Link href="/precios">
                  <Home className="w-4 h-4 mr-2" />
                  Ver Mi Suscripción
                </Link>
              </Button>
            </div>

            {/* Soporte */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t">
              <p>
                Si tienes alguna pregunta sobre tu transacción,{' '}
                <a href="mailto:soporte@asistente-legal.com" className="text-blue-600 hover:underline">
                  contacta nuestro equipo de soporte
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
