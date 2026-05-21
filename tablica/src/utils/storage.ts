import { Settings, DEFAULT_SETTINGS } from '../types';

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items as Settings);
    });
  });
}

export async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function getLastTabPositions(): Promise<Map<number, { index: number; groupId: number }>> {
  return new Promise((resolve) => {
    chrome.storage.local.get('lastTabPositions', (items) => {
      const map = new Map<number, { index: number; groupId: number }>();
      if (items.lastTabPositions) {
        Object.entries(items.lastTabPositions).forEach(([key, value]) => {
          map.set(parseInt(key), value as { index: number; groupId: number });
        });
      }
      resolve(map);
    });
  });
}

export async function saveLastTabPositions(positions: Map<number, { index: number; groupId: number }>): Promise<void> {
  const obj: Record<string, { index: number; groupId: number }> = {};
  positions.forEach((value, key) => {
    obj[key.toString()] = value;
  });
  return new Promise((resolve) => {
    chrome.storage.local.set({ lastTabPositions: obj }, resolve);
  });
}
