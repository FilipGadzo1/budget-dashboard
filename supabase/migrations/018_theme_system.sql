-- Allow a third theme setting, 'system', which follows the device's light/dark
-- preference instead of forcing one.
--
-- profiles.theme_mode had a check constraint limited to ('light', 'dark').
-- Existing rows are untouched.
--
-- Until this is run, choosing "System" in the app cannot be saved (the app shows
-- a "couldn't save your preferences" message); Light and Dark keep working.

alter table public.profiles
  drop constraint if exists profiles_theme_mode_check;

alter table public.profiles
  add constraint profiles_theme_mode_check
  check (theme_mode in ('light', 'dark', 'system'));
