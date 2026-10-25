-- =====================================================================
-- Kiracım — Supabase şeması
-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştırın.
-- Tekrar çalıştırmak güvenlidir (create ... if not exists / or replace).
--
-- İçerik:
--   1. Tablolar
--   2. Yardımcı fonksiyonlar (üyelik, rol)
--   3. Satır düzeyi güvenlik (RLS) politikaları
--   4. Koruma tetikleyicileri (kiracının yetkisi dışındaki değişiklikler)
--   5. Otomatik kayıtlar (profil, ev sahibi üyeliği, ortak alan)
--   6. Davet kabul fonksiyonu
--   7. Bildirim tetikleyicileri
--   8. Günlük hatırlatmalar (pg_cron)
--   9. Dosya deposu (storage) ve anlık güncelleme (realtime)
-- =====================================================================

-- gen_random_uuid() ve md5() Postgres çekirdeğinde; ek uzantı gerekmez.

-- ---------------------------------------------------------------------
-- 1. Tablolar
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('tenant','landlord')),
  name        text not null default '',
  phone       text not null default '',
  lang        text not null default 'tr',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.properties (
  id            text primary key default gen_random_uuid()::text,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  addr          text not null default '',
  rent          numeric not null default 0,
  due_day       int  not null default 1 check (due_day between 1 and 28),
  aidat         numeric not null default 0,
  aidat_payer   text not null default 'Kiracı',
  deposit       numeric not null default 0,
  deposit_note  text not null default '',
  start_date    date not null default current_date,
  contract_end  date not null default (current_date + interval '1 year')::date,
  dask          date,
  value         numeric,
  bills         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- v4: mülk tipi (Konut/Ofis/Mağaza/Depo), alan, kiracı şirket bilgisi,
-- kira stopajı ve depozito türü. Eski kurulumlarda sütunlar sonradan eklenir.
alter table public.properties add column if not exists prop_type    text not null default 'Konut';
alter table public.properties add column if not exists area         numeric;
alter table public.properties add column if not exists company      jsonb;
alter table public.properties add column if not exists stopaj       boolean not null default false;
alter table public.properties add column if not exists deposit_kind text not null default 'Nakit';
alter table public.properties drop constraint if exists properties_prop_type_check;
alter table public.properties add constraint properties_prop_type_check check (prop_type in ('Konut','Ofis','Mağaza','Depo'));
alter table public.properties drop constraint if exists properties_deposit_kind_check;
alter table public.properties add constraint properties_deposit_kind_check check (deposit_kind in ('Nakit','Teminat mektubu'));

-- İki tarafın da düzenlediği alanlar ayrı tabloda: kiracı kiraya dokunamaz ama
-- tutanağı, çıkış sürecini ve yenileme yanıtını güncelleyebilir.
create table if not exists public.property_shared (
  property_id text primary key references public.properties(id) on delete cascade,
  inspect     jsonb not null default '{"tenantOk":false,"landlordOk":false,"rooms":[]}'::jsonb,
  move_out    jsonb,
  renewal     jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  property_id  text not null references public.properties(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null check (role in ('tenant','landlord')),
  display_name text not null default '',
  phone        text not null default '',
  email        text not null default '',
  created_at   timestamptz not null default now(),
  primary key (property_id, user_id)
);

create table if not exists public.invites (
  code         text primary key default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  property_id  text not null references public.properties(id) on delete cascade,
  name         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '30 days',
  accepted_by  uuid references public.profiles(id) on delete set null,
  accepted_at  timestamptz
);

create table if not exists public.payments (
  property_id   text not null references public.properties(id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  status        text not null check (status in ('review','partial','approved','rejected')),
  amount        numeric not null default 0,
  paid_on       date,
  receipt_name  text not null default '',
  receipt_path  text,
  note          text,
  reject_reason text,
  approved_at   timestamptz,
  updated_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  primary key (property_id, month)
);

create table if not exists public.rent_history (
  id          text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  from_date   date not null,
  amount      numeric not null,
  note        text not null default ''
);

create table if not exists public.requests (
  id          text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  cat         text not null,
  title       text not null,
  descr       text not null default '',
  urgency     text not null default 'Normal',
  status      int  not null default 0 check (status between 0 and 3),
  cost        text not null default 'Belirlenmedi',
  cost_ok     boolean not null default false,
  decision    text,
  req_date    date not null default current_date,
  photos      int  not null default 0,
  shots       jsonb not null default '[]'::jsonb,
  log         jsonb not null default '[]'::jsonb,
  quotes      jsonb not null default '[]'::jsonb,
  invoice     jsonb,
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id          text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  from_role   text not null check (from_role in ('tenant','landlord','system')),
  by_user     uuid default auth.uid(),
  body        text not null,
  at          timestamptz not null default now()
);
-- Yazışmaya eklenen fotoğraf (depo yolu). Yalnızca evin üyeleri görür.
alter table public.messages add column if not exists image_path text;

create table if not exists public.documents (
  id          text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  cat         text not null,
  name        text not null,
  path        text,
  uploaded_on date not null default current_date,
  until       date,
  uploaded_by uuid default auth.uid()
);

create table if not exists public.expenses (
  id          text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  cat         text not null,
  amount      numeric not null,
  spent_on    date not null,
  note        text not null default '',
  req_id      text
);

create table if not exists public.notifications (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  property_id text references public.properties(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  url         text not null default '#/',
  tag         text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
-- Aynı hatırlatma aynı gün iki kez gönderilmez.
create unique index if not exists notifications_tag_day
  on public.notifications (user_id, tag, ((created_at at time zone 'UTC')::date)) where tag is not null;

create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);

-- v5: yönetici ve denetim.
-- admins: yönetici hesapları. Satırı yalnızca SQL Editor'den (ya da service_role) eklenir.
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- reviews: müşterilerin yüklediği dekont, belge ve faturaların denetim kaydı.
-- Yükleyen dışındaki taraf, yönetici onaylayana kadar yüklemeyi ve dosyasını göremez.
create table if not exists public.reviews (
  kind        text not null check (kind in ('payment','document','invoice')),
  property_id text not null references public.properties(id) on delete cascade,
  ref_id      text not null,                 -- ödeme: ay (2026-10); belge: belge kimliği; fatura: talep kimliği
  uploader    uuid references public.profiles(id) on delete set null,
  label       text not null default '',      -- dosya ya da belge adı
  path        text,                          -- depo yolu (evim/<ev>/<dosya>)
  amount      numeric,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  note        text,                          -- red gerekçesi
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (kind, property_id, ref_id)
);
create index if not exists reviews_status on public.reviews (status, created_at desc);
create index if not exists reviews_path   on public.reviews (path);

-- v6: yasaklama ve yönetici denetim kaydı.
-- bans: askıya alınan hesaplar. Satırı yalnızca yönetici işlevi (admin_set_ban) yazar.
create table if not exists public.bans (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  reason    text not null default '',
  banned_by uuid references public.profiles(id) on delete set null,
  banned_at timestamptz not null default now()
);
-- admin_audit: yöneticinin yaptığı her hassas işlem (yasaklama, mesaj okuma/silme, yükleme kararı).
-- Yalnızca yönetici okur; hiç kimse (yönetici dahil) satırı değiştiremez ya da silemez.
create table if not exists public.admin_audit (
  id       bigserial primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action   text not null,
  target   text not null default '',
  detail   jsonb not null default '{}'::jsonb,
  at       timestamptz not null default now()
);
create index if not exists admin_audit_at on public.admin_audit (at desc);

create index if not exists memberships_user   on public.memberships (user_id);
create index if not exists payments_prop      on public.payments (property_id);
create index if not exists requests_prop      on public.requests (property_id);
create index if not exists messages_prop_at   on public.messages (property_id, at);
create index if not exists documents_prop     on public.documents (property_id);
create index if not exists expenses_prop      on public.expenses (property_id);
create index if not exists rent_history_prop  on public.rent_history (property_id);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Yardımcı fonksiyonlar
-- security definer: RLS politikalarının kendi içinde döngüye girmemesi için.
-- ---------------------------------------------------------------------

create or replace function public.member_role(pid text)
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships where property_id = pid and user_id = auth.uid()
$$;

create or replace function public.is_member(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where property_id = pid and user_id = auth.uid())
$$;

create or replace function public.is_owner(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties where id = pid and owner_id = auth.uid())
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bans where user_id = auth.uid())
$$;
grant execute on function public.is_banned() to authenticated;

-- Bu yükleme denetimden geçmemiş mi? (kayıt yoksa eski/denetimsiz sayılır, görünür)
-- Uygulama belge ve fatura yollarını "sb:<yol>" biçiminde saklar; depodaki gerçek ad önek olmadan.
create or replace function public.storage_path(v text)
returns text language sql immutable as $$ select nullif(regexp_replace(coalesce(v, ''), '^sb:', ''), '') $$;

create or replace function public.file_review_ok(pth text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.reviews where path = pth and status <> 'approved')
$$;

create or replace function public.review_ok(k text, pid text, rid text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.reviews
                     where kind = k and property_id = pid and ref_id = rid and status <> 'approved')
$$;

-- İki kullanıcı en az bir evi paylaşıyor mu? (profil adlarını görebilmek için)
create or replace function public.shares_property(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.property_id = b.property_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$$;

-- ---------------------------------------------------------------------
-- 3. Satır düzeyi güvenlik
-- ---------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.properties         enable row level security;
alter table public.property_shared    enable row level security;
alter table public.memberships        enable row level security;
alter table public.invites            enable row level security;
alter table public.payments           enable row level security;
alter table public.rent_history       enable row level security;
alter table public.requests           enable row level security;
alter table public.messages           enable row level security;
alter table public.documents          enable row level security;
alter table public.expenses           enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.admins             enable row level security;
alter table public.reviews            enable row level security;
alter table public.bans               enable row level security;
alter table public.admin_audit        enable row level security;

-- Politikaları yeniden oluşturabilmek için önce sil.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiller
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_property(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- evler: üyeler okur, yalnızca sahibi yazar; ev sahibi rolündekiler ev ekleyebilir
create policy properties_select on public.properties for select to authenticated
  using (public.is_member(id));
create policy properties_insert on public.properties for insert to authenticated
  with check (owner_id = auth.uid()
              and exists (select 1 from public.profiles where id = auth.uid() and role = 'landlord'));
create policy properties_update on public.properties for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy properties_delete on public.properties for delete to authenticated
  using (owner_id = auth.uid());

-- ortak alanlar: üyeler okur ve günceller (ayrıntı tetikleyicide denetlenir)
create policy shared_select on public.property_shared for select to authenticated
  using (public.is_member(property_id));
create policy shared_update on public.property_shared for update to authenticated
  using (public.is_member(property_id)) with check (public.is_member(property_id));

-- üyelikler: üyeler görür; sahibi kiracı çıkarır, kiracı kendisi ayrılabilir.
-- Ekleme yalnızca tetikleyici ve accept_invite() üzerinden olur.
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(property_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using ((public.is_owner(property_id) and role = 'tenant') or (user_id = auth.uid() and role = 'tenant'));
create policy memberships_update on public.memberships for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- davetler: yalnızca evin sahibi
create policy invites_owner on public.invites for all to authenticated
  using (public.is_owner(property_id)) with check (public.is_owner(property_id) and created_by = auth.uid());

-- ödemeler: üyeler okur ve yazar; kiracının ne yapabileceği tetikleyicide sınırlı
-- Mülk sahibi, dekontu yönetici onaylayana kadar görmez (bkz. reviews).
create policy payments_select on public.payments for select to authenticated
  using (public.is_admin()
         or (public.is_member(property_id)
             and (public.member_role(property_id) = 'tenant' or public.review_ok('payment', property_id, month))));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.is_member(property_id));
create policy payments_update on public.payments for update to authenticated
  using (public.is_member(property_id)
         and (public.member_role(property_id) = 'tenant' or public.review_ok('payment', property_id, month)))
  with check (public.is_member(property_id));

-- kira tutarı geçmişi: üyeler okur, sahibi yazar
create policy rent_history_select on public.rent_history for select to authenticated
  using (public.is_member(property_id));
create policy rent_history_write on public.rent_history for all to authenticated
  using (public.is_owner(property_id)) with check (public.is_owner(property_id));

-- talepler
create policy requests_select on public.requests for select to authenticated
  using (public.is_member(property_id));
create policy requests_insert on public.requests for insert to authenticated
  with check (public.is_member(property_id));
create policy requests_update on public.requests for update to authenticated
  using (public.is_member(property_id)) with check (public.is_member(property_id));

-- mesajlar: gönderen rolü üyelikle uyuşmalı; düzenleme/silme yok
create policy messages_select on public.messages for select to authenticated
  using (public.is_member(property_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (public.is_member(property_id)
              and (by_user = auth.uid())
              and (from_role = 'system' or from_role = public.member_role(property_id)));

-- belgeler
-- Belgeyi yükleyen kendi belgesini her zaman görür; karşı taraf yönetici onayından sonra.
create policy documents_select on public.documents for select to authenticated
  using (public.is_admin() or uploaded_by = auth.uid()
         or (public.is_member(property_id) and public.review_ok('document', property_id, id)));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_member(property_id) and uploaded_by = auth.uid());
create policy documents_update on public.documents for update to authenticated
  using (uploaded_by = auth.uid() or (public.is_owner(property_id) and public.review_ok('document', property_id, id)));
create policy documents_delete on public.documents for delete to authenticated
  using (uploaded_by = auth.uid() or (public.is_owner(property_id) and public.review_ok('document', property_id, id)));

-- giderler: kiracı hiç görmez
create policy expenses_owner on public.expenses for all to authenticated
  using (public.is_owner(property_id)) with check (public.is_owner(property_id));

-- yönetici: denetim için ilgili tabloları okur (yazma yetkisi yalnızca reviews kararında)
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());
create policy profiles_admin on public.profiles for select to authenticated using (public.is_admin());
create policy properties_admin on public.properties for select to authenticated using (public.is_admin());
create policy memberships_admin on public.memberships for select to authenticated using (public.is_admin());
create policy requests_admin on public.requests for select to authenticated using (public.is_admin());
create policy invites_admin on public.invites for select to authenticated using (public.is_admin());
create policy shared_admin on public.property_shared for select to authenticated using (public.is_admin());

-- denetim kayıtları: yönetici hepsini okur ve karar verir; yükleyen kendi yüklemesinin durumunu görür.
create policy reviews_select on public.reviews for select to authenticated
  using (public.is_admin() or uploader = auth.uid());
create policy reviews_decide on public.reviews for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- bildirimler ve abonelikler: kişiye özel
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- yasaklama kayıtları: yönetici hepsini, kullanıcı yalnızca kendininkini (askıya alındığını öğrenmek için) okur
create policy bans_admin on public.bans for select to authenticated using (public.is_admin());
create policy bans_self  on public.bans for select to authenticated using (user_id = auth.uid());
create policy audit_admin on public.admin_audit for select to authenticated using (public.is_admin());

-- Askıya alınmış hesap hiçbir içerik tablosunu okuyamaz ya da yazamaz (kısıtlayıcı politika:
-- diğer tüm politikalara ek olarak sağlanması gerekir). profiles'ta yalnızca güncelleme kapanır;
-- böylece uygulama oturumu açıp "askıya alındı" bilgisini gösterebilir.
do $$
declare t text;
begin
  foreach t in array array['properties','property_shared','memberships','invites','payments','rent_history',
                           'requests','messages','documents','expenses','notifications','push_subscriptions','reviews'] loop
    execute format('create policy not_banned on public.%I as restrictive for all to authenticated
                    using (not public.is_banned()) with check (not public.is_banned())', t);
  end loop;
end $$;
create policy not_banned on public.profiles as restrictive for update to authenticated
  using (not public.is_banned()) with check (not public.is_banned());

-- ---------------------------------------------------------------------
-- 4. Koruma tetikleyicileri
-- auth.uid() boşsa (sunucu, cron) denetim yapılmaz.
-- ---------------------------------------------------------------------

create or replace function public.guard_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.member_role(new.property_id);
begin
  if auth.uid() is null or r = 'landlord' or public.is_admin() then return new; end if;
  if new.status in ('approved','rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    raise exception 'Ödemeyi yalnızca mülk sahibi onaylayabilir ya da reddedebilir' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then
    raise exception 'Onaylanmış ödeme değiştirilemez' using errcode = '42501';
  end if;
  new.approved_at := case when tg_op = 'UPDATE' then old.approved_at else null end;
  return new;
end $$;
drop trigger if exists guard_payments on public.payments;
create trigger guard_payments before insert or update on public.payments
  for each row execute function public.guard_payments();

create or replace function public.guard_requests()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.member_role(new.property_id);
begin
  if auth.uid() is null or r = 'landlord' then new.updated_at := now(); return new; end if;
  if new.cost is distinct from old.cost
     or new.decision is distinct from old.decision
     or new.quotes is distinct from old.quotes
     or new.invoice is distinct from old.invoice then
    raise exception 'Masraf, karar, teklif ve faturayı yalnızca mülk sahibi değiştirebilir' using errcode = '42501';
  end if;
  if new.status <> old.status and new.status <> 3 then
    raise exception 'Kiracı talebi yalnızca kapatabilir' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_requests on public.requests;
create trigger guard_requests before update on public.requests
  for each row execute function public.guard_requests();

-- Bir taraf karşı tarafın onayını yalnızca geri alabilir (true → false), veremez.
create or replace function public.guard_shared()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := public.member_role(new.property_id);
  other_flag text;
begin
  if auth.uid() is null then new.updated_at := now(); return new; end if;
  other_flag := case when r = 'tenant' then 'landlordOk' else 'tenantOk' end;

  if coalesce((new.inspect ->> other_flag)::boolean, false)
     and not coalesce((old.inspect ->> other_flag)::boolean, false) then
    raise exception 'Karşı tarafın tutanak onayı verilemez' using errcode = '42501';
  end if;

  if new.move_out is not null then
    if coalesce((new.move_out ->> other_flag)::boolean, false)
       and not coalesce((old.move_out ->> other_flag)::boolean, false) then
      raise exception 'Karşı tarafın çıkış onayı verilemez' using errcode = '42501';
    end if;
    if r = 'tenant' then
      if (new.move_out -> 'deductions') is distinct from (old.move_out -> 'deductions')
         or (new.move_out -> 'refunded') is distinct from (old.move_out -> 'refunded') then
        raise exception 'Kesinti ve iadeyi yalnızca mülk sahibi girebilir' using errcode = '42501';
      end if;
    end if;
  end if;
  if r = 'tenant' and old.move_out is null and new.move_out is not null then
    null; -- kiracı da çıkış sürecini başlatabilir
  end if;
  if r = 'tenant' and old.move_out is not null and new.move_out is null then
    raise exception 'Çıkış sürecini yalnızca mülk sahibi iptal edebilir' using errcode = '42501';
  end if;

  if r = 'tenant' and new.renewal is distinct from old.renewal then
    if old.renewal is null
       or (old.renewal ->> 'status') <> 'sent'
       or (new.renewal ->> 'status') <> 'accepted'
       or (new.renewal - 'status') is distinct from (old.renewal - 'status') then
      raise exception 'Kiracı yenileme teklifini yalnızca kabul edebilir' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_shared on public.property_shared;
create trigger guard_shared before update on public.property_shared
  for each row execute function public.guard_shared();

-- Rol, kayıttan sonra değiştirilemez.
create or replace function public.guard_profile()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Hesap rolü değiştirilemez' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch_properties on public.properties;
create trigger touch_properties before update on public.properties
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_payments on public.payments;
create trigger touch_payments before update on public.payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. Otomatik kayıtlar
-- ---------------------------------------------------------------------

-- Yeni kullanıcı → profil (ad ve rol kayıt formundan gelir).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, lang)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'landlord' then 'landlord' else 'tenant' end,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'lang', 'tr')
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Yeni ev → sahibi üye olur, ortak alan satırı ve ilk kira kaydı açılır.
create or replace function public.handle_new_property()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (property_id, user_id, role, display_name)
  select new.id, new.owner_id, 'landlord', p.name from public.profiles p where p.id = new.owner_id
  on conflict do nothing;
  insert into public.property_shared (property_id) values (new.id) on conflict do nothing;
  insert into public.rent_history (id, property_id, from_date, amount, note)
  values (new.id || ':' || new.start_date, new.id, new.start_date, new.rent, 'Sözleşme başlangıcı')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_property_created on public.properties;
create trigger on_property_created after insert on public.properties
  for each row execute function public.handle_new_property();

-- ---------------------------------------------------------------------
-- 6. Davet kabulü
-- Kiracı, ev sahibinin paylaştığı kodu girer; üyelik açılır.
-- ---------------------------------------------------------------------

create or replace function public.accept_invite(invite_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
  me  public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Oturum açılmamış' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Hesap askıya alındı' using errcode = '42501'; end if;
  if me.role <> 'tenant' then raise exception 'Davetler kiracı hesapları içindir' using errcode = '22023'; end if;

  select * into inv from public.invites where code = upper(trim(invite_code)) for update;
  if inv.code is null then raise exception 'Davet kodu bulunamadı' using errcode = 'P0002'; end if;
  if inv.accepted_by is not null and inv.accepted_by <> me.id then
    raise exception 'Bu davet kullanılmış' using errcode = '22023';
  end if;
  if inv.expires_at < now() then raise exception 'Davetin süresi dolmuş' using errcode = '22023'; end if;

  insert into public.memberships (property_id, user_id, role, display_name, phone, email)
  values (inv.property_id, me.id, 'tenant', coalesce(nullif(me.name, ''), inv.name), coalesce(nullif(me.phone, ''), inv.phone),
          coalesce((select email from auth.users where id = me.id), inv.email))
  on conflict (property_id, user_id) do nothing;

  update public.invites set accepted_by = me.id, accepted_at = now() where code = inv.code;

  insert into public.messages (id, property_id, from_role, by_user, body)
  values (gen_random_uuid()::text, inv.property_id, 'system', null, me.name || ' eve katıldı');

  return inv.property_id;
end $$;
grant execute on function public.accept_invite(text) to authenticated;

-- Hesap silme (KVKK): kullanıcı kendi hesabını ve sahibi olduğu evleri siler.
-- Kiracı olduğu evlerdeki mesajları, ev sahibinin kayıtları için korunur (gönderen boşalır).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Oturum açılmamış' using errcode = '42501'; end if;
  update public.messages set by_user = null where by_user = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Bildirimler
-- Olaylar sunucuda bildirime dönüşür; uygulama kapalı olsa da gider.
-- notifications tablosuna eklenen her satır, Database Webhook ile
-- "push" Edge Function'ını tetikler (kurulum kılavuzuna bakın).
-- ---------------------------------------------------------------------

create or replace function public.notify_members(
  pid text, target_role text, title text, body text,
  tenant_url text, landlord_url text, skip_user uuid default auth.uid(), tag text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, property_id, title, body, url, tag)
  select m.user_id, pid, title, left(body, 240),
         case when m.role = 'tenant' then tenant_url else landlord_url end, tag
  from public.memberships m
  where m.property_id = pid
    and (target_role is null or m.role = target_role)
    and (skip_user is null or m.user_id <> skip_user)
  on conflict do nothing;
end $$;

create or replace function public.prop_name(pid text)
returns text language sql stable security definer set search_path = public as $$
  select name from public.properties where id = pid
$$;

create or replace function public.fmt_tl(n numeric)
returns text language sql immutable as $$
  select '₺' || replace(to_char(round(n), 'FM999G999G999G999'), ',', '.')
$$;

create or replace function public.on_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text := public.prop_name(new.property_id);
  lurl  text := '#/mulk-sahibi/mulk/' || new.property_id || '/odeme';
begin
  -- Dekont geldi bildirimi, yönetici onayladıktan sonra gider (bkz. on_review_change).
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform public.notify_members(new.property_id, 'tenant', 'Ödemen onaylandı',
      new.month || ' kirası onaylandı.', '#/kiraci/odemeler', lurl);
  elsif new.status = 'rejected' and (tg_op = 'INSERT' or old.status is distinct from 'rejected') then
    perform public.notify_members(new.property_id, 'tenant', 'Dekont reddedildi',
      coalesce(new.reject_reason, 'Mülk sahibi dekontu onaylamadı.'), '#/kiraci/odemeler', lurl);
  end if;
  return new;
end $$;
drop trigger if exists on_payment_change on public.payments;
create trigger on_payment_change after insert or update on public.payments
  for each row execute function public.on_payment_change();

create or replace function public.on_request_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  steps text[] := array['Açıldı','Görüldü','İşlemde','Çözüldü'];
  turl  text := '#/kiraci/talepler/' || new.id;
  lurl  text := '#/mulk-sahibi/mulk/' || new.property_id || '/talep?s=talep&id=' || new.id;
begin
  if tg_op = 'INSERT' then
    perform public.notify_members(new.property_id, 'landlord', public.prop_name(new.property_id) || ': yeni talep',
      new.title || case when new.urgency = 'Acil' then ' · Acil' else '' end, turl, lurl);
  elsif new.status <> old.status then
    perform public.notify_members(new.property_id, null, 'Talep güncellendi',
      new.title || ' → ' || steps[new.status + 1], turl, lurl);
  elsif new.cost is distinct from old.cost then
    perform public.notify_members(new.property_id, 'tenant', 'Masraf önerisi',
      new.title || ': masraf ' || new.cost || ' olarak önerildi.', turl, lurl);
  end if;
  return new;
end $$;
drop trigger if exists on_request_change on public.requests;
create trigger on_request_change after insert or update on public.requests
  for each row execute function public.on_request_change();

create or replace function public.on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare sender text;
begin
  if new.from_role = 'system' then return new; end if;
  select display_name into sender from public.memberships where property_id = new.property_id and user_id = new.by_user;
  perform public.notify_members(new.property_id, null, coalesce(nullif(sender, ''), 'Yeni mesaj'), coalesce(nullif(new.body, ''), 'Fotoğraf gönderdi'),
    '#/kiraci/mesajlar', '#/mulk-sahibi/mulk/' || new.property_id || '/mesaj', new.by_user);
  return new;
end $$;
drop trigger if exists on_message on public.messages;
create trigger on_message after insert on public.messages
  for each row execute function public.on_message();

create or replace function public.on_shared_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text := public.prop_name(new.property_id);
  p     public.properties;
  cikis_t text := '#/kiraci/belgeler/cikis';
  cikis_l text := '#/mulk-sahibi/mulk/' || new.property_id || '/cikis';
begin
  -- Yenileme teklifi
  if (new.renewal ->> 'status') is distinct from (old.renewal ->> 'status') then
    if new.renewal ->> 'status' = 'sent' then
      perform public.notify_members(new.property_id, 'tenant', 'Yenileme teklifi geldi',
        'Yeni dönem için ' || public.fmt_tl((new.renewal ->> 'amount')::numeric) || ' önerildi.', '#/kiraci/odemeler',
        '#/mulk-sahibi/mulk/' || new.property_id || '/odeme');
    elsif new.renewal ->> 'status' = 'accepted' then
      -- Kabul edilen tutar sözleşme bitişinden itibaren geçerli olur.
      select * into p from public.properties where id = new.property_id;
      insert into public.rent_history (id, property_id, from_date, amount, note)
      values (p.id || ':' || p.contract_end, p.id, p.contract_end, (new.renewal ->> 'amount')::numeric,
              'Yenileme · TÜFE %' || coalesce(new.renewal ->> 'cpi', '?'))
      on conflict (id) do update set amount = excluded.amount, note = excluded.note;
      perform public.notify_members(new.property_id, 'landlord', pname || ': teklif kabul edildi',
        public.fmt_tl((new.renewal ->> 'amount')::numeric) || ' yeni dönem kirası olarak kabul edildi.',
        '#/kiraci/odemeler', '#/mulk-sahibi/mulk/' || new.property_id || '/odeme');
    end if;
  end if;

  -- Çıkış süreci
  if old.move_out is null and new.move_out is not null then
    perform public.notify_members(new.property_id, null, pname || ': çıkış süreci başladı',
      'Odaları birlikte değerlendirip kesintileri onaylayın.', cikis_t, cikis_l);
  elsif new.move_out is not null and (new.move_out -> 'refunded') is distinct from (old.move_out -> 'refunded')
        and new.move_out -> 'refunded' is not null and jsonb_typeof(new.move_out -> 'refunded') = 'object' then
    perform public.notify_members(new.property_id, 'tenant', 'Depozito iadesi yapıldı',
      public.fmt_tl((new.move_out -> 'refunded' ->> 'amount')::numeric) || ' iade edildi.', cikis_t, cikis_l);
  elsif new.move_out is not null
        and coalesce((new.move_out ->> 'tenantOk')::boolean, false) and coalesce((new.move_out ->> 'landlordOk')::boolean, false)
        and not (coalesce((old.move_out ->> 'tenantOk')::boolean, false) and coalesce((old.move_out ->> 'landlordOk')::boolean, false)) then
    perform public.notify_members(new.property_id, null, pname || ': çıkış hesabı onaylandı',
      'İki taraf da onayladı; iade tutarı kesinleşti.', cikis_t, cikis_l);
  end if;
  return new;
end $$;
drop trigger if exists on_shared_change on public.property_shared;
create trigger on_shared_change after update on public.property_shared
  for each row execute function public.on_shared_change();

-- ---------------------------------------------------------------------
-- 8. Günlük hatırlatmalar
-- Her sabah çalışır; eşik gününe denk gelen hatırlatmaları üretir.
-- Eşikler kullanıcının ayarlarından (profiles.settings) okunur.
-- ---------------------------------------------------------------------

create or replace function public.daily_reminders(today date default (now() at time zone 'Europe/Istanbul')::date)
returns int language plpgsql security definer set search_path = public as $$
declare
  p      public.properties;
  mb     public.memberships;
  s      jsonb;
  mkey   text := to_char(today, 'YYYY-MM');
  due    date;
  paid   text;
  n      int := 0;
  before int;
begin
  select count(*) into before from public.notifications;

  for p in select * from public.properties loop
    continue when p.start_date > today;                      -- sözleşme henüz başlamadı
    due := make_date(extract(year from today)::int, extract(month from today)::int, p.due_day);
    -- İlk ayda vade, sözleşme başlangıcından önceye düşmez (yeni eklenen mülk için "kira gecikti" gitmez).
    if to_char(p.start_date, 'YYYY-MM') = mkey and p.start_date > due then due := p.start_date; end if;
    select status into paid from public.payments where property_id = p.id and month = mkey;

    for mb in select * from public.memberships where property_id = p.id loop
      select settings into s from public.profiles where id = mb.user_id;

      -- Kira günü yaklaşıyor (kiracı)
      if mb.role = 'tenant' and paid is null
         and due - today = coalesce((s ->> 'rentDays')::int, 3) then
        insert into public.notifications (user_id, property_id, title, body, url, tag)
        values (mb.user_id, p.id, 'Kira günü yaklaşıyor',
                p.name || ': ' || public.fmt_tl(p.rent) || ', son gün ' || to_char(due, 'DD.MM.YYYY') || '.',
                '#/kiraci/odemeler', 'rent-soon-' || p.id)
        on conflict do nothing;
      end if;

      -- Kira gecikti: vadeden sonraki gün ve ardından haftada bir
      if (paid is null or paid = 'rejected') and today > due and (today - due) % 7 = 1 then
        insert into public.notifications (user_id, property_id, title, body, url, tag)
        values (mb.user_id, p.id,
                case when mb.role = 'tenant' then 'Kira gecikti' else p.name || ': kira gecikti' end,
                to_char(due, 'DD.MM.YYYY') || ' vadeli kira ' || (today - due) || ' gündür ödenmedi.',
                case when mb.role = 'tenant' then '#/kiraci/odemeler' else '#/mulk-sahibi/mulk/' || p.id || '/odeme' end,
                'rent-late-' || p.id)
        on conflict do nothing;
      end if;

      -- Sözleşme yenileme
      if p.contract_end - today in (coalesce((s ->> 'renewDays')::int, 60), 30, 7) then
        insert into public.notifications (user_id, property_id, title, body, url, tag)
        values (mb.user_id, p.id, p.name || ': sözleşme yenileme',
                'Sözleşme ' || to_char(p.contract_end, 'DD.MM.YYYY') || ' tarihinde yenileniyor (' || (p.contract_end - today) || ' gün).',
                case when mb.role = 'tenant' then '#/kiraci/odemeler' else '#/mulk-sahibi/mulk/' || p.id || '/odeme' end,
                'renew-' || p.id)
        on conflict do nothing;
      end if;

      -- DASK (ev sahibi)
      if mb.role = 'landlord' and p.dask is not null
         and p.dask - today in (coalesce((s ->> 'insDays')::int, 30), 7) then
        insert into public.notifications (user_id, property_id, title, body, url, tag)
        values (mb.user_id, p.id, p.name || ': DASK yenileme',
                'Poliçe ' || to_char(p.dask, 'DD.MM.YYYY') || ' tarihinde bitiyor.',
                '#/mulk-sahibi/mulk/' || p.id || '/belge', 'dask-' || p.id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;

  -- Tahliye taahhütnamesi tarihleri
  insert into public.notifications (user_id, property_id, title, body, url, tag)
  select m.user_id, d.property_id, 'Tahliye tarihi yaklaşıyor',
         'Taahhütnamedeki tarih: ' || to_char(d.until, 'DD.MM.YYYY'),
         case when m.role = 'tenant' then '#/kiraci/belgeler' else '#/mulk-sahibi/mulk/' || d.property_id || '/belge' end,
         'evict-' || d.id
  from public.documents d
  join public.memberships m on m.property_id = d.property_id
  left join public.profiles pr on pr.id = m.user_id
  where d.cat = 'Tahliye taahhütnamesi' and d.until is not null
    and d.until - today in (coalesce((pr.settings ->> 'evictDays')::int, 90), 30, 7)
  on conflict do nothing;

  select count(*) - before into n from public.notifications;
  return n;
end $$;

-- pg_cron varsa her gün 09:00 (İstanbul, UTC+3) çalıştır.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'evim-daily-reminders';
    perform cron.schedule('evim-daily-reminders', '0 6 * * *', 'select public.daily_reminders()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. Dosya deposu ve anlık güncelleme
-- Dosya yolu: <ev kimliği>/<dosya>. Yalnızca o evin üyeleri erişir.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('evim', 'evim', false)
on conflict (id) do nothing;

drop policy if exists evim_read on storage.objects;
drop policy if exists evim_write on storage.objects;
drop policy if exists evim_delete on storage.objects;
drop policy if exists evim_not_banned on storage.objects;
-- Denetime bağlı dosyalar (dekont, belge, fatura): yükleyen ve yönetici her zaman, ev üyeleri onaydan sonra okur.
create policy evim_read on storage.objects for select to authenticated
  using (bucket_id = 'evim' and (
    public.is_admin() or owner = auth.uid()
    or (public.is_member((storage.foldername(name))[1])
        and public.file_review_ok(storage.objects.name))));
create policy evim_write on storage.objects for insert to authenticated
  with check (bucket_id = 'evim' and public.is_member((storage.foldername(name))[1]));
create policy evim_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evim' and public.is_owner((storage.foldername(name))[1]));
create policy evim_not_banned on storage.objects as restrictive for all to authenticated
  using (not public.is_banned()) with check (not public.is_banned());

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['properties','property_shared','memberships','payments','rent_history',
                             'requests','messages','documents','expenses','notifications','reviews'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 10. Yönetici denetimi
-- Dekont, belge ve fatura yüklenince reviews'a "pending" kayıt düşer; yönetici
-- onaylayana kadar yükleyen dışındaki taraf bunları (ve dosyalarını) göremez.
-- Aynı dosya yeniden yüklenirse denetim baştan başlar.
-- ---------------------------------------------------------------------

create or replace function public.upsert_review(
  k text, pid text, rid text, who uuid, lbl text, pth text, amt numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- guard_reviews bu çağrıyı (yükleme sonrası sıfırlama) engellemesin.
  perform set_config('kiracim.sistem', '1', true);
  insert into public.reviews (kind, property_id, ref_id, uploader, label, path, amount)
  values (k, pid, rid, who, coalesce(lbl, ''), pth, amt)
  on conflict (kind, property_id, ref_id) do update
    set uploader = excluded.uploader, label = excluded.label, path = excluded.path, amount = excluded.amount,
        status = 'pending', note = null, reviewed_by = null, reviewed_at = null, created_at = now();
  perform set_config('kiracim.sistem', '0', true);
end $$;

-- Dekont: kiracı yükleyince ya da dekont/tutar değişince.
create or replace function public.track_payment_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.member_role(new.property_id) is not distinct from 'landlord' or public.is_admin() then return new; end if;
  if new.status not in ('review','partial') then return new; end if;
  if tg_op = 'INSERT'
     or new.receipt_path is distinct from old.receipt_path
     or new.receipt_name is distinct from old.receipt_name
     or new.amount is distinct from old.amount then
    perform public.upsert_review('payment', new.property_id, new.month, auth.uid(), new.receipt_name, new.receipt_path, new.amount);
  end if;
  return new;
end $$;
drop trigger if exists track_payment_review on public.payments;
create trigger track_payment_review after insert or update on public.payments
  for each row execute function public.track_payment_review();

-- Belge: yükleyen kim olursa olsun.
create or replace function public.track_document_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.path is distinct from old.path or new.name is distinct from old.name then
    perform public.upsert_review('document', new.property_id, new.id, coalesce(new.uploaded_by, auth.uid()), new.name, public.storage_path(new.path), null);
  end if;
  return new;
end $$;
drop trigger if exists track_document_review on public.documents;
create trigger track_document_review after insert or update on public.documents
  for each row execute function public.track_document_review();

-- Fatura: mülk sahibi talebe fatura eklediğinde.
create or replace function public.track_invoice_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.invoice is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' or (new.invoice -> 'path') is distinct from (old.invoice -> 'path')
     or (new.invoice -> 'amount') is distinct from (old.invoice -> 'amount') then
    perform public.upsert_review('invoice', new.property_id, new.id, auth.uid(), coalesce(new.invoice ->> 'name', 'fatura'),
                                 public.storage_path(new.invoice ->> 'path'), nullif(new.invoice ->> 'amount', '')::numeric);
  end if;
  return new;
end $$;
drop trigger if exists track_invoice_review on public.requests;
create trigger track_invoice_review after insert or update on public.requests
  for each row execute function public.track_invoice_review();

-- Yalnızca yönetici karar verir; karar alanları dışında bir şey değişmez.
create or replace function public.guard_reviews()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(current_setting('kiracim.sistem', true), '0') = '1' then return new; end if;
  if not public.is_admin() then
    raise exception 'Denetim kararını yalnızca yönetici verebilir' using errcode = '42501';
  end if;
  if new.kind is distinct from old.kind or new.property_id is distinct from old.property_id or new.ref_id is distinct from old.ref_id
     or new.uploader is distinct from old.uploader or new.label is distinct from old.label
     or new.path is distinct from old.path or new.amount is distinct from old.amount then
    raise exception 'Yüklemenin kendisi değiştirilemez' using errcode = '42501';
  end if;
  if new.status = 'rejected' and coalesce(btrim(new.note), '') = '' then
    raise exception 'Red için gerekçe yazılmalı' using errcode = '22023';
  end if;
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists guard_reviews on public.reviews;
create trigger guard_reviews before update on public.reviews
  for each row execute function public.guard_reviews();

-- Karar sonrası: ilgili kayda yansıt ve bildirim gönder.
create or replace function public.on_review_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text := public.prop_name(new.property_id);
begin
  if new.status is not distinct from old.status or new.status = 'pending' then return new; end if;

  if new.kind = 'payment' then
    if new.status = 'approved' then
      perform public.notify_members(new.property_id, 'landlord', pname || ': dekont geldi',
        new.ref_id || ' kirası için ' || public.fmt_tl(coalesce(new.amount, 0)) || ' ödendi.',
        '#/kiraci/odemeler', '#/mulk-sahibi/mulk/' || new.property_id || '/odeme', null);
    else
      -- Reddedilen dekont kiracıya gerekçesiyle döner; kiracı yeniden yükleyebilir.
      update public.payments set status = 'rejected', reject_reason = 'Denetim: ' || new.note
       where property_id = new.property_id and month = new.ref_id and status in ('review','partial');
    end if;

  elsif new.kind = 'document' then
    if new.status = 'approved' then
      perform public.notify_members(new.property_id, null, pname || ': yeni belge', new.label,
        '#/kiraci/belgeler', '#/mulk-sahibi/mulk/' || new.property_id || '/belge', new.uploader);
    elsif new.uploader is not null then
      insert into public.notifications (user_id, property_id, title, body, url)
      values (new.uploader, new.property_id, 'Belgen kabul edilmedi', new.label || ': ' || new.note,
              case when public.member_role(new.property_id) = 'landlord' then '#/mulk-sahibi/mulk/' || new.property_id || '/belge' else '#/kiraci/belgeler' end);
    end if;

  elsif new.kind = 'invoice' then
    if new.status = 'approved' then
      perform public.notify_members(new.property_id, 'tenant', pname || ': fatura eklendi', new.label,
        '#/kiraci/talepler/' || new.ref_id, '', null);
    elsif new.uploader is not null then
      insert into public.notifications (user_id, property_id, title, body, url)
      values (new.uploader, new.property_id, 'Faturan kabul edilmedi', new.label || ': ' || new.note,
              '#/mulk-sahibi/mulk/' || new.property_id || '/talep');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change after update on public.reviews
  for each row execute function public.on_review_change();

-- Yönetici paneli: tüm kullanıcılar (e-postayla). Yalnızca yöneticiye döner.
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (id uuid, email text, name text, role text, phone text, created_at timestamptz,
               is_admin boolean, subscribed boolean, expires_at timestamptz,
               banned boolean, ban_reason text, banned_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.name, p.role, p.phone, p.created_at,
           exists (select 1 from public.admins a where a.user_id = p.id),
           coalesce(s.active and (s.expires_at is null or s.expires_at > now()), false),
           s.expires_at,
           b.user_id is not null, b.reason, b.banned_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.subscriptions s on s.user_id = p.id
    left join public.bans b on b.user_id = p.id
    order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;

-- Yönetici işlemi kaydı (yalnızca bu dosyadaki yönetici işlevleri çağırır).
create or replace function public.audit(act text, tgt text, det jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit (admin_id, action, target, detail) values (auth.uid(), act, tgt, coalesce(det, '{}'::jsonb))
$$;
revoke execute on function public.audit(text, text, jsonb) from public, authenticated;

-- Yasakla / yasağı kaldır. Yönetici kendini ya da başka bir yöneticiyi yasaklayamaz.
-- Yasak, (1) bans satırıyla tüm verilere erişimi keser, (2) Supabase Auth'ta girişi ve token yenilemeyi
-- kapatır, (3) açık oturumları siler. Üçüncü adım Supabase dışı ortamda (testte) atlanır.
create or replace function public.admin_set_ban(uid uuid, ban boolean, why text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if;
  if uid = auth.uid() then raise exception 'Kendini yasaklayamazsın' using errcode = '22023'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'Yönetici yasaklanamaz' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'Kullanıcı bulunamadı' using errcode = 'P0002'; end if;
  if ban then
    if coalesce(trim(why), '') = '' then raise exception 'Yasaklama için gerekçe yaz' using errcode = '22023'; end if;
    insert into public.bans (user_id, reason, banned_by) values (uid, trim(why), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, banned_at = now();
  else
    delete from public.bans where user_id = uid;
  end if;
  begin
    update auth.users set banned_until = case when ban then 'infinity'::timestamptz else null end where id = uid;
    if ban then delete from auth.sessions where user_id = uid; end if;
  exception when undefined_column or undefined_table then null;
  end;
  perform public.audit(case when ban then 'user.ban' else 'user.unban' end, uid::text, jsonb_build_object('reason', coalesce(trim(why), '')));
end $$;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;

-- Yazışma listesi: mülk başına son mesaj ve sayı (içerik değil, özet). Yalnızca yöneticiye döner.
create or replace function public.admin_threads()
returns table (property_id text, name text, owner_id uuid, owner_name text, tenants text,
               msg_count bigint, last_at timestamptz, last_body text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if;
  return query
    select p.id, p.name, p.owner_id, o.name,
           coalesce((select string_agg(coalesce(nullif(m.display_name, ''), pr.name), ', ')
                     from public.memberships m left join public.profiles pr on pr.id = m.user_id
                     where m.property_id = p.id and m.role = 'tenant'), ''),
           (select count(*) from public.messages x where x.property_id = p.id),
           lm.at, lm.body
    from public.properties p
    left join public.profiles o on o.id = p.owner_id
    left join lateral (select x.at, x.body from public.messages x where x.property_id = p.id order by x.at desc limit 1) lm on true
    where exists (select 1 from public.messages x where x.property_id = p.id)
    order by lm.at desc;
end $$;
grant execute on function public.admin_threads() to authenticated;

-- Bir mülkün yazışması. Her okuma denetim kaydına yazılır.
create or replace function public.admin_messages(pid text, lim int default 300)
returns table (id text, at timestamptz, from_role text, by_user uuid, by_name text, body text, image_path text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if;
  perform public.audit('messages.view', pid);
  return query
    select m.id, m.at, m.from_role, m.by_user, pr.name, m.body, m.image_path
    from public.messages m left join public.profiles pr on pr.id = m.by_user
    where m.property_id = pid
    order by m.at desc limit greatest(1, least(coalesce(lim, 300), 1000));
end $$;
grant execute on function public.admin_messages(text, int) to authenticated;

-- Uygunsuz mesajı siler (içerik kaydı tutulmaz; kim, hangi mülk, ne zaman denetim kaydında kalır).
create or replace function public.admin_delete_message(mid text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if;
  select * into m from public.messages where id = mid;
  if m.id is null then raise exception 'Mesaj bulunamadı' using errcode = 'P0002'; end if;
  delete from public.messages where id = mid;
  perform public.audit('message.delete', m.property_id, jsonb_build_object('message', mid, 'by', m.by_user));
end $$;
grant execute on function public.admin_delete_message(text) to authenticated;

create or replace function public.admin_audit_log(lim int default 200)
returns table (id bigint, at timestamptz, admin_name text, action text, target text, detail jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if;
  return query
    select a.id, a.at, pr.name, a.action, a.target, a.detail
    from public.admin_audit a left join public.profiles pr on pr.id = a.admin_id
    order by a.at desc, a.id desc limit greatest(1, least(coalesce(lim, 200), 1000));
end $$;
grant execute on function public.admin_audit_log(int) to authenticated;

-- Yükleme kararları da denetim kaydına düşer.
create or replace function public.audit_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') and auth.uid() is not null then
    perform public.audit('review.' || new.status, new.kind || ':' || new.property_id || ':' || new.ref_id,
                         jsonb_build_object('note', new.note));
  end if;
  return new;
end $$;
drop trigger if exists audit_review on public.reviews;
create trigger audit_review after update on public.reviews
  for each row execute function public.audit_review();

-- Denetim kaydı olmayan eski yüklemeler (bu bölüm eklenmeden önce yüklenenler) onaylı sayılır.
insert into public.reviews (kind, property_id, ref_id, uploader, label, path, amount, status, note)
select 'document', property_id, id, uploaded_by, name, public.storage_path(path), null, 'approved', null from public.documents
on conflict do nothing;
insert into public.reviews (kind, property_id, ref_id, uploader, label, path, amount, status, note)
select 'payment', property_id, month, null, receipt_name, receipt_path, amount, 'approved', null
from public.payments where status in ('review','partial','approved','rejected') and (receipt_path is not null or receipt_name <> '')
on conflict do nothing;
insert into public.reviews (kind, property_id, ref_id, uploader, label, path, amount, status, note)
select 'invoice', property_id, id, null, coalesce(invoice ->> 'name', 'fatura'), public.storage_path(invoice ->> 'path'),
       nullif(invoice ->> 'amount', '')::numeric, 'approved', null
from public.requests where invoice is not null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Yetkiler (Supabase varsayılanlarıyla aynı; açıkça yazıldı)
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.daily_reminders(date) from public;

-- ---------------------------------------------------------------------
-- v4 veri güncellemesi: "Ev sahibi" değeri "Mülk sahibi" oldu.
-- Tekrar çalıştırmak zararsızdır. Talep tetikleyicisi bu sırada kapatılır ki
-- eski kayıtlar için "masraf önerildi" bildirimi gitmesin.
-- ---------------------------------------------------------------------
alter table public.requests disable trigger on_request_change;
update public.requests set cost = 'Mülk sahibi' where cost = 'Ev sahibi';
alter table public.requests enable trigger on_request_change;
update public.properties set aidat_payer = 'Mülk sahibi' where aidat_payer = 'Ev sahibi';
update public.properties set bills = replace(bills::text, '"Ev sahibi"', '"Mülk sahibi"')::jsonb
  where bills::text like '%"Ev sahibi"%';

-- =====================================================================
-- Mülk sahibi aboneliği
--
-- Kiracılar ücretsizdir. Mülk sahibi hesabı açılınca deneme süresi başlar;
-- süre bitince abonelik yoksa kayıtları salt okunur olur (okuma, mesajlaşma,
-- dışa aktarma ve hesap silme açık kalır). Abonelik durumu mağazalardan
-- (App Store, Google Play, web) RevenueCat üzerinden gelir ve yalnızca
-- sunucu fonksiyonu yazar: supabase/functions/billing.
-- =====================================================================

create table if not exists public.subscriptions (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  entitlement    text not null default 'pro',
  product_id     text,
  store          text,             -- app_store | play_store | stripe | rc_billing | promotional
  period_type    text,             -- normal | trial | intro
  expires_at     timestamptz,      -- null: süresiz (ör. promosyon)
  active         boolean not null default false,
  will_renew     boolean not null default false,
  billing_issue  boolean not null default false,
  environment    text,             -- production | sandbox
  updated_at     timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subs_read_own on public.subscriptions;
create policy subs_read_own on public.subscriptions for select to authenticated using (user_id = auth.uid());
-- Yazma yetkisi yok: satırları yalnızca service_role (billing fonksiyonu) yazar.
grant select on public.subscriptions to authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;

/** Deneme süresi (gün). Uygulama bu değeri my_access() ile okur. */
create or replace function public.trial_days() returns int language sql immutable as $$ select 14 $$;

/** Kullanıcının erişim durumu: rol, deneme, abonelik. */
create or replace function public.access_state(uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  s public.subscriptions;
  subscribed boolean;
  trial_end timestamptz;
begin
  select * into p from public.profiles where id = uid;
  if p.id is null then return jsonb_build_object('access', false); end if;
  select * into s from public.subscriptions where user_id = uid;
  subscribed := s.user_id is not null and s.active and (s.expires_at is null or s.expires_at > now());
  trial_end := p.created_at + make_interval(days => public.trial_days());
  return jsonb_build_object(
    'role', p.role,
    'access', p.role = 'tenant' or subscribed or now() < trial_end,
    'subscribed', subscribed,
    'inTrial', not subscribed and now() < trial_end,
    'trialEnds', trial_end,
    'trialDays', public.trial_days(),
    'expiresAt', s.expires_at,
    'store', s.store,
    'productId', s.product_id,
    'willRenew', coalesce(s.will_renew, false),
    'billingIssue', coalesce(s.billing_issue, false)
  );
end $$;

create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$ select public.access_state(auth.uid()) $$;
grant execute on function public.my_access() to authenticated;
revoke execute on function public.access_state(uuid) from public;

create or replace function public.has_access(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.access_state(uid)->>'access')::boolean, false)
$$;

/** Aboneliği olmayan mülk sahibinin yazmasını engeller. Kiracının işlemleri
    (dekont, talep, yenileme kabulü…) mülk sahibinin aboneliğinden etkilenmez. */
create or replace function public.require_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (select role from public.profiles where id = auth.uid()) = 'landlord'
     and not public.has_access(auth.uid()) then
    raise exception 'Abonelik gerekli: deneme süren bitti' using errcode = 'EV402';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['properties','payments','rent_history','requests','documents',
                           'expenses','property_shared','invites'] loop
    execute format('drop trigger if exists require_access on public.%I', t);
    execute format('create trigger require_access before insert or update on public.%I
                    for each row execute function public.require_access()', t);
  end loop;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'subscriptions') then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Telefon uygulaması bildirimleri: cihaz anahtarları (iOS APNs, Android FCM).
-- Kullanıcı yalnızca kendi cihazlarını görür ve yazar; push fonksiyonu okur.
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text not null check (platform in ('ios','android')),
  created_at  timestamptz not null default now()
);
create index if not exists device_tokens_user on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
drop policy if exists device_own on public.device_tokens;
create policy device_own on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.device_tokens to authenticated;

-- ---------------------------------------------------------------------
-- İç işlevlerin dışarıdan çağrılmasını kapat.
-- Supabase, public şemasındaki işlevleri RPC olarak herkese (anon, authenticated) açar; security definer
-- olan bu üçü RLS'yi aşar. Yabancı biri bildirim gönderebilir, bir yüklemenin denetim durumunu sıfırlayabilirdi.
-- Tetikleyiciler (security definer) sahibin yetkisiyle çalışır; bu kapanıştan etkilenmez.
-- ---------------------------------------------------------------------
revoke execute on function public.notify_members(text, text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.upsert_review(text, text, text, uuid, text, text, numeric) from public, anon, authenticated;
revoke execute on function public.prop_name(text) from public, anon, authenticated;
