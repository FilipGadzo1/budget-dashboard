-- Enable Supabase Realtime for tables used in live collaboration.
-- Run this in Supabase Dashboard > SQL Editor.

alter publication supabase_realtime add table public.projection_inputs;
alter publication supabase_realtime add table public.scenarios;
alter publication supabase_realtime add table public.expense_items;
alter publication supabase_realtime add table public.collaborations;

-- Set REPLICA IDENTITY FULL so DELETE events carry the full old row
-- (needed to identify which scenario was deleted by its id).
alter table public.scenarios replica identity full;
alter table public.expense_items replica identity full;
alter table public.collaborations replica identity full;
