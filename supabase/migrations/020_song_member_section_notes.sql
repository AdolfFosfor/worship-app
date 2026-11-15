-- Per-section personal notes on the same private row (JSONB map by chart section id)
alter table public.song_member_notes
  add column if not exists section_notes jsonb not null default '{}'::jsonb;
