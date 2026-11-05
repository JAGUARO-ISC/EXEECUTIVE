create table if not exists public.sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('appointment', 'task', 'transaction', 'note', 'goal')),
  entity_id text not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  updated_by_device uuid not null references public.devices(id) on delete restrict,
  payload jsonb,
  primary key (user_id, entity_kind, entity_id)
);

create index if not exists sync_records_cursor_idx on public.sync_records(user_id, updated_at, entity_kind, entity_id);
create index if not exists sync_records_device_idx on public.sync_records(updated_by_device);

alter table public.sync_records enable row level security;

drop policy if exists sync_records_select_approved on public.sync_records;
create policy sync_records_select_approved on public.sync_records
for select to authenticated
using (user_id = auth.uid() and public.is_approved_device(auth.uid()));

drop policy if exists sync_records_insert_approved on public.sync_records;
create policy sync_records_insert_approved on public.sync_records
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_approved_device(auth.uid())
  and exists (
    select 1 from public.devices d
    where d.id = updated_by_device and d.user_id = auth.uid()
      and d.status = 'approved' and d.revoked_at is null
  )
);

drop policy if exists sync_records_update_approved on public.sync_records;
create policy sync_records_update_approved on public.sync_records
for update to authenticated
using (user_id = auth.uid() and public.is_approved_device(auth.uid()))
with check (
  user_id = auth.uid()
  and public.is_approved_device(auth.uid())
  and exists (
    select 1 from public.devices d
    where d.id = updated_by_device and d.user_id = auth.uid()
      and d.status = 'approved' and d.revoked_at is null
  )
);

drop policy if exists sync_records_delete_approved on public.sync_records;
create policy sync_records_delete_approved on public.sync_records
for delete to authenticated
using (user_id = auth.uid() and public.is_primary_device(auth.uid()));

revoke all on public.sync_records from anon;
grant select, insert, update, delete on public.sync_records to authenticated;
