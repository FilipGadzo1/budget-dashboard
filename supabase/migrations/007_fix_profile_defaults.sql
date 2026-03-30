-- Fix profile column defaults: use EUR / en-US instead of SEK / sv-SE.
-- Also back-fill any existing rows that still carry the old Swedish defaults.

alter table public.profiles
  alter column currency_code set default 'EUR',
  alter column locale        set default 'en-US';

update public.profiles
set currency_code = 'EUR', locale = 'en-US'
where currency_code = 'SEK' and locale = 'sv-SE';
