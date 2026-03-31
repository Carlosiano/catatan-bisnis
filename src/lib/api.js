
// // src/lib/api.js
// const BASE = "http://localhost:3000";

// export async function getDB() {
//   const res = await fetch(`${BASE}/db`);
//   return res.json();
// }

// export async function insert(table, data) {
//   await fetch(`${BASE}/insert`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({ table, data })
//   });
// }



import Database from "@tauri-apps/plugin-sql";

const DB_NAME = "sqlite:catatan_bisnis.db";

export async function getDB() {
  return await Database.load(DB_NAME);
}

export async function initDB() {
  const db = await getDB();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sellers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT);
    
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY, 
      name TEXT NOT NULL, 
      price INTEGER DEFAULT 0,
      defaultUnitId TEXT
    );
    
    CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    
    CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY, sellerId TEXT, item TEXT, jumlah REAL, total INTEGER, 
        tanggal TEXT, catatan TEXT, status TEXT DEFAULT 'lunas', unit TEXT
    );
    
    -- Tabel Debts dengan sisa saldo uang (saldoDPSisa)
    CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY, sellerId TEXT, item TEXT, unit TEXT, harga INTEGER, 
        jumlahJanji REAL, jumlahSisa REAL, uangDibayar INTEGER, saldoDPSisa INTEGER, 
        tanggal TEXT, status TEXT DEFAULT 'hutang'
    );

    -- TABEL BARU: Untuk mencatat histori pengambilan per DP
    CREATE TABLE IF NOT EXISTS debt_transactions (
        id TEXT PRIMARY KEY,
        debtId TEXT,
        jumlahAmbil REAL,
        hargaSaatIni INTEGER,
        totalPotong INTEGER,
        tanggal TEXT,
        FOREIGN KEY(debtId) REFERENCES debts(id) ON DELETE CASCADE
    );
  `);

  // Migrasi kolom baru jika belum ada
  try { await db.execute("ALTER TABLE debts ADD COLUMN saldoDPSisa INTEGER"); } catch (e) { }

  return db;
}

export const dbActions = {
  // --- FUNGSI PURCHASES ---
  async addPurchase(p) {
    const db = await getDB();
    return await db.execute(
      `INSERT INTO purchases (id, sellerId, item, jumlah, total, tanggal, catatan, status, unit) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [crypto.randomUUID(), p.sellerId, p.item, p.jumlah, p.total, new Date().toISOString(), p.catatan, 'lunas', p.unit]
    );
  },

  // --- FUNGSI DEBTS (HUTANG/DP) ---
  async addDebt(d) {
    const db = await getDB();
    const id = crypto.randomUUID();

    // Jika harga kosong, set ke 0 agar tidak error saat perhitungan total awal
    const hargaFinal = d.harga || 0;
    const totalNilai = d.jumlah * hargaFinal;

    return await db.execute(
      `INSERT INTO debts (id, sellerId, item, unit, harga, jumlahJanji, jumlahSisa, uangDibayar, saldoDPSisa, tanggal, status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        d.sellerId,
        d.item,
        d.unit,
        hargaFinal,
        d.jumlah,
        d.jumlah,      // Sisa barang awal = jumlah janji
        d.uangDibayar,
        d.uangDibayar, // Saldo DP awal
        new Date().toISOString(),
        'hutang'
      ]
    );
  },

async getOnlyDebts() {
  const db = await initDB();
  try {
    return await db.select(`
      SELECT d.*, s.name as sellerName 
      FROM debts d
      LEFT JOIN sellers s ON d.sellerId = s.id
      WHERE d.status = 'hutang' AND (d.jumlahSisa > 0 OR d.saldoDPSisa > 0)
      ORDER BY d.tanggal DESC
    `);
  } catch (err) {
    console.error("Gagal ambil data utang:", err);
    return [];
  }
},

  // --- FUNGSI TRANSAKSI GABUNGAN ---
  async getAllTransactions() {
    const db = await initDB();
    const p = await db.select(`
        SELECT id, item, jumlah, total, tanggal, sellerId, unit, catatan, 
        'lunas' as status, 0 as uangDibayar, 0 as jumlahSisa 
        FROM purchases
    `);
    // Ambil semua dari debts tanpa filter status agar yang 'lunas' tetap muncul
    const d = await db.select(`
      SELECT id, item, jumlahJanji as jumlah, uangDibayar as total, tanggal, sellerId, unit, 
      status, uangDibayar, jumlahSisa, saldoDPSisa, harga 
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
    const transactionId = crypto.randomUUID();

    // 1. Catat ke history pengambilan (debt_transactions)
    await db.execute(
      `INSERT INTO debt_transactions (id, debtId, jumlahAmbil, hargaSaatIni, totalPotong, tanggal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
      [transactionId, debt.id, jumlahMasuk, hargaSaatIni, totalPotongDP, new Date().toISOString()]
    );

    // 2. Masukkan ke riwayat pembelian umum (purchases) agar masuk laporan keuangan
    await db.execute(
      `INSERT INTO purchases (id, sellerId, item, jumlah, total, tanggal, status, catatan, unit) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        crypto.randomUUID(),
        debt.sellerId,
        debt.item,
        jumlahMasuk,
        totalPotongDP,
        new Date().toISOString(),
        'lunas',
        `Ambil barang dari DP (Harga: ${hargaSaatIni}/${debt.unit})`,
        debt.unit
      ]
    );

    // 3. Update data DP (Kurangi sisa barang & kurangi sisa uang DP)
    const sisaBarangBaru = debt.jumlahSisa - jumlahMasuk;
    const sisaUangDPBaru = debt.saldoDPSisa - totalPotongDP;

    if (sisaBarangBaru <= 0) {
      // Jika barang sudah diambil semua, hapus atau set lunas
      await db.execute(
        `UPDATE debts SET 
        jumlahSisa = 0, 
        saldoDPSisa = $1, 
        status = 'lunas' 
       WHERE id = $2`,
        [sisaUangDPBaru, debt.id]
      );
    } else {
      await db.execute(
        "UPDATE debts SET jumlahSisa = $1, saldoDPSisa = $2 WHERE id = $3",
        [sisaBarangBaru, sisaUangDPBaru, debt.id]
      );
    }
  },

  async getDebtHistory(debtId) {
    const db = await getDB();
    return await db.select(
      "SELECT * FROM debt_transactions WHERE debtId = $1 ORDER BY tanggal DESC",
      [debtId]
    );
  },

  async returnDebt(debt) {
    const db = await getDB();

    // Fungsi pembantu untuk format ribuan
    const formatUang = (nominal) => {
      return new Intl.NumberFormat('id-ID').format(nominal);
    };

    await db.execute(
      `INSERT INTO purchases (id, sellerId, item, jumlah, total, tanggal, status, catatan) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        debt.sellerId,
        debt.item,
        0,
        0,
        new Date().toISOString(),
        'lunas',
        `Pengembalian DP: Rp ${formatUang(debt.uangDibayar)}` // Output: Rp 1.000.000
      ]
    );
    // Ganti DELETE menjadi UPDATE status
    await db.execute(
      "UPDATE debts SET status = 'returned', jumlahSisa = 0, saldoDPSisa = 0 WHERE id = $1",
      [debt.id]
    );
  }
};
