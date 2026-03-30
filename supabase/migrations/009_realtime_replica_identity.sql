-- Supabase Realtime needs REPLICA IDENTITY FULL to evaluate cross-table RLS
-- policies (like the ones that check public.collaborations) for each subscriber.
-- Without this, collaborators receive no events from these tables.

alter table public.projection_inputs replica identity full;
alter table public.profiles replica identity full;
