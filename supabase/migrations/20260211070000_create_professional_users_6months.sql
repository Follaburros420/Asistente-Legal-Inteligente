-- Migration: Create 5 professional users with 6-month subscription
-- Created: 2026-02-11
-- Description: Create users with professional plan active for 6 months

DO $$
DECLARE
    user_ids UUID[5];
    workspace_ids UUID[5];
    professional_plan_id UUID;
    emails TEXT[5] := ARRAY[
        'legal@dikaiosgroup.com',
        'derecho704@hotmail.com',
        'hsepulvedapatino@yahoo.es',
        'fhg8@hotmail.com',
        'dixonjafeth@gmail.com'
    ];
    display_names TEXT[5] := ARRAY[
        'Dikaios Legal',
        'Usuario Derecho704',
        'H. Sepulveda Patino',
        'Usuario FHG8',
        'Dixon Jafeth'
    ];
    i INTEGER;
BEGIN
    -- Find professional plan (plan_type = 'pro' or name contains 'PRO' or 'Profesional')
    SELECT id INTO professional_plan_id
    FROM plans
    WHERE (plan_type = 'pro' OR name ILIKE '%pro%' OR name ILIKE '%profesional%')
      AND is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;

    IF professional_plan_id IS NULL THEN
        RAISE EXCEPTION 'Professional plan not found in database';
    END IF;

    RAISE NOTICE 'Professional plan found: %', professional_plan_id;

    -- Generate UUIDs for each user
    FOR i IN 1..5 LOOP
        user_ids[i] := gen_random_uuid();
        workspace_ids[i] := gen_random_uuid();
    END LOOP;

    -- Insert users in auth.users
    FOR i IN 1..5 LOOP
        -- Check if user already exists
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = emails[i]) THEN
            RAISE NOTICE 'User with email % already exists, skipping...', emails[i];
            -- Get existing user ID
            SELECT id INTO user_ids[i] FROM auth.users WHERE email = emails[i];
        ELSE
            INSERT INTO auth.users (
                instance_id, 
                id, 
                aud, 
                role, 
                email, 
                encrypted_password, 
                email_confirmed_at, 
                invited_at, 
                confirmation_token, 
                confirmation_sent_at, 
                recovery_token, 
                recovery_sent_at, 
                email_change_token_new, 
                email_change, 
                email_change_sent_at, 
                last_sign_in_at, 
                raw_app_meta_data, 
                raw_user_meta_data, 
                is_super_admin, 
                created_at, 
                updated_at, 
                phone, 
                phone_confirmed_at, 
                phone_change, 
                phone_change_token, 
                phone_change_sent_at, 
                email_change_token_current, 
                email_change_confirm_status, 
                banned_until, 
                reauthentication_token, 
                reauthentication_sent_at, 
                is_sso_user
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                user_ids[i],
                'authenticated',
                'authenticated',
                emails[i],
                crypt('TempPass2026!', gen_salt('bf')),
                NOW(),
                NULL,
                '',
                NOW(),
                '',
                NULL,
                '',
                '',
                NULL,
                NULL,
                '{"provider": "email", "providers": ["email"]}',
                '{}',
                NULL,
                NOW(),
                NOW(),
                NULL,
                NULL,
                '',
                '',
                NULL,
                '',
                0,
                NULL,
                '',
                NULL,
                'f'
            );
            RAISE NOTICE 'Created user: %', emails[i];
        END IF;
    END LOOP;

    -- Create/update profiles for each user
    FOR i IN 1..5 LOOP
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = user_ids[i]) THEN
            RAISE NOTICE 'Profile for % already exists, updating...', emails[i];
            UPDATE public.profiles
            SET 
                display_name = display_names[i],
                has_onboarded = TRUE,
                updated_at = NOW()
            WHERE user_id = user_ids[i];
        ELSE
            INSERT INTO public.profiles (
                user_id,
                anthropic_api_key,
                azure_openai_35_turbo_id,
                azure_openai_45_turbo_id,
                azure_openai_45_vision_id,
                azure_openai_api_key,
                azure_openai_endpoint,
                google_gemini_api_key,
                has_onboarded,
                image_url,
                image_path,
                mistral_api_key,
                display_name,
                bio,
                openai_api_key,
                openai_organization_id,
                perplexity_api_key,
                profile_context,
                use_azure_openai,
                username
            ) VALUES (
                user_ids[i],
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                TRUE,
                '',
                '',
                '',
                display_names[i],
                'Usuario profesional de ALI - Asistente Legal Inteligente',
                '',
                '',
                '',
                '',
                FALSE,
                split_part(emails[i], '@', 1)
            );
            RAISE NOTICE 'Created profile for: %', emails[i];
        END IF;
    END LOOP;

    -- Create workspaces for each user (if not exists)
    FOR i IN 1..5 LOOP
        IF EXISTS (
            SELECT 1 FROM public.workspaces 
            WHERE user_id = user_ids[i] AND is_home = TRUE
        ) THEN
            RAISE NOTICE 'Home workspace for % already exists', emails[i];
            -- Get existing workspace ID
            SELECT id INTO workspace_ids[i] 
            FROM public.workspaces 
            WHERE user_id = user_ids[i] AND is_home = TRUE
            LIMIT 1;
        ELSE
            INSERT INTO public.workspaces (
                user_id,
                is_home,
                name,
                default_context_length,
                default_model,
                default_prompt,
                default_temperature,
                description,
                embeddings_provider,
                include_profile_context,
                include_workspace_instructions,
                instructions
            ) VALUES (
                user_ids[i],
                TRUE,
                'Home',
                4096,
                'google/gemini-3-pro-preview',
                'Eres ALI, un asistente de investigación jurídica especializado en derecho colombiano. Proporcionas información legal precisa, análisis de casos y orientación basada en fuentes oficiales.',
                0.5,
                'Espacio de trabajo profesional para investigación jurídica.',
                'openai',
                TRUE,
                TRUE,
                'Como asistente legal especializado en derecho colombiano, proporciona información precisa basada en la legislación vigente, jurisprudencia de altas cortes y fuentes oficiales. Siempre verifica la vigencia de las normas y cita las fuentes consultadas.'
            )
            RETURNING id INTO workspace_ids[i];
            RAISE NOTICE 'Created workspace for: %', emails[i];
        END IF;
    END LOOP;

    -- Create subscriptions for each user (6 months professional plan)
    FOR i IN 1..5 LOOP
        IF EXISTS (
            SELECT 1 FROM public.subscriptions 
            WHERE user_id = user_ids[i] 
            AND status IN ('active', 'trialing')
        ) THEN
            RAISE NOTICE 'Active subscription for % already exists, extending...', emails[i];
            -- Update existing subscription to professional plan with 6 months
            UPDATE public.subscriptions
            SET 
                plan_id = professional_plan_id,
                status = 'active',
                current_period_start = NOW(),
                current_period_end = NOW() + INTERVAL '6 months',
                cancel_at_period_end = FALSE,
                updated_at = NOW()
            WHERE user_id = user_ids[i]
            AND status IN ('active', 'trialing', 'past_due');
        ELSE
            INSERT INTO public.subscriptions (
                user_id,
                workspace_id,
                plan_id,
                status,
                current_period_start,
                current_period_end,
                cancel_at_period_end,
                metadata
            ) VALUES (
                user_ids[i],
                workspace_ids[i],
                professional_plan_id,
                'active',
                NOW(),
                NOW() + INTERVAL '6 months',
                FALSE,
                jsonb_build_object(
                    'created_by', 'migration_script',
                    'created_at', NOW(),
                    'plan_duration_months', 6,
                    'is_promotional', TRUE
                )
            );
            RAISE NOTICE 'Created 6-month professional subscription for: %', emails[i];
        END IF;
    END LOOP;

    -- Output summary
    RAISE NOTICE '========================================';
    RAISE NOTICE 'USERS CREATED/UPDATED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    FOR i IN 1..5 LOOP
        RAISE NOTICE 'Email: %', emails[i];
        RAISE NOTICE 'Display Name: %', display_names[i];
        RAISE NOTICE 'User ID: %', user_ids[i];
        RAISE NOTICE 'Workspace ID: %', workspace_ids[i];
        RAISE NOTICE 'Plan: Professional (6 months)';
        RAISE NOTICE 'Period End: %', NOW() + INTERVAL '6 months';
        RAISE NOTICE '----------------------------------------';
    END LOOP;
    RAISE NOTICE 'Temporary password for all users: TempPass2026!';
    RAISE NOTICE '========================================';

END $$;
