// src/lib/api.js
import Database from "@tauri-apps/plugin-sql";

// Ganti sesuai dengan konfigurasi Postgres Anda
// format: postgres://user:password@host:port/dbname
const DB_URL = "postgres://kalo:kalo@localhost:5432/catatan_bisnis";

export async function getDB() {
  try {
    return await Database.load(DB_URL);
  } catch (e) {
    console.error("Koneksi Database Gagal:", e);
    throw e;
  }
}

export async function initDB() {
  const db = await getDB();

  // Pecah menjadi satu-satu
  const queries = [
    `CREATE TABLE IF NOT EXISTS sellers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT)`,
    `CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER DEFAULT 0, "defaultUnitId" TEXT)`,
    `CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, "sellerId" TEXT REFERENCES sellers(id), item TEXT, jumlah REAL, total INTEGER, tanggal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, catatan TEXT, status TEXT DEFAULT 'lunas', unit TEXT)`,
    `CREATE TABLE IF NOT EXISTS debts (id TEXT PRIMARY KEY, "sellerId" TEXT REFERENCES sellers(id), item TEXT, unit TEXT, harga INTEGER, "jumlahJanji" REAL, "jumlahSisa" REAL, "uangDibayar" INTEGER, "saldoDPSisa" INTEGER, tanggal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'hutang')`,
    `CREATE TABLE IF NOT EXISTS debt_transactions (id TEXT PRIMARY KEY, "debtId" TEXT REFERENCES debts(id) ON DELETE CASCADE, "jumlahAmbil" DECIMAL, "hargaSaatIni" INTEGER, "totalPotong" INTEGER, tanggal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`
  ];

  // Jalankan satu per satu
  for (const query of queries) {
    await db.execute(query);
  }

  return db;
}

// export async function initDB() {
//   const db = await getDB();

//   // PostgreSQL menggunakan tipe data yang lebih ketat
//   await db.execute(`
//     CREATE TABLE IF NOT EXISTS sellers (
//         id TEXT PRIMARY KEY, 
//         name TEXT NOT NULL, 
//         phone TEXT
//     );

//     CREATE TABLE IF NOT EXISTS items (
//       id TEXT PRIMARY KEY, 
//       name TEXT NOT NULL, 
//       price INTEGER DEFAULT 0,
//       "defaultUnitId" TEXT
//     );

//     CREATE TABLE IF NOT EXISTS units (
//         id TEXT PRIMARY KEY, 
//         name TEXT NOT NULL
//     );

//     CREATE TABLE IF NOT EXISTS purchases (
//         id TEXT PRIMARY KEY, 
//         "sellerId" TEXT REFERENCES sellers(id), 
//         item TEXT, 
//         jumlah DECIMAL, 
//         total INTEGER, 
//         tanggal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
//         catatan TEXT, 
//         status TEXT DEFAULT 'lunas', 
//         unit TEXT
//     );

//     CREATE TABLE IF NOT EXISTS debts (
//         id TEXT PRIMARY KEY, 
//         "sellerId" TEXT REFERENCES sellers(id), 
//         item TEXT, 
//         unit TEXT, 
//         harga INTEGER, 
//         "jumlahJanji" DECIMAL, 
//         "jumlahSisa" DECIMAL, 
//         "uangDibayar" INTEGER, 
//         "saldoDPSisa" INTEGER, 
//         tanggal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
//         status TEXT DEFAULT 'hutang'
//     );

//     CREATE TABLE IF NOT EXISTS debt_transactions (
//         id TEXT PRIMARY KEY,
//         "debtId" TEXT REFERENCES debts(id) ON DELETE CASCADE,
//         "jumlahAmbil" DECIMAL,
//         "hargaSaatIni" INTEGER,
//         "totalPotong" INTEGER,
//         tanggal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
//     );
//   `);

//   return db;
// }

