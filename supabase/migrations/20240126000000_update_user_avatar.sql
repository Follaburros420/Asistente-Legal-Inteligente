-- Actualizar avatar del usuario j&mabogados@gmail.com para mostrar solo la inicial "J"
-- Eliminar image_url e image_path para que se muestre el AvatarFallback

UPDATE profiles 
SET 
  image_url = NULL,
  image_path = ''
WHERE user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'j&mabogados@gmail.com'
);

-- Verificar que la actualización fue exitosa
SELECT 
  p.username,
  p.display_name,
  p.image_url,
  p.image_path,
  u.email,
  -- Calcular la inicial que se mostrará
  UPPER(LEFT(COALESCE(p.display_name, p.username, 'U'), 1)) as initial_to_show
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'j&mabogados@gmail.com';
