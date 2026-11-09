-- Optional tempo (BPM) for songs
alter table public.songs
  add column if not exists bpm integer
    check (bpm is null or (bpm >= 30 and bpm <= 300));

comment on column public.songs.bpm is
  'Optional tempo in beats per minute; null when unset';
