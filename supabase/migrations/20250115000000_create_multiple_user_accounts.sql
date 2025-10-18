-- Crear múltiples cuentas de usuario
-- Contraseña para todas: 123456
-- Emails: integrajuridicaclientes@gmail.com, mariovaron5308@gmail.com, hernandezmarvi7@gmail.com, yurannysaenz@gmail.com, asesoria.mayerli@gmail.com

DO $$
DECLARE
    user_ids UUID[5];
    profile_ids UUID[5];
    workspace_ids UUID[5];
    emails TEXT[5] := ARRAY[
        'integrajuridicaclientes@gmail.com',
        'mariovaron5308@gmail.com', 
        'hernandezmarvi7@gmail.com',
        'yurannysaenz@gmail.com',
        'asesoria.mayerli@gmail.com'
    ];
    i INTEGER;
BEGIN
    -- Generar UUIDs únicos para cada usuario
    FOR i IN 1..5 LOOP
        user_ids[i] := gen_random_uuid();
        profile_ids[i] := gen_random_uuid();
        workspace_ids[i] := gen_random_uuid();
    END LOOP;

    -- Insertar usuarios en auth.users
    FOR i IN 1..5 LOOP
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
            crypt('123456', gen_salt('bf')),
            NOW(),
            NULL,
            '',
            NOW(),
            '',
            NULL,
            '',
            '',
            NULL,
            NOW(),
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
    END LOOP;

    -- Crear perfiles para cada usuario
    FOR i IN 1..5 LOOP
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
            FALSE,
            '',
            '',
            '',
            split_part(emails[i], '@', 1), -- Usar parte antes del @ como display_name
            '',
            '',
            '',
            '',
            '',
            FALSE,
            'user' || substr(replace(user_ids[i]::text, '-', ''), 1, 16)
        );
    END LOOP;

    -- Crear workspace home para cada usuario
    FOR i IN 1..5 LOOP
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
            'gpt-4-turbo-preview',
            'You are a friendly, helpful AI assistant.',
            0.5,
            'Mi espacio de trabajo principal.',
            'openai',
            TRUE,
            TRUE,
            ''
        );
    END LOOP;

    -- Mostrar información de los usuarios creados
    RAISE NOTICE 'Usuarios creados exitosamente:';
    FOR i IN 1..5 LOOP
        RAISE NOTICE 'Email: %, User ID: %', emails[i], user_ids[i];
    END LOOP;

END $$;
