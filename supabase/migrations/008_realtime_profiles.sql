-- Enable Realtime for the profiles table so collaborators receive live
-- currency/locale updates when the budget owner changes their settings.

alter publication supabase_realtime add table public.profiles;
