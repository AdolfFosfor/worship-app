-- Structured song lyrics with chord anchors on lines (links into chord_chart item ids).

alter table public.songs
  add column if not exists lyrics_doc jsonb;

comment on column public.songs.lyrics_doc is
  'Structured lyrics JSON (v1): blocks → lines → anchors { itemId, offset }';
