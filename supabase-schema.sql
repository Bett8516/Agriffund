-- AgriFund single-auth schema (Supabase Auth + Postgres RLS)
-- Run in the Supabase SQL editor. Keep the service-role key server-side only.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('farmer','administrator','extension_officer','bank')),
  access_status text not null default 'active' check (access_status in ('active','pending','suspended')),
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One profile is created by the Auth user trigger, so email confirmation is supported.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'farmer');
  if requested_role not in ('farmer','administrator','extension_officer','bank') then
    requested_role := 'farmer';
  end if;
  insert into public.profiles (id, role, access_status, profile_data)
  values (
    new.id,
    requested_role,
    case when requested_role in ('administrator','bank') then 'pending' else 'active' end,
    coalesce(new.raw_user_meta_data -> 'profile_data', '{}'::jsonb)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_agrifund on auth.users;
create trigger on_auth_user_created_agrifund after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'administrator' and p.access_status = 'active');
$$;
create or replace function public.is_active_bank()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'bank' and p.access_status = 'active');
$$;
create or replace function public.is_active_bank_id(bank_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = bank_user_id and p.role = 'bank' and p.access_status = 'active');
$$;
create or replace function public.is_active_officer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'extension_officer' and p.access_status = 'active');
$$;

alter table public.profiles enable row level security;
drop policy if exists "Profiles readable by owner or admin" on public.profiles;
create policy "Profiles readable by owner or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_admin());
drop policy if exists "Owner may update profile details without changing role" on public.profiles;
create policy "Owner may update profile details without changing role" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create or replace function public.protect_profile_access_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = old.id and not public.is_active_admin()
     and (new.role is distinct from old.role or new.access_status is distinct from old.access_status) then
    raise exception 'Role and access status changes require an administrator';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists protect_profile_access_fields on public.profiles;
create trigger protect_profile_access_fields before update on public.profiles
for each row execute procedure public.protect_profile_access_fields();
drop policy if exists "Admin may manage profiles" on public.profiles;
create policy "Admin may manage profiles" on public.profiles for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  request_data jsonb not null,
  result jsonb not null,
  agriscore integer not null check (agriscore between 0 and 100),
  status text not null default 'completed' check (status in ('requested','in_review','completed','withdrawn')),
  created_at timestamptz not null default now()
);
create index if not exists assessments_farmer_created on public.assessments(farmer_id, created_at desc);
alter table public.assessments enable row level security;
drop policy if exists "Farmers manage own assessments" on public.assessments;
create policy "Farmers create own assessments" on public.assessments for insert to authenticated
  with check (farmer_id = auth.uid());
create policy "Farmers read own assessments" on public.assessments for select to authenticated
  using (farmer_id = auth.uid());
drop policy if exists "Admin reads all assessments" on public.assessments;
create policy "Admin reads all assessments" on public.assessments for select to authenticated
  using (public.is_active_admin());

-- Explicit farmer-controlled sharing grants lender access to one assessment only.
create table if not exists public.assessment_shares (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  bank_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (assessment_id, bank_id)
);
alter table public.assessment_shares enable row level security;
drop policy if exists "Farmer controls shares" on public.assessment_shares;
create policy "Farmer controls shares" on public.assessment_shares for all to authenticated
  using (farmer_id = auth.uid()) with check (farmer_id = auth.uid()
    and public.is_active_bank_id(bank_id)
    and exists (select 1 from public.assessments a where a.id = assessment_id and a.farmer_id = auth.uid()));
drop policy if exists "Active bank sees its share grants" on public.assessment_shares;
create policy "Active bank sees its share grants" on public.assessment_shares for select to authenticated
  using (bank_id = auth.uid() and public.is_active_bank());
drop policy if exists "Shared assessment visible to approved bank" on public.assessments;
create policy "Shared assessment visible to approved bank" on public.assessments for select to authenticated
  using (public.is_active_bank() and exists (
    select 1 from public.assessment_shares s where s.assessment_id = assessments.id
      and s.bank_id = auth.uid() and s.revoked_at is null
  ));

-- Only an existing active administrator should approve pending bank/admin accounts.
-- Run this statement from a trusted admin workflow or SQL editor after verifying the person.
-- update public.profiles set access_status='active' where id='AUTH-USER-UUID' and role in ('administrator','bank');
