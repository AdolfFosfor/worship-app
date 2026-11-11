/**
 * Единый набор Solar (Iconify) для Worship.
 * После добавления имени: `npm run icons:extract`
 */
export const icons = {
  settings: 'settings-bold',
  settingsLinear: 'settings-linear',
  close: 'close-linear',
  arrowLeft: 'arrow-left-bold',
  arrowRight: 'arrow-right-bold',
  chevronRight: 'alt-arrow-right-linear',
  home: 'home-2-bold',
  homeLinear: 'home-2-linear',
  music: 'music-note-bold',
  musicLinear: 'music-note-linear',
  playlist: 'playlist-bold',
  playlistLinear: 'playlist-linear',
  users: 'users-group-rounded-bold',
  usersLinear: 'users-group-rounded-linear',
  add: 'add-circle-bold',
  search: 'magnifier-linear',
  filter: 'filters-bold',
  trash: 'trash-bin-trash-linear',
  edit: 'pen-linear',
  save: 'diskette-bold',
  /** Текст песни (lyrics) */
  documentText: 'document-text-bold',
  /** Меню характеристик песни: текст, тип, тематика, размер, темп */
  extras: 'widget-5-bold',
  tag: 'tag-bold',
  tagHorizontal: 'tag-horizontal-bold',
  notes: 'music-notes-bold',
  copy: 'copy-linear',
  share: 'share-bold',
  fullscreen: 'full-screen-bold',
  link: 'link-round-linear',
  youtube: 'play-circle-bold',
  up: 'alt-arrow-up-linear',
  down: 'alt-arrow-down-linear',
  grip: 'hamburger-menu-linear',
  minus: 'minus-circle-linear',
  plus: 'add-circle-linear',
  capo: 'tuning-2-bold',
  /** Нет капо / отсутствие значения */
  none: 'forbidden-circle-linear',
  undo: 'undo-left-linear',
  redo: 'undo-right-linear',
} as const

export type AppIconName = (typeof icons)[keyof typeof icons]
