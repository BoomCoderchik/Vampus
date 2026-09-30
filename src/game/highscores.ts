export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  bites: number;
  maxCombo: number;
  date: number;
}

const KEY = 'vamp-highscores-v1';
const NAME_KEY = 'vamp-player-name';
export const MAX_ENTRIES = 10;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveScores(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore */
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'NOSFERATU';
  } catch {
    return 'NOSFERATU';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Inserts an entry; returns new list and the entry's rank (1-based) or -1 if it didn't qualify. */
export function insertScore(entry: ScoreEntry): { list: ScoreEntry[]; rank: number } {
  const list = [...loadScores(), entry].sort((a, b) => b.score - a.score || b.date - a.date).slice(0, MAX_ENTRIES);
  const rank = list.findIndex((e) => e.id === entry.id);
  saveScores(list);
  return { list, rank: rank === -1 ? -1 : rank + 1 };
}

export function renameEntry(id: string, name: string): ScoreEntry[] {
  const list = loadScores().map((e) => (e.id === id ? { ...e, name } : e));
  saveScores(list);
  return list;
}
