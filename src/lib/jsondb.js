// src/lib/jsondb.js
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';

const FILE = 'data.json';

const defaultData = {
  sellers: [],
  purchases: [],
  debts: [],
  productions: [],
  incomes: []
};

// init file kalau belum ada
export async function initDB() {
  const isExist = await exists(FILE, { baseDir: BaseDirectory.AppData });

  if (!isExist) {
    await writeTextFile(FILE, JSON.stringify(defaultData, null, 2), {
      baseDir: BaseDirectory.AppData
    });
  }
}

// baca semua data
export async function readDB() {
  const content = await readTextFile(FILE, {
    baseDir: BaseDirectory.AppData
  });

  return JSON.parse(content);
}

// simpan semua data
export async function writeDB(data) {
  await writeTextFile(FILE, JSON.stringify(data, null, 2), {
    baseDir: BaseDirectory.AppData
  });
}