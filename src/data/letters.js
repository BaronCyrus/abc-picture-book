import raw from './letters.json';
import timings from './timings.json';

export const PALETTE = {
  red: { base: '#E9523C', dark: '#C23A28', light: '#F8B3A6' },
  orange: { base: '#F28B30', dark: '#CC6A12', light: '#FBCB9C' },
  yellow: { base: '#F4B81F', dark: '#C98F00', light: '#FCE29A' },
  green: { base: '#6FB34A', dark: '#4C8C2E', light: '#BFE0A8' },
  teal: { base: '#2FAE9E', dark: '#1B8275', light: '#A3DED5' },
  blue: { base: '#3F93D6', dark: '#276FAE', light: '#A9D2F1' },
  indigo: { base: '#6470D2', dark: '#4650AC', light: '#B9BEEF' },
  purple: { base: '#9C60C6', dark: '#78409D', light: '#D5B8E8' },
  pink: { base: '#E5619F', dark: '#BD3F7C', light: '#F6B9D5' },
};

/** Sprite name for a word: "ice cream" -> "icecream", "yo-yo" -> "yoyo" */
const artName = (word) => word.replace(/[^a-z]/g, '');

export const LETTERS = raw.map((e, index) => ({
  ...e,
  index,
  upper: e.id.toUpperCase(),
  lower: e.id,
  art: artName(e.word),
  hl: e.hl || [0],
  pal: PALETTE[e.color],
}));

export const byId = Object.fromEntries(LETTERS.map((l) => [l.id, l]));

export const VOICES = ['ava', 'ana'];

export const clip = (voice, kind, id) => `audio/${voice}/${kind}/${id}.mp3`;

export function timing(voice, kind, id) {
  return timings[voice]?.[`${kind}/${id}`] || null;
}
