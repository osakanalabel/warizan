// localStorage の読み書きだけを受けもつ。サーバーには何も送らない。
// プライベートブラウズなどで使えないことがあるので、必ず try/catch でかこむ。

import { emptyStats, normalize } from './core/stats.js';

export const STORAGE_KEY = 'warizan.stats.v1';

export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export function clearStats() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 消せなくても先へ進む
  }
  return emptyStats();
}

export function storageWorks() {
  try {
    const probe = `${STORAGE_KEY}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
