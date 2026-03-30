-- Allow accepted collaborators to read the budget owner's profile.
-- Needed so the collaborator can display the owner's currency/locale correctly.

create policy "Accepted collaborators can read owner profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = profiles.id
        and collaborator_id = auth.uid()
        and status = 'accepted'
    )
  );
