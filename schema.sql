create table if not exists aaref_codes(
  code text primary key,
  days int not null default 30,
  note text,
  created_at timestamptz not null default now(),
  revoked boolean not null default false,
  redeemed_at timestamptz,
  redeemed_device text
);
create table if not exists aaref_subs(
  id bigserial primary key,
  device_id text not null,
  code text references aaref_codes(code),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  cancelled boolean not null default false
);
create index if not exists aaref_subs_device on aaref_subs(device_id);
create table if not exists aaref_requests(
  id bigserial primary key,
  device_id text,
  contact text,
  note text,
  status text not null default 'pending',
  code text,
  created_at timestamptz not null default now()
);
create table if not exists aaref_tests(
  id bigserial primary key,
  device_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  archetype text,
  scores jsonb
);
create index if not exists aaref_tests_device on aaref_tests(device_id);
create table if not exists aaref_questions(
  id int primary key,
  axis text not null,
  text text not null,
  options jsonb not null,
  active boolean not null default true
);
create table if not exists aaref_events(
  id bigserial primary key,
  device_id text,
  kind text not null,
  created_at timestamptz not null default now()
);
alter table aaref_codes enable row level security;
alter table aaref_subs enable row level security;
alter table aaref_requests enable row level security;
alter table aaref_tests enable row level security;
alter table aaref_questions enable row level security;
alter table aaref_events enable row level security;
