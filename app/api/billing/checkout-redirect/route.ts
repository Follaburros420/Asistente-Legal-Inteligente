// app/api/billing/checkout-redirect/route.ts
// Endpoint que redirige directamente a Wompi Web Checkout
// Usa HTTP redirect en lugar de JSON response para evitar problemas de fetch

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { generateIntegritySignature, generateTransactionReference } from '@/lib/wompi/utils';
import { validateWompiConfig, getWompiCheckoutUrl, wompiConfig, getWompiConfigStatus } from '@/lib/wompi/config';
import { getSessionUser } from '@/lib/server/auth/session';
import { assertWorkspaceAccess } from '@/lib/server/workspaces/access';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper to get error redirect URL
// /precios is the canonical pricing surface
function getErrorRedirectUrl(req: NextRequest, error: string, details?: string): URL {
  const redirectPath = '/precios';

  const url = new URL(redirectPath, req.nextUrl.origin);
  url.searchParams.set('error', error);
  if (details) {
    url.searchParams.set('details', details);
  }
  return url;
}

function calculatePeriodEnd(billingPeriod: string, startDate: Date = new Date()): Date {
  const endDate = new Date(startDate);
  if (billingPeriod === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
}

// Get applicable special offer for a plan (first month discount)
async function getSpecialOffer(planId: string, workspaceId: string) {
  const supabase = getSupabaseServer();
  console.log('[Checkout Redirect] Checking special offer for plan:', planId, 'workspace:', workspaceId);

  // Check if user has had any previous subscriptions (active, canceled, or expired)
  const { count: prevSubCount, error: subError } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'canceled', 'expired']);

  console.log('[Checkout Redirect] Previous subscriptions count:', prevSubCount, subError?.message);

  // Only apply first month offers if user has no previous subscriptions
  if (prevSubCount && prevSubCount > 0) {
    console.log('[Checkout Redirect] User has previous subscriptions, no special offer');
    return null;
  }

  // Get active special offer for this plan
  // Using simpler query without .or() to avoid syntax issues
  const now = new Date().toISOString();
  console.log('[Checkout Redirect] Querying special offers for plan_id:', planId, 'at:', now);

  const { data: offers, error } = await supabase
    .from('special_offers')
    .select('*')
    .eq('plan_id', planId)
    .eq('is_active', true)
    .eq('applies_to', 'first_month')
    .lte('valid_from', now);

  if (error) {
    console.log('[Checkout Redirect] Error querying special offers:', error.message);
    return null;
  }

  console.log('[Checkout Redirect] Found offers:', offers?.length);

  // Filter by valid_until manually (null means no expiration)
  const validOffer = offers?.find(offer => {
    if (!offer.valid_until) return true; // No expiration
    return new Date(offer.valid_until) > new Date();
  });

  if (!validOffer) {
    console.log('[Checkout Redirect] No valid special offer found');
    return null;
  }

  console.log('[Checkout Redirect] Special offer found:', validOffer.name, 'discount_type:', validOffer.discount_type, 'discount_value:', validOffer.discount_value);
  return validOffer;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  console.log('[Checkout Redirect] ========== START ==========');

  // Get base URL for redirects
  const baseUrl = req.nextUrl.origin;
  console.log('[Checkout Redirect] Base URL:', baseUrl);

  try {
    const { searchParams } = new URL(req.url);
    const plan_id = searchParams.get('plan_id');
    const workspace_id = searchParams.get('workspace_id');

    console.log('[Checkout Redirect] Params:', { plan_id, workspace_id });

    // Validate params
    if (!plan_id || !workspace_id) {
      console.error('[Checkout Redirect] Missing params');
      return NextResponse.redirect(getErrorRedirectUrl(req, 'missing_params'));
    }

    // Validate Wompi config
    console.log('[Checkout Redirect] Wompi config status:', getWompiConfigStatus());
    const validation = validateWompiConfig();
    if (!validation.isValid) {
      console.error('[Checkout Redirect] Wompi config invalid:', validation.missingFields);
      return NextResponse.redirect(getErrorRedirectUrl(req, 'wompi_config', validation.missingFields.join(',')));
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
    }

    const access = await assertWorkspaceAccess(supabase, workspace_id, user.id).catch(() => null);
    if (!access || access.role !== "ADMIN") {
      return NextResponse.redirect(getErrorRedirectUrl(req, 'forbidden'));
    }

    // Get plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      console.error('[Checkout Redirect] Plan not found:', planError);
      return NextResponse.redirect(getErrorRedirectUrl(req, 'plan_not_found'));
    }
    console.log('[Checkout Redirect] Plan:', plan.name, 'Amount:', plan.amount_in_cents);

    // Get workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error('[Checkout Redirect] Workspace not found:', workspaceError);
      return NextResponse.redirect(getErrorRedirectUrl(req, 'workspace_not_found'));
    }
    console.log('[Checkout Redirect] Workspace user:', workspace.user_id);

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', workspace.user_id)
      .single();

    // Get user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(workspace.user_id);

    if (userError || !userData.user?.email) {
      console.error('[Checkout Redirect] User email not found:', userError);
      return NextResponse.redirect(getErrorRedirectUrl(req, 'user_not_found'));
    }
    console.log('[Checkout Redirect] User email:', userData.user.email);

    // Generate reference
    const wompiReference = generateTransactionReference('SUB');
    const now = new Date();
    const periodEnd = calculatePeriodEnd(plan.billing_period, now);

    // Determine amount to charge (check for special offers on monthly plans)
    let amountToCharge = plan.amount_in_cents;
    let specialOffer = null;
    let isFirstMonth = false;

    if (plan.billing_period === 'monthly') {
      specialOffer = await getSpecialOffer(plan_id, workspace_id);

      if (specialOffer) {
        if (specialOffer.discount_type === 'fixed_price') {
          // Fixed price - charge exactly this amount (e.g., $0.99 USD = 3960 COP centavos)
          amountToCharge = specialOffer.discount_value;
          isFirstMonth = true;
          console.log('[Checkout Redirect] Applied fixed_price offer:', amountToCharge, 'centavos');
        } else if (specialOffer.discount_type === 'fixed_amount') {
          // Fixed amount discount - subtract from original price
          amountToCharge = Math.max(0, plan.amount_in_cents - specialOffer.discount_value);
          isFirstMonth = true;
          console.log('[Checkout Redirect] Applied fixed_amount discount:', specialOffer.discount_value, 'final:', amountToCharge);
        } else if (specialOffer.discount_type === 'percentage') {
          // Percentage discount
          amountToCharge = Math.round(plan.amount_in_cents * (1 - specialOffer.discount_value / 100));
          isFirstMonth = true;
          console.log('[Checkout Redirect] Applied percentage offer:', specialOffer.discount_value + '%');
        }
      }
    }

    console.log('[Checkout Redirect] Amount to charge:', amountToCharge, isFirstMonth ? '(FIRST MONTH SPECIAL)' : '(regular price)');

    // Check for existing pending subscription
    const { data: pendingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let subscription;

    if (!pendingSubscription) {
      const { data: newSubscription, error: createSubError } = await supabase
        .from('subscriptions')
        .insert({
          workspace_id,
          user_id: workspace.user_id,
          plan_id,
          status: 'pending',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          wompi_reference: wompiReference,
          cancel_at_period_end: false,
          billing_day: now.getDate()
        })
        .select()
        .single();

      if (createSubError) {
        console.error('[Checkout Redirect] Error creating subscription:', createSubError);
        return NextResponse.redirect(getErrorRedirectUrl(req, 'subscription_create', createSubError.message));
      }
      subscription = newSubscription;
      console.log('[Checkout Redirect] Created new subscription:', subscription.id);
    } else {
      const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id,
          wompi_reference: wompiReference,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', pendingSubscription.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Checkout Redirect] Error updating subscription:', updateError);
        return NextResponse.redirect(getErrorRedirectUrl(req, 'subscription_update', updateError.message));
      }
      subscription = updatedSub;
      console.log('[Checkout Redirect] Updated existing subscription:', subscription.id);
    }

    // Create invoice (without special offer columns that may not exist)
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('reference', wompiReference)
      .single();

    if (!existingInvoice) {
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          subscription_id: subscription.id,
          workspace_id,
          plan_id,
          amount_in_cents: amountToCharge,
          currency: 'COP',
          status: 'pending',
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          reference: wompiReference,
          attempt_count: 0
        });

      if (invoiceError) {
        console.error('[Checkout Redirect] Error creating invoice:', invoiceError);
      } else {
        console.log('[Checkout Redirect] Invoice created with amount:', amountToCharge, isFirstMonth ? '(first month special)' : '');
      }
    }

    // Generate integrity signature
    const signature = generateIntegritySignature({
      reference: wompiReference,
      amount_in_cents: amountToCharge,
      currency: 'COP'
    });

    // Build redirect URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aliado.pro';
    const redirectUrl = `${appUrl}/billing/success`;

    // Build Wompi checkout URL with all params
    // Note: Wompi uses custom parameter names with colons, which need special handling
    const checkoutBaseUrl = getWompiCheckoutUrl();

    // Build query string manually to preserve colons in parameter names
    // URLSearchParams would URL-encode the colons which breaks Wompi's parsing
    const queryParams = [
      `public-key=${encodeURIComponent(wompiConfig.publicKey)}`,
      `currency=COP`,
      `amount-in-cents=${amountToCharge}`,
      `reference=${encodeURIComponent(wompiReference)}`,
      `signature:integrity=${encodeURIComponent(signature)}`,
      `redirect-url=${encodeURIComponent(redirectUrl)}`,
      `customer-data:email=${encodeURIComponent(userData.user.email)}`,
      `customer-data:full-name=${encodeURIComponent(profile?.display_name || 'Usuario')}`,
      `customer-data:legal-id-type=CC`,
      `collect-customer-legal-id=true`
    ].join('&');

    const fullCheckoutUrl = `${checkoutBaseUrl}?${queryParams}`;

    console.log('[Checkout Redirect] SUCCESS! Redirecting to Wompi');
    console.log('[Checkout Redirect] Checkout URL:', fullCheckoutUrl);
    console.log('[Checkout Redirect] Reference:', wompiReference);
    console.log('[Checkout Redirect] Amount to charge:', amountToCharge, 'centavos COP');
    console.log('[Checkout Redirect] Original plan price:', plan.amount_in_cents, 'centavos COP');
    console.log('[Checkout Redirect] Special offer applied:', isFirstMonth ? `YES - ${specialOffer?.name}` : 'NO');
    console.log('[Checkout Redirect] Public Key present:', !!wompiConfig.publicKey, 'length:', wompiConfig.publicKey?.length || 0);
    console.log('[Checkout Redirect] ========== END ==========');

    // HTTP Redirect to Wompi
    return NextResponse.redirect(fullCheckoutUrl);

  } catch (error) {
    console.error('[Checkout Redirect] FATAL ERROR:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Use the helper function to determine correct redirect path
    return NextResponse.redirect(getErrorRedirectUrl(req, 'server_error', errorMessage.substring(0, 100)));
  }
}
