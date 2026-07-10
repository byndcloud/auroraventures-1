UPDATE public.submissions SET status = 'Ongoing' WHERE status = 'Incubação';
UPDATE public.submission_history SET from_status = 'Ongoing' WHERE from_status = 'Incubação';
UPDATE public.submission_history SET to_status = 'Ongoing' WHERE to_status = 'Incubação';