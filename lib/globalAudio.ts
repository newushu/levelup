type SoundEntry = { url: string; volume?: number; loop?: boolean };
type SoundMap = Record<string, SoundEntry>;

type GlobalAudioStore = {
  sounds: SoundMap;
  sfx?: HTMLAudioElement;
  music?: HTMLAudioElement;
  musicKey?: string;
  fadeTimer?: number;
};

function getStore(): GlobalAudioStore | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { __globalAudioStore?: GlobalAudioStore };
  if (!w.__globalAudioStore) {
    w.__globalAudioStore = { sounds: {} };
  }
  return w.__globalAudioStore ?? null;
}

export function setGlobalSounds(map: SoundMap) {
  const store = getStore();
  if (!store) return;
  store.sounds = map;
}

export function playGlobalSfx(key: string) {
  const store = getStore();
  if (!store) return false;
  const entry = store.sounds[key];
  if (!entry?.url) return false;
  if (!store.sfx) store.sfx = new Audio();
  const audio = store.sfx;
  audio.pause();
  audio.src = entry.url;
  audio.volume = Math.min(1, Math.max(0, Number(entry.volume ?? 1)));
  audio.loop = false;
  audio.currentTime = 0;
  audio.play().catch(() => {});
  return true;
}

export function playGlobalMusic(key: string) {
  const store = getStore();
  if (!store) return false;
  const entry = store.sounds[key];
  if (!entry?.url) return false;
  if (!store.music) store.music = new Audio();
  const audio = store.music;
  if (store.fadeTimer) {
    window.clearInterval(store.fadeTimer);
    store.fadeTimer = undefined;
  }
  if (store.musicKey !== key || audio.src !== entry.url) {
    audio.pause();
    audio.src = entry.url;
  }
  store.musicKey = key;
  audio.volume = Math.min(1, Math.max(0, Number(entry.volume ?? 1)));
  audio.loop = entry.loop !== false;
  audio.play().catch(() => {});
  return true;
}

export function fadeOutGlobalMusic(ms = 1200) {
  const store = getStore();
  if (!store?.music) return;
  const audio = store.music;
  const start = audio.volume;
  const startAt = Date.now();
  if (store.fadeTimer) window.clearInterval(store.fadeTimer);
  store.fadeTimer = window.setInterval(() => {
    const elapsed = Date.now() - startAt;
    const pct = Math.min(1, elapsed / Math.max(1, ms));
    audio.volume = Math.max(0, start * (1 - pct));
    if (pct >= 1) {
      audio.pause();
      audio.currentTime = 0;
      if (store.fadeTimer) window.clearInterval(store.fadeTimer);
      store.fadeTimer = undefined;
    }
  }, 80);
}
