-- Store the owner's display preferences alongside the invite so collaborators
-- can render numbers in the correct currency/locale without needing a separate
-- profile lookup (which would require its own RLS policy).

alter table public.collaborations
  add column owner_currency_code text not null default 'EUR',
  add column owner_locale        text not null default 'en-IE';
