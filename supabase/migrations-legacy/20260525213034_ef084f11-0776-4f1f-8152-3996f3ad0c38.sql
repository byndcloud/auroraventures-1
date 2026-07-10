ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET role = 'admin' WHERE user_id = '9b4fc593-f8ba-4111-85c0-804b4067927b';
ALTER TABLE public.profiles ENABLE TRIGGER USER;

UPDATE public.user_roles SET role = 'admin' WHERE user_id = '9b4fc593-f8ba-4111-85c0-804b4067927b';
INSERT INTO public.user_roles (user_id, role)
SELECT '9b4fc593-f8ba-4111-85c0-804b4067927b', 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = '9b4fc593-f8ba-4111-85c0-804b4067927b' AND role = 'admin'
);