-- Structured chord chart (sections → bars → chords / annotations)

alter table public.songs
  add column if not exists chord_chart jsonb;

comment on column public.songs.chord_chart is
  'Structured chord chart JSON (v1): timeSignature, sections → bars → items';
