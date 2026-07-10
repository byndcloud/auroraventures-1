
ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET role = 'admin' WHERE user_id = 'b4cb145a-5101-4fd0-bf19-cf89ef046067';
ALTER TABLE public.profiles ENABLE TRIGGER USER;
DELETE FROM public.user_roles WHERE user_id = 'b4cb145a-5101-4fd0-bf19-cf89ef046067';
INSERT INTO public.user_roles (user_id, role) VALUES ('b4cb145a-5101-4fd0-bf19-cf89ef046067', 'admin');
