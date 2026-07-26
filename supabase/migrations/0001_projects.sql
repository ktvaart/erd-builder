-- ERD Builder — projects 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

-- id 를 uuid 가 아니라 text 로 둔 이유:
-- 프로젝트는 로그인 전에 브라우저에서 먼저 만들어질 수 있고, 그때 발급한 로컬 ID 를
-- 그대로 올려야 로그인 시 ID 재매핑 없이 병합할 수 있다.
create table if not exists public.projects (
  id         text primary key,
  owner_id   uuid        not null references auth.users (id) on delete cascade,
  name       text        not null,
  dbms       text        not null default 'mysql',
  -- ERDProject 전체(테이블·컬럼·관계·좌표)를 통째로 담는다.
  -- 서버에서 ERD 내부를 조회할 일이 없으므로 정규화하지 않는다.
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 목록 조회는 항상 "내 프로젝트를 최근 수정순으로"
create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

-- 권한 체크를 애플리케이션 코드가 아니라 DB 가 담당한다.
-- anon key 가 클라이언트에 노출돼도 남의 행에는 접근할 수 없다.
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select using (auth.uid() = owner_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert with check (auth.uid() = owner_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete using (auth.uid() = owner_id);
