// app/[locale]/onboarding/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  CheckCircle, 
  User, 
  Loader2, 
  ArrowRight,
  CreditCard,
  Sparkles,
  Star,
  Zap,
  X,
  MessageSquare,
  FolderOpen,
  Mic,
  Building2,
  UserPlus,
  GraduationCap,
  Briefcase,
  Percent,
  Gift,
  Shield
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShaderCanvas } from '@/components/shader-canvas';

type OnboardingStep = 'loading' | 'profile_setup' | 'plan_selection' | 'workspace_setup';
type InviteMode = 'email' | 'link';

interface Plan {
  id: string;
  name: string;
  description: string;
  amount_in_cents: number;
  currency: string;
  billing_period: 'monthly' | 'yearly';
  features: string[];
  plan_type?: 'basic' | 'pro' | 'enterprise';
  max_output_tokens_monthly?: number;
  max_processes?: number;
  max_transcription_hours?: number;
  has_multiple_workspaces?: boolean;
  has_processes?: boolean;
  has_transcriptions?: boolean;
}

interface SpecialOffer {
  id: string;
  name: string;
  discount_value: number;
  discount_type: string;
  plan_id: string;
}

// Glass Card Component
function GlassCard({ 
  children, 
  className = "", 
  highlighted = false,
  hoverEffect = true 
}: { 
  children: React.ReactNode;
  className?: string;
  highlighted?: boolean;
  hoverEffect?: boolean;
}) {
  return (
    <div className={`
      relative overflow-hidden rounded-3xl
      ${highlighted 
        ? 'bg-violet-950/40 border border-violet-500/30' 
        : 'bg-white/[0.03] border border-white/[0.08]'
      }
      backdrop-blur-xl shadow-2xl
      ${hoverEffect ? 'transition-all duration-500 hover:border-violet-500/40 hover:bg-white/[0.05] hover:shadow-violet-500/10 hover:-translate-y-1' : ''}
      ${className}
    `}>
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {/* Inner glow for highlighted cards */}
      {highlighted && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
      )}
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('loading');
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  
  // Billing period toggle
  const [isYearly, setIsYearly] = useState(false);
  
  // Profile form data
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone_number: ''
  });

  // Professional workspace setup (post-payment)
  const [organizationName, setOrganizationName] = useState('');
  const [invitees, setInvitees] = useState<Array<{ mode: InviteMode; contact: string; role: 'ADMIN' | 'LAWYER' | 'ASSISTANT' | 'VIEWER' }>>([
    { mode: 'email', contact: '', role: 'LAWYER' }
  ]);
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [createdWorkspace, setCreatedWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [createdInviteLinks, setCreatedInviteLinks] = useState<Array<{ label: string; role: 'ADMIN' | 'LAWYER' | 'ASSISTANT' | 'VIEWER'; url: string }>>([]);

  // Plans and offers
  const [plans, setPlans] = useState<Plan[]>([]);
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  const router = useRouter();
  const [initialized, setInitialized] = useState(false);

  // Check for error params on mount (from failed redirects)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const details = params.get('details');
      
      if (error) {
        const errorMessages: Record<string, string> = {
          'missing_params': 'Parámetros faltantes. Por favor intenta de nuevo.',
          'wompi_config': 'Error de configuración del sistema de pagos.',
          'plan_not_found': 'El plan seleccionado no está disponible.',
          'workspace_not_found': 'No se encontró tu workspace.',
          'user_not_found': 'No se encontró información del usuario.',
          'subscription_create': 'Error al crear la suscripción.',
          'subscription_update': 'Error al actualizar la suscripción.',
          'server_error': 'Error del servidor. Por favor intenta más tarde.'
        };
        
        const errorText = errorMessages[error] || `Error: ${error}`;
        setMessage({ 
          type: 'error', 
          text: details ? `${errorText} (${details})` : errorText 
        });
        
        // Clean URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized) return;
    
    let isMounted = true;
    
    const initializePage = async () => {
      try {
        const supabase = createClient();
        
        // Use getUser() instead of getSession() for secure authentication
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.log('No user found, redirecting to login');
          if (isMounted) {
            window.location.href = '/login';
          }
          return;
        }

        // Check if email is verified (skip for OAuth users)
        if (!user.email_confirmed_at && user.app_metadata?.provider === 'email') {
          if (isMounted) {
            window.location.href = '/auth/verify-email';
          }
          return;
        }

        // Get workspace
        console.log('[Onboarding] Fetching workspace for user:', user.id);
        let { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_home', true)
          .maybeSingle();

        console.log('[Onboarding] Workspace query result:', { workspace, workspaceError });

        // Si no existe el workspace, crearlo
        if (!workspace) {
          console.log('[Onboarding] No workspace found, creating one...');
          const { data: newWorkspace, error: createError } = await supabase
            .from('workspaces')
            .insert({
              user_id: user.id,
              is_home: true,
              name: 'Home',
              default_context_length: 4096,
              default_model: 'gpt-4-turbo-preview',
              default_prompt: 'You are a friendly, helpful AI assistant.',
              default_temperature: 0.5,
              description: 'My home workspace.',
              embeddings_provider: 'openai',
              include_profile_context: true,
              include_workspace_instructions: true,
              instructions: ''
            })
            .select('id')
            .single();

          if (createError) {
            console.error('[Onboarding] Error creating workspace:', createError);
          } else {
            console.log('[Onboarding] Created new workspace:', newWorkspace);
            workspace = newWorkspace;
          }
        }

        if (workspace && isMounted) {
          console.log('[Onboarding] Setting workspaceId to:', workspace.id);
          setWorkspaceId(workspace.id);
        } else {
          console.error('[Onboarding] Failed to get/create workspace!');
        }

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_step, email_verified, onboarding_completed, display_name, first_name, last_name, phone_number, plan_type, has_onboarded')
          .eq('user_id', user.id)
          .maybeSingle();

        // Check if user has active subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id, status, current_period_end')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .maybeSingle();

        // Verificar que la suscripción no haya expirado
        let hasActiveSubscription = false;
        if (subscription) {
          const periodEnd = new Date(subscription.current_period_end);
          const now = new Date();
          hasActiveSubscription = periodEnd > now;
        }

        // Si tiene suscripción activa, marcar onboarding como completado pero NO redirigir automáticamente
        // Esto permite que el usuario navegue libremente si quiere
        if (hasActiveSubscription && workspace) {
          await supabase
            .from('profiles')
            .update({ onboarding_completed: true })
            .eq('user_id', user.id);

          const planType = (profile?.plan_type || 'none') as string;
          const isProfessionalPlan = planType === 'pro' || planType === 'enterprise';

          if (isProfessionalPlan) {
            const { data: nonHomeWorkspace } = await supabase
              .from('workspaces')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_home', false)
              .limit(1)
              .maybeSingle();

            if (!nonHomeWorkspace) {
              setInitialized(true);
              setCurrentStep('workspace_setup');
              setPageLoading(false);
              return;
            }

            window.location.href = `/${nonHomeWorkspace.id}/chat`;
            return;
          }

          window.location.href = `/${workspace.id}/chat`;
          return;
          
          // NO redirigir automáticamente - dejar que el usuario decida
          // Solo continuar cargando la página normalmente
        }

        // Pre-fill profile data if exists
        if (isMounted) {
          setProfileData(prev => ({
            ...prev,
            first_name: (profile?.first_name as string | null) || '',
            last_name: (profile?.last_name as string | null) || '',
            phone_number: (profile?.phone_number as string | null) || ''
          }));
        }

        // Determine which step to show
        const hasProfileInfo = !!(profile?.first_name || profile?.last_name || profile?.phone_number || profile?.has_onboarded)
        if (hasProfileInfo || profile?.onboarding_step === 'plan_selection') {
          window.location.href = '/precios';
          return;
        }

        // Fetch plans
        await fetchPlansAndOffers();

        if (!isMounted) return;

        // Mark as initialized to prevent re-runs
        setInitialized(true);

        setCurrentStep('profile_setup');
        
        setPageLoading(false);
      } catch (error) {
        console.error('Error initializing onboarding:', error);
        if (isMounted) {
          setInitialized(true);
          setPageLoading(false);
          setCurrentStep('profile_setup');
        }
      }
    };

    initializePage();
    
    return () => {
      isMounted = false;
    };
  }, [initialized]);

  const fetchPlansAndOffers = async () => {
    try {
      // Fetch plans
      const plansResponse = await fetch('/api/billing/plans');
      const plansData = await plansResponse.json();
      
      if (plansData.success) {
        setPlans(plansData.data);
      }

      // Fetch special offers
      const offersResponse = await fetch('/api/billing/offers');
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        if (offersData.success) {
          setSpecialOffers(offersData.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const displayName = `${profileData.first_name} ${profileData.last_name}`.trim();

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          phone_number: profileData.phone_number,
          display_name: displayName,
          onboarding_step: 'plan_selection',
          has_onboarded: true
        })
        .eq('user_id', user.id);

      if (error) throw error;

      window.location.href = '/precios';
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al guardar el perfil' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setProcessingPlanId(planId);
    setMessage(null);

    console.log('[Onboarding] handleSubscribe called with planId:', planId);
    console.log('[Onboarding] Current workspaceId state:', workspaceId);

    // Verificar que tenemos workspace_id
    if (!workspaceId) {
      console.error('[Onboarding] No workspace_id available!');
      setMessage({ type: 'error', text: 'No se encontró tu workspace. Por favor recarga la página.' });
      setProcessingPlanId(null);
      return;
    }

    // Use direct navigation to checkout-redirect endpoint
    // This avoids fetch issues and handles the redirect server-side
    const checkoutUrl = `/api/billing/checkout-redirect?plan_id=${encodeURIComponent(planId)}&workspace_id=${encodeURIComponent(workspaceId)}`;
    
    console.log('[Onboarding] Redirecting to checkout endpoint:', checkoutUrl);
    
    // Direct navigation - browser will follow the HTTP redirect to Wompi
    window.location.href = checkoutUrl;
  };

  const addInvitee = () => {
    setInvitees(prev => [...prev, { mode: 'email', contact: '', role: 'VIEWER' }]);
  };

  const removeInvitee = (index: number) => {
    setInvitees(prev => prev.filter((_, i) => i !== index));
  };

  const updateInvitee = (
    index: number,
    patch: Partial<{ mode: InviteMode; contact: string; role: 'ADMIN' | 'LAWYER' | 'ASSISTANT' | 'VIEWER' }>
  ) => {
    setInvitees(prev => prev.map((invitee, i) => (i === index ? { ...invitee, ...patch } : invitee)));
  };

  const copyToClipboard = async (value: string) => {
    if (typeof navigator === 'undefined') return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = value;
        el.setAttribute('readonly', 'true');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
      } catch {
        return false;
      }
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingOrganization(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const trimmedName = organizationName.trim();
      if (!trimmedName) {
        throw new Error('El nombre de la organización es requerido');
      }

      if (!workspaceId) {
        throw new Error('No se encontró tu workspace base');
      }

      const { data: baseWorkspace, error: baseWorkspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (baseWorkspaceError || !baseWorkspace) {
        throw new Error('No se pudo cargar la configuración del workspace');
      }

      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          user_id: user.id,
          is_home: false,
          name: trimmedName,
          default_context_length: baseWorkspace.default_context_length,
          default_model: baseWorkspace.default_model,
          default_prompt: baseWorkspace.default_prompt,
          default_temperature: baseWorkspace.default_temperature,
          description: '',
          embeddings_provider: baseWorkspace.embeddings_provider,
          include_profile_context: baseWorkspace.include_profile_context,
          include_workspace_instructions: baseWorkspace.include_workspace_instructions,
          instructions: baseWorkspace.instructions
        })
        .select('*')
        .single();

      if (createError || !newWorkspace) {
        throw new Error(createError?.message || 'Error creando la organización');
      }

      const normalizedInvitees = invitees.map(inv => ({
        mode: inv.mode,
        contact: inv.contact.trim(),
        role: inv.role
      }));

      const inviteResults = await Promise.allSettled(
        normalizedInvitees
          .filter(inv => (inv.mode === 'link' ? true : inv.contact.length > 0))
          .map(async inv => {
            const response = await fetch(`/api/workspace/${newWorkspace.id}/invitations`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(
                inv.mode === 'link'
                  ? { mode: 'link', role: inv.role, label: inv.contact || undefined }
                  : { contact: inv.contact, role: inv.role }
              )
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({} as any));
              throw new Error(error?.error || 'Error creando invitación');
            }

            const data = await response.json();
            const token = data?.token as string | undefined;
            if (!token) {
              throw new Error('Invitación creada sin token');
            }

            const inviteUrl = `${window.location.origin}/invite/${token}`;
            return {
              label: inv.mode === 'link' ? (inv.contact || 'Enlace') : inv.contact,
              role: inv.role,
              url: inviteUrl
            };
          })
      );

      const successfulInvites = inviteResults
        .filter((r): r is PromiseFulfilledResult<{ label: string; role: 'ADMIN' | 'LAWYER' | 'ASSISTANT' | 'VIEWER'; url: string }> => r.status === 'fulfilled')
        .map(r => r.value);

      const failedCount = inviteResults.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        setMessage({ type: 'error', text: 'Algunas invitaciones no pudieron crearse. Puedes agregarlas luego en Configuración.' });
      }

      await supabase
        .from('profiles')
        .update({ onboarding_completed: true, onboarding_step: 'completed' })
        .eq('user_id', user.id);

      setCreatedWorkspace({ id: newWorkspace.id, name: newWorkspace.name });
      setCreatedInviteLinks(successfulInvites);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error creando la organización' });
    } finally {
      setCreatingOrganization(false);
    }
  };

  // Helper functions for plans
  const formatPrice = (amountInCents: number) => {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amountInCents / 100);
  };

  const currentBillingPeriod = isYearly ? 'yearly' : 'monthly';
  
  const getPlan = (type: 'basic' | 'pro', period: 'monthly' | 'yearly') => {
    return plans.find(p => p.plan_type === type && p.billing_period === period);
  };

  const getOfferForPlan = (planId: string) => {
    return specialOffers.find(o => o.plan_id === planId);
  };

  const professionalPlan = getPlan('pro', currentBillingPeriod);
  const studentPlan = getPlan('basic', currentBillingPeriod);
  const professionalOffer = professionalPlan ? getOfferForPlan(professionalPlan.id) : null;

  const getMonthlyEquivalent = (yearlyAmount: number) => {
    return Math.round(yearlyAmount / 12);
  };

  // Loading state
  if (pageLoading || currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-violet-950/10" />
        
        <div className="text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <ShaderCanvas size={120} shaderId={1} />
            <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full -z-10 animate-pulse" />
          </motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-violet-300/60 font-light mt-6 tracking-wide"
          >
            Cargando...
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Subtle ambient background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-900/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-violet-800/5 rounded-full blur-[120px]" />
      </div>
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <AnimatePresence mode="wait">
            {currentStep === 'profile_setup' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
              >
                {/* Orb */}
                <motion.div 
                  className="flex justify-center mb-8"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="relative">
                    <ShaderCanvas size={140} shaderId={1} />
                    <div className="absolute inset-0 bg-violet-500/30 blur-3xl rounded-full -z-10" />
                  </div>
                </motion.div>

                {/* Welcome Text */}
                <motion.div 
                  className="text-center mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <h1 className="text-2xl md:text-3xl font-light text-white mb-3 tracking-tight">
                    Bienvenido al <span className="text-violet-400 font-normal">Asistente Legal</span>
                  </h1>
                  <p className="text-violet-300/50 font-light">
                    Presente e inteligente
                  </p>
                </motion.div>

                {message && (
                  <Alert className={`mb-6 border ${
                    message.type === 'success' 
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}

                {/* Profile Card */}
                <GlassCard className="p-8" hoverEffect={false}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                      <User className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-white">Crea tu perfil</h2>
                      <p className="text-sm text-violet-300/40">Información para personalizar tu experiencia</p>
                    </div>
                  </div>

                  <form onSubmit={handleProfileSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name" className="text-violet-200/70 text-sm font-light">
                          Nombres
                        </Label>
                        <Input
                          id="first_name"
                          value={profileData.first_name}
                          onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                          placeholder="Nombres"
                          required
                          className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-violet-300/30 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12"
                        />
                      </div>
                  
                      <div>
                        <Label htmlFor="last_name" className="text-violet-200/70 text-sm font-light">
                          Apellidos
                        </Label>
                        <Input
                          id="last_name"
                          value={profileData.last_name}
                          onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                          placeholder="Apellidos"
                          required
                          className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-violet-300/30 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12"
                        />
                      </div>
                    </div>
                  
                    <div>
                      <Label htmlFor="phone_number" className="text-violet-200/70 text-sm font-light">
                        Número de teléfono
                      </Label>
                      <Input
                        id="phone_number"
                        value={profileData.phone_number}
                        onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                        placeholder="Teléfono"
                        required
                        className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-violet-300/30 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12"
                      />
                    </div>
                  
                    <Button
                      type="submit"
                      className="w-full h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 mt-2"
                      disabled={isLoading || !profileData.first_name || !profileData.last_name || !profileData.phone_number}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          Continuar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </GlassCard>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mt-8">
                  <div className="w-8 h-1 rounded-full bg-violet-500" />
                  <div className="w-8 h-1 rounded-full bg-white/10" />
                </div>
              </motion.div>
            )}

            {/* Step 2: Plan Selection */}
            {currentStep === 'plan_selection' && (
              <motion.div
                key="plans"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-5xl px-4"
              >
                {/* Orb */}
                <motion.div 
                  className="flex justify-center mb-6"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="relative">
                    <ShaderCanvas size={100} shaderId={1} />
                    <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full -z-10" />
                  </div>
                </motion.div>

                {/* Welcome Text */}
                <motion.div 
                  className="text-center mb-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <h1 className="text-2xl md:text-3xl font-light text-white mb-3 tracking-tight">
                    Bienvenido al <span className="text-violet-400 font-normal">Asistente Legal</span>
                  </h1>
                  <p className="text-violet-300/50 font-light">
                    Presente e inteligente
                  </p>
                  <p className="text-white/60 mt-4 font-light">
                    Selecciona el plan que mejor se ajuste a ti
                  </p>
                </motion.div>

                {message && (
                  <Alert className={`mb-6 max-w-md mx-auto border ${
                    message.type === 'success' 
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}

                {/* Billing Period Toggle */}
                <motion.div 
                  className="flex items-center justify-center gap-4 mb-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className={`text-sm font-light transition-colors ${!isYearly ? 'text-white' : 'text-white/40'}`}>
                    Mensual
                  </span>
                  <Switch
                    checked={isYearly}
                    onCheckedChange={setIsYearly}
                    className="data-[state=checked]:bg-violet-600"
                  />
                  <span className={`text-sm font-light transition-colors flex items-center gap-2 ${isYearly ? 'text-white' : 'text-white/40'}`}>
                    Anual
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-xs font-light">
                      30% OFF
                    </Badge>
                  </span>
                </motion.div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {/* Professional Plan */}
                  {professionalPlan && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <GlassCard highlighted className="h-full relative">
                        {/* Recommended Badge */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-violet-600 text-white px-4 py-1 text-xs font-light border-0 shadow-lg shadow-violet-500/30">
                            <Star className="w-3 h-3 mr-1.5 fill-current" />
                            Recomendado
                          </Badge>
                        </div>

                        {/* First Month Offer Badge */}
                        {!isYearly && professionalOffer && (
                          <div className="absolute top-4 right-4 z-10">
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1 text-xs font-light">
                              <Gift className="w-3 h-3 mr-1" />
                              1er mes $0.99 USD
                            </Badge>
                          </div>
                        )}

                        <div className="p-8 pt-10">
                          {/* Icon & Title */}
                          <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                              <Briefcase className="w-6 h-6 text-violet-400" />
                            </div>
                            <div>
                              <h3 className="text-xl font-medium text-white">{professionalPlan.name}</h3>
                              <p className="text-sm text-violet-300/50 font-light">{professionalPlan.description}</p>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="mb-6">
                            {!isYearly && professionalOffer ? (
                              <div>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-4xl font-light text-white">$3.960</span>
                                  <span className="text-lg text-white/30 line-through font-light">${formatPrice(professionalPlan.amount_in_cents)}</span>
                                </div>
                                <p className="text-sm text-emerald-400/80 font-light mt-1">COP primer mes</p>
                                <p className="text-xs text-white/30 font-light">Luego ${formatPrice(professionalPlan.amount_in_cents)} COP/mes</p>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-4xl font-light text-white">${formatPrice(professionalPlan.amount_in_cents)}</span>
                                  <span className="text-white/40 font-light">COP</span>
                                </div>
                                <p className="text-sm text-white/40 font-light">/ {isYearly ? 'año' : 'mes'}</p>
                                {isYearly && (
                                  <p className="text-xs text-violet-400/80 font-light mt-1">
                                    Equivale a ${formatPrice(getMonthlyEquivalent(professionalPlan.amount_in_cents))} COP/mes
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Highlights Grid */}
                          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-6">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-violet-400" />
                              <div>
                                <p className="text-[10px] uppercase text-white/30 tracking-wider">Chat IA</p>
                                <p className="text-sm font-medium text-white">Ilimitado</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-violet-400" />
                              <div>
                                <p className="text-[10px] uppercase text-white/30 tracking-wider">Workspaces</p>
                                <p className="text-sm font-medium text-white">Múltiples</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="w-4 h-4 text-violet-400" />
                              <div>
                                <p className="text-[10px] uppercase text-white/30 tracking-wider">Procesos</p>
                                <p className="text-sm font-medium text-white">7</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mic className="w-4 h-4 text-violet-400" />
                              <div>
                                <p className="text-[10px] uppercase text-white/30 tracking-wider">Transcripción</p>
                                <p className="text-sm font-medium text-white">5 horas</p>
                              </div>
                            </div>
                          </div>

                          {/* Features List */}
                          <ul className="space-y-3 mb-8">
                            {[
                              'Chat con asistente legal IA ilimitado',
                              'Análisis de normativa colombiana',
                              'Múltiples espacios de trabajo',
                              '7 procesos legales incluidos',
                              '5 horas de transcripción de audio',
                              'Soporte prioritario 24/7'
                            ].map((feature, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-white/70 font-light">{feature}</span>
                              </li>
                            ))}
                          </ul>

                          {/* CTA Button */}
                          <Button
                            onClick={() => handleSubscribe(professionalPlan.id)}
                            disabled={processingPlanId !== null}
                            className="w-full h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                          >
                            {processingPlanId === professionalPlan.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Procesando...
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 mr-2" />
                                {!isYearly && professionalOffer ? 'Comenzar por $0.99 USD' : 'Elegir Plan Profesional'}
                              </>
                            )}
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* Student Plan */}
                  {studentPlan && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <GlassCard className="h-full">
                        <div className="p-8">
                          {/* Icon & Title */}
                          <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/[0.08]">
                              <GraduationCap className="w-6 h-6 text-white/60" />
                            </div>
                            <div>
                              <h3 className="text-xl font-medium text-white">{studentPlan.name}</h3>
                              <p className="text-sm text-white/40 font-light">{studentPlan.description}</p>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="mb-6">
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-light text-white">${formatPrice(studentPlan.amount_in_cents)}</span>
                              <span className="text-white/40 font-light">COP</span>
                            </div>
                            <p className="text-sm text-white/40 font-light">/ {isYearly ? 'año' : 'mes'}</p>
                            {isYearly && (
                              <p className="text-xs text-violet-400/80 font-light mt-1">
                                Equivale a ${formatPrice(getMonthlyEquivalent(studentPlan.amount_in_cents))} COP/mes
                              </p>
                            )}
                          </div>

                          {/* Highlights Grid */}
                          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-6">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-white/40" />
                              <div>
                                <p className="text-[10px] uppercase text-white/20 tracking-wider">Chat IA</p>
                                <p className="text-sm font-medium text-white/70">3M tokens</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-white/20" />
                              <div>
                                <p className="text-[10px] uppercase text-white/20 tracking-wider">Workspace</p>
                                <p className="text-sm font-medium text-white/70">1</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="w-4 h-4 text-white/20" />
                              <div>
                                <p className="text-[10px] uppercase text-white/20 tracking-wider">Procesos</p>
                                <p className="text-sm font-medium text-white/30">â€”</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mic className="w-4 h-4 text-white/20" />
                              <div>
                                <p className="text-[10px] uppercase text-white/20 tracking-wider">Transcripción</p>
                                <p className="text-sm font-medium text-white/30">â€”</p>
                              </div>
                            </div>
                          </div>

                          {/* Features List */}
                          <ul className="space-y-3 mb-8">
                            {[
                              { text: 'Chat con asistente legal IA', included: true },
                              { text: 'Hasta 3 millones de tokens/mes', included: true },
                              { text: 'Análisis de normativa colombiana', included: true },
                              { text: 'Búsqueda de jurisprudencia', included: true },
                              { text: 'Procesos legales', included: false },
                              { text: 'Transcripción de audio', included: false }
                            ].map((feature, i) => (
                              <li key={i} className="flex items-start gap-3">
                                {feature.included ? (
                                  <CheckCircle className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <X className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" />
                                )}
                                <span className={`text-sm font-light ${feature.included ? 'text-white/60' : 'text-white/30 line-through'}`}>
                                  {feature.text}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {/* CTA Button */}
                          <Button
                            onClick={() => handleSubscribe(studentPlan.id)}
                            disabled={processingPlanId !== null}
                            variant="outline"
                            className="w-full h-12 bg-transparent border-white/10 text-white/70 hover:bg-white/5 hover:border-white/20 hover:text-white rounded-xl font-medium transition-all duration-300"
                          >
                            {processingPlanId === studentPlan.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Procesando...
                              </>
                            ) : (
                              'Elegir Plan Estudiantil'
                            )}
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}
                </div>

                {/* Trust badges */}
                <motion.div 
                  className="flex flex-wrap justify-center gap-6 text-xs text-white/30 mt-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-violet-400/50" />
                    <span className="font-light">Pago seguro con Wompi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-violet-400/50" />
                    <span className="font-light">Cancela cuando quieras</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-violet-400/50" />
                    <span className="font-light">Soporte en español</span>
                  </div>
                </motion.div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mt-10">
                  <div className="w-8 h-1 rounded-full bg-violet-500/50" />
                  <div className="w-8 h-1 rounded-full bg-violet-500" />
                </div>
              </motion.div>
            )}

            {/* Step 3: Professional Workspace Setup (post-payment) */}
            {currentStep === 'workspace_setup' && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl px-4"
              >
                {/* Orb */}
                <motion.div
                  className="flex justify-center mb-8"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="relative">
                    <ShaderCanvas size={120} shaderId={1} />
                    <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full -z-10" />
                  </div>
                </motion.div>

                <motion.div
                  className="text-center mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <h1 className="text-2xl md:text-3xl font-light text-white mb-3 tracking-tight">
                    Crea una nueva <span className="text-violet-400 font-normal">organización</span>
                  </h1>
                  <p className="text-white/60 font-light">
                    Empieza con una nueva organización e invita a tus compañeros.
                  </p>
                </motion.div>

                {message && (
                  <Alert className={`mb-6 border ${
                    message.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}

                <GlassCard className="p-8" hoverEffect={false}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                      <Building2 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-white">Crea una nueva organización</h2>
                      <p className="text-sm text-violet-300/40">Nombre e invitaciones</p>
                    </div>
                  </div>

                  {createdWorkspace ? (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="text-sm text-white/80">
                          Workspace creado:{" "}
                          <span className="font-medium text-white">{createdWorkspace.name}</span>
                        </div>
                        <div className="text-xs text-white/40 mt-1">
                          Comparte los enlaces de invitación para que otros puedan unirse.
                        </div>
                      </div>

                      {createdInviteLinks.length === 0 ? (
                        <div className="text-sm text-white/60 font-light">
                          No creaste invitaciones. Puedes agregarlas luego en Configuración.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {createdInviteLinks.map((inv, idx) => (
                            <div
                              key={`${inv.url}-${idx}`}
                              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm text-white/80 truncate">
                                    {inv.label} <span className="text-white/40">({inv.role})</span>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-xl border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/20"
                                  onClick={async () => {
                                    const ok = await copyToClipboard(inv.url);
                                    setMessage(ok
                                      ? { type: 'success', text: 'Enlace copiado al portapapeles.' }
                                      : { type: 'error', text: 'No se pudo copiar el enlace.' });
                                  }}
                                >
                                  Copiar
                                </Button>
                              </div>
                              <Input
                                value={inv.url}
                                readOnly
                                className="bg-white/[0.02] border-white/[0.08] text-white/70 rounded-xl h-11"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-xl border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/20"
                          disabled={createdInviteLinks.length === 0}
                          onClick={async () => {
                            const ok = await copyToClipboard(createdInviteLinks.map(i => i.url).join('\\n'));
                            setMessage(ok
                              ? { type: 'success', text: 'Todos los enlaces fueron copiados.' }
                              : { type: 'error', text: 'No se pudieron copiar los enlaces.' });
                          }}
                        >
                          Copiar todos
                        </Button>
                        <Button
                          type="button"
                          className="h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                          onClick={() => {
                            window.location.href = `/${createdWorkspace.id}/chat`;
                          }}
                        >
                          Entrar al workspace
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateOrganization} className="space-y-6">
                    <div>
                      <Label htmlFor="organization_name" className="text-violet-200/70 text-sm font-light">
                        Organización
                      </Label>
                      <Input
                        id="organization_name"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Oficina 1"
                        required
                        className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-violet-300/30 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70 font-light">Invitar personas</div>
                        <button
                          type="button"
                          onClick={addInvitee}
                          className="inline-flex items-center gap-2 text-sm text-violet-300/80 hover:text-violet-200 transition"
                        >
                          <UserPlus className="w-4 h-4" />
                          Añadir
                        </button>
                      </div>

                      <div className="space-y-3">
                        {invitees.map((inv, index) => (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_160px_36px] gap-3 items-end">
                            <div>
                              <Label className="text-violet-200/70 text-xs font-light">
                                Modo
                              </Label>
                              <select
                                value={inv.mode}
                                onChange={(e) => updateInvitee(index, { mode: e.target.value as InviteMode })}
                                className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] text-white focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12 px-3 text-sm"
                              >
                                <option value="email">Correo</option>
                                <option value="link">Enlace</option>
                              </select>
                            </div>

                            <div>
                              <Label className="text-violet-200/70 text-xs font-light">
                                Correo o teléfono
                              </Label>
                              <Input
                                value={inv.contact}
                                onChange={(e) => updateInvitee(index, { contact: e.target.value })}
                                placeholder={inv.mode === 'link' ? 'Etiqueta (opcional)' : 'correo@ejemplo.com'}
                                className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-violet-300/30 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12"
                              />
                            </div>

                            <div>
                              <Label className="text-violet-200/70 text-xs font-light">
                                Rol
                              </Label>
                              <select
                                value={inv.role}
                                onChange={(e) => updateInvitee(index, { role: e.target.value as any })}
                                className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] text-white focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl h-12 px-3 text-sm"
                              >
                                <option value="ADMIN">Administrador</option>
                                <option value="LAWYER">Abogado</option>
                                <option value="ASSISTANT">Asistente</option>
                                <option value="VIEWER">Lector</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeInvitee(index)}
                              className="h-12 w-12 inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06] transition"
                              aria-label="Eliminar"
                              disabled={invitees.length <= 1}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                      disabled={creatingOrganization || !organizationName.trim()}
                    >
                      {creatingOrganization ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Siguiente'
                      )}
                    </Button>
                    </form>
                  )}
                </GlassCard>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mt-8">
                  <div className="w-8 h-1 rounded-full bg-violet-500/50" />
                  <div className="w-8 h-1 rounded-full bg-violet-500/50" />
                  <div className="w-8 h-1 rounded-full bg-violet-500" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}


