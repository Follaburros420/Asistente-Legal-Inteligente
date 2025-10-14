-- Crear cuenta para Mariana Angarita
-- Email: mariana-angarita@hotmail.com
-- Contraseña: 123456

-- Generar UUID único para el usuario
DO $$
DECLARE
    user_id UUID := gen_random_uuid();
    profile_id UUID := gen_random_uuid();
    workspace_id UUID := gen_random_uuid();
BEGIN
    -- Insertar usuario en auth.users
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
        user_id,
        'authenticated',
        'authenticated',
        'mariana-angarita@hotmail.com',
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

    -- Crear perfil para Mariana Angarita
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
        user_id,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        FALSE,
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        '',
        '',
        'Mariana Angarita',
        'Abogada especializada en derecho corporativo y asesoría legal integral',
        '',
        '',
        '',
        'Soy Mariana Angarita, abogada especializada en derecho corporativo y asesoría legal integral. Mi experiencia se centra en brindar soluciones jurídicas efectivas a empresas y particulares.',
        FALSE,
        'mariana-angarita'
    );

    -- Crear workspace home para Mariana Angarita
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
        user_id,
        TRUE,
        'Home',
        4096,
        'gpt-4-1106-preview',
        'Eres un asistente legal inteligente especializado en derecho colombiano. Proporcionas asesoría jurídica precisa, análisis de casos y orientación legal profesional.',
        0.5,
        'Mi espacio de trabajo principal para asesoría legal.',
        'openai',
        TRUE,
        TRUE,
        'Como asistente legal, debes proporcionar información jurídica precisa basada en la legislación colombiana. Siempre recomienda consultar con un abogado para casos específicos.'
    );

    -- Mostrar información de la cuenta creada
    RAISE NOTICE 'Cuenta creada exitosamente para Mariana Angarita';
    RAISE NOTICE 'Email: mariana-angarita@hotmail.com';
    RAISE NOTICE 'Contraseña: 123456';
    RAISE NOTICE 'User ID: %', user_id;
    RAISE NOTICE 'Profile ID: %', profile_id;
    RAISE NOTICE 'Workspace ID: %', workspace_id;
END $$;



