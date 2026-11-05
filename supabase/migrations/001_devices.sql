create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null default 'This device',
  device_key text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_key)
);

create index if not exists devices_user_id_idx on public.devices(user_id);
create unique index if not exists devices_one_primary_idx on public.devices(user_id) where is_primary;

create or replace function public.is_approved_device(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.devices
    where user_id = account_id
      and user_id = auth.uid()
      and status = 'approved'
      and revoked_at is null
  );
$$;

create or replace function public.is_primary_device(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.devices
    where user_id = account_id
      and user_id = auth.uid()
      and status = 'approved'
      and is_primary
      and revoked_at is null
  );
$$;

create or replace function public.assign_device_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.devices where user_id = new.user_id) then
    new.status := 'approved';
    new.is_primary := true;
  else
    new.status := 'pending';
    new.is_primary := false;
  end if;
  return new;
end;
$$;

drop trigger if exists devices_assign_status on public.devices;
create trigger devices_assign_status
before insert on public.devices
for each row execute function public.assign_device_status();

alter table public.devices enable row level security;

drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
for select to authenticated
using (user_id = auth.uid());

drop policy if exists devices_insert_own on public.devices;
create policy devices_insert_own on public.devices
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists devices_update_primary on public.devices;
create policy devices_update_primary on public.devices
for update to authenticated
using (user_id = auth.uid() and public.is_primary_device(auth.uid()) and not is_primary)
with check (user_id = auth.uid() and not is_primary);

drop policy if exists devices_delete_primary on public.devices;
create policy devices_delete_primary on public.devices
for delete to authenticated
using (user_id = auth.uid() and public.is_approved_device(auth.uid()) and not is_primary);

revoke all on public.devices from anon;
grant select, insert, update, delete on public.devices to authenticated;
