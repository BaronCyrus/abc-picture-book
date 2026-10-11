// Tiny persisted state: which letters were finished, parent hint toggle.
const KEY = 'abc-picture-book:v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

const state = { done: {}, zh: false, hinted: false, music: true, ...read() };

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: just keep it in memory */
  }
}

export const store = {
  isDone: (id) => !!state.done[id],
  markDone(id) {
    if (state.done[id]) return false;
    state.done[id] = true;
    save();
    return true;
  },
  get zh() {
    return state.zh;
  },
  set zh(v) {
    state.zh = !!v;
    save();
  },
  /** has the "tap a letter" hand already done its job? */
  get hinted() {
    return state.hinted;
  },
  set hinted(v) {
    state.hinted = !!v;
    save();
  },
  /** background music on the home page */
  get music() {
    return state.music;
  },
  set music(v) {
    state.music = !!v;
    save();
  },
};

/** Session-only memory (not persisted). */
export const session = { introPlayed: false, lastLetter: null };
