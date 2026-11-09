/**
 * Единый набор Solar (Iconify) для Worship.
 * После добавления имени: `npm run icons:extract`
 */
export const icons = {
  settings: 'settings-bold',
  settingsLinear: 'settings-linear',
  close: 'close-linear',
  arrowLeft: 'arrow-left-bold',
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
  trash: 'trash-bin-trash-linear',
  edit: 'pen-linear',
  save: 'diskette-bold',
  /** Текст / доп. мета песни — iOS-вес как у add-circle */
  documentText: 'document-text-bold',
  copy: 'copy-linear',
  share: 'share-bold',
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
