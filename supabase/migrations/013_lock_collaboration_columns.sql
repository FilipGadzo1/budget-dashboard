-- Lock down what an invitee may change on a collaboration row.
--
-- The "Collaborators can respond to invitations" policy (003) lets the invitee
-- UPDATE their row, but RLS cannot restrict *which columns* change. Without this
-- trigger a viewer could set role = 'editor', or repoint owner_id at another
-- user and gain access to that user's budget.
--
-- Rule: anyone who is not the row's owner may only
--   * set status to 'accepted' or 'declined'
--   * set collaborator_id to their own id (or leave it unchanged)
--   * set collaborator_name
-- Every other column must stay exactly as it was.
--
-- Requests with no JWT (SQL editor, service role) are not restricted.

create or replace function public.restrict_collaborator_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() = old.owner_id then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
    or new.owner_email is distinct from old.owner_email
    or new.owner_name is distinct from old.owner_name
    or new.collaborator_email is distinct from old.collaborator_email
    or new.role is distinct from old.role
    or new.invite_token is distinct from old.invite_token
    or new.owner_currency_code is distinct from old.owner_currency_code
    or new.owner_locale is distinct from old.owner_locale
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Collaborators may only accept or decline an invitation'
      using errcode = '42501';
  end if;

  if new.collaborator_id is distinct from old.collaborator_id
    and new.collaborator_id is distinct from auth.uid()
  then
    raise exception 'collaborator_id can only be set to the current user'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('accepted', 'declined')
  then
    raise exception 'Invitation status can only be set to accepted or declined'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists collaborations_restrict_collaborator_update on public.collaborations;

create trigger collaborations_restrict_collaborator_update
  before update on public.collaborations
  for each row execute function public.restrict_collaborator_update();
