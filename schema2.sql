create table if not exists aaref_content(key text primary key, value text not null);
alter table aaref_content enable row level security;
