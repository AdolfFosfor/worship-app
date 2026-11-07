-- Capo fret for chord shapes (0 = without capo)
alter table public.songs
  add column if not exists capo integer not null default 0
    check (capo >= 0 and capo <= 11);

comment on column public.songs.capo is
  'Fret where capo is placed; chords are written as shapes with this capo';