export const dbActions = {
  // --- FUNGSI PURCHASES ---
  async addPurchase(data) {
    const db = await getDB();
    return await db.execute(
      // Perhatikan tanda petik ganda pada "sellerId"
      `INSERT INTO purchases (id, "sellerId", item, jumlah, total, catatan, status, unit) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [crypto.randomUUID(), data.sellerId, data.item, data.jumlah, data.total, data.catatan, 'lunas', data.unit]
    );
  },


  // --- FUNGSI DEBTS ---
  async addDebt(data) {
    const db = await getDB();
    return await db.execute(
      // Postgres mewajibkan petik ganda untuk identifier Case-Sensitive
      `INSERT INTO debts (id, "sellerId", item, unit, harga, "jumlahJanji", "jumlahSisa", "uangDibayar", "saldoDPSisa", status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        crypto.randomUUID(),
        data.sellerId,
        data.item,
        data.unit,
        data.harga,
        data.jumlah, // jumlahJanji
        data.jumlah, // jumlahSisa awal sama dengan janji
        data.uangDibayar,
        data.uangDibayar, // saldoDPSisa awal
        'hutang'
      ]
    );
  },

  async addSeller(s) {
    const db = await getDB();
    return await db.execute(
      `INSERT INTO sellers (id, name, phone) VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), s.name, s.phone]
    );
  },

  async getSellers() {
    const db = await initDB();
    const result = await db.select("SELECT * FROM sellers ORDER BY name ASC");
    console.log("Data penjual dari DB:", result); // Tambahkan log ini untuk cek di terminal/console
    return result;
  },

  // src/lib/api.js

  // src/lib/api.js

  async getOnlyDebts() {
    const db = await initDB();
    try {
      return await db.select(`
      SELECT 
        d.id, 
        d."sellerId",          -- WAJIB ADA: Agar ID penjual tidak hilang saat dipilih
        d.item, 
        d.unit, 
        d.harga, 
        d."jumlahJanji"::FLOAT as "jumlahJanji", 
        d."jumlahSisa"::FLOAT as "jumlahSisa", 
        d."uangDibayar", 
        d."saldoDPSisa"::FLOAT as "saldoDPSisa", 
        d.tanggal, 
        d.status,
        s.name as "sellerName" 
      FROM debts d
      LEFT JOIN sellers s ON d."sellerId" = s.id
      WHERE d.status = 'hutang' 
      AND (d."jumlahSisa" > 0 OR d."saldoDPSisa" > 0)
      ORDER BY d.tanggal DESC
    `);
    } catch (err) {
      console.error("Gagal ambil data utang:", err);
      return [];
    }
  },

  async getAllTransactions() {
    const db = await initDB();

    const p = await db.select(`
    SELECT 
        id, 
        item, 
        jumlah::FLOAT, 
        total, 
        tanggal::TEXT as tanggal, -- Tambahkan ::TEXT di sini
        "sellerId", 
        unit, 
        catatan, 
        'lunas' as status, 
        0 as "uangDibayar", 
        0 as "jumlahSisa", 
        0 as "saldoDPSisa"
    FROM purchases
    `);

    const d = await db.select(`
    SELECT 
        id, 
        item, 
        "jumlahJanji"::FLOAT as jumlah, 
        "uangDibayar" as total, 
        tanggal::TEXT as tanggal, -- Sudah benar ::TEXT
        "sellerId", 
        unit, 
        status, 
        "uangDibayar", 
        "jumlahSisa"::FLOAT as "jumlahSisa", 
        "saldoDPSisa"::FLOAT as "saldoDPSisa", 
        harga 
    FROM debts
    `);

    return [...p, ...d].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  },

  async deleteTransaction(id, status) {
    const db = await getDB();
    const table = status === "hutang" ? "debts" : "purchases";
    return await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
  },

  // --- LOGIKA TERIMA BARANG (SETTLE) ---
  async settleDebt(debt, jumlahMasuk, hargaSaatIni) {
    const db = await getDB();
    const totalPotongDP = jumlahMasuk * hargaSaatIni;
    const sellerIdFix = debt.sellerId || null;

    // 1. Masukkan ke tabel purchases (HANYA SATU KALI)
    // Pastikan debt.sellerId masuk agar tidak jadi "Anonim"
    await db.execute(`
        INSERT INTO purchases (id, "sellerId", item, jumlah, total, tanggal, unit, catatan, status)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8)
    `, [
      crypto.randomUUID(),
      sellerIdFix,           // Mengambil ID penjual dari data DP
      debt.item,
      jumlahMasuk,
      totalPotongDP,           // Total harga barang yang diterima
      debt.unit,
      `Terima dari DP: ${debt.item}`,
      'lunas'
    ]);

    // 2. Catat ke history (Opsional jika Anda pakai tabel ini)
    await db.execute(
      `INSERT INTO debt_transactions (id, "debtId", "jumlahAmbil", "hargaSaatIni", "totalPotong", tanggal)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [crypto.randomUUID(), debt.id, jumlahMasuk, hargaSaatIni, totalPotongDP]
    );

    // 3. Update data DP (Sisa Barang & Sisa Saldo)
    const sisaBarangBaru = debt.jumlahSisa - jumlahMasuk;
    const sisaUangDPBaru = debt.saldoDPSisa - totalPotongDP;

    if (sisaBarangBaru <= 0) {
      await db.execute(
        `UPDATE debts SET "jumlahSisa" = 0, "saldoDPSisa" = $1, status = 'lunas-dp' WHERE id = $2`,
        [sisaUangDPBaru, debt.id]
      );
    } else {
      await db.execute(
        `UPDATE debts SET "jumlahSisa" = $1, "saldoDPSisa" = $2 WHERE id = $3`,
        [sisaBarangBaru, sisaUangDPBaru, debt.id]
      );
    }
  },

  async returnDebt(debt) {
    const db = await getDB();
    const formatUang = (nominal) => new Intl.NumberFormat('id-ID').format(nominal);

    await db.execute(
      `INSERT INTO purchases (id, "sellerId", item, jumlah, total, tanggal, status, catatan) 
       VALUES ($1, $2, $3, 0, 0, CURRENT_TIMESTAMP, 'lunas', $4)`,
      [crypto.randomUUID(), debt.sellerId, debt.item, `Pengembalian DP: Rp ${formatUang(debt.uangDibayar)}`]
    );

    await db.execute(
      `UPDATE debts SET status = 'returned', "jumlahSisa" = 0, "saldoDPSisa" = 0 WHERE id = $1`,
      [debt.id]
    );
  },
  async getItems() {
    const db = await initDB();
    try {
      // Ambil data unik dari tabel items
      return await db.select("SELECT * FROM items ORDER BY name ASC");
    } catch (err) {
      console.error("Gagal getItems:", err);
      return [];
    }
  },

  async getUnits() {
    const db = await initDB();
    try {
      return await db.select("SELECT * FROM units ORDER BY name ASC");
    } catch (err) {
      console.error("Gagal getUnits:", err);
      return [];
    }
  }
};
