// src/lib/api.js
import Database from "@tauri-apps/plugin-sql";

// Selalu gunakan SQLite di laptop maupun di Android
const DB_NAME = "sqlite:catatan_bisnis.db";

export async function getDB() {
  return await Database.load(DB_NAME);
}

export async function initDB() {
  const db = await getDB();

  // 1. Skema tabel murni menggunakan standard data type SQLite
  const queries = [
    `CREATE TABLE IF NOT EXISTS sellers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT)`,
    `CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER DEFAULT 0, "defaultUnitId" TEXT)`,
    `CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, "sellerId" TEXT REFERENCES sellers(id), item TEXT, jumlah REAL, total INTEGER, tanggal DATETIME DEFAULT CURRENT_TIMESTAMP, catatan TEXT, status TEXT DEFAULT 'lunas', unit TEXT)`,
    `CREATE TABLE IF NOT EXISTS debts (id TEXT PRIMARY KEY, "sellerId" TEXT REFERENCES sellers(id), item TEXT, unit TEXT, harga INTEGER, "jumlahJanji" REAL, "jumlahSisa" REAL, "uangDibayar" INTEGER, "saldoDPSisa" INTEGER, tanggal DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'hutang')`,
    `CREATE TABLE IF NOT EXISTS debt_transactions (id TEXT PRIMARY KEY, "debtId" TEXT REFERENCES debts(id) ON DELETE CASCADE, "jumlahAmbil" REAL, "hargaSaatIni" INTEGER, "totalPotong" INTEGER, tanggal DATETIME DEFAULT CURRENT_TIMESTAMP, itemName TEXT, transactionUnit TEXT)`
  ];

  for (const query of queries) {
    await db.execute(query);
  }

  // 2. SEEDING OTOMATIS: Mengisi master barang & satuan bawaan jika database baru kosong
  try {
    const existingItems = await db.select("SELECT id FROM items LIMIT 1");
    if (existingItems.length === 0) {
      // Data master yang ingin dimasukkan awal rilis
      const defaultData = [
        { item: "kelapa", unit: "subur" },
        { item: "kemiri", unit: "kg" },
        { item: "kopra", unit: "kg" },
        { item: "mente", unit: "kg" },
        { item: "porang", unit: "kg" },
        { item: "tempurung", unit: "kg" },
        { item: "kakao", unit: "kg" }
      ];

      for (const data of defaultData) {
        const itemId = crypto.randomUUID();
        const unitId = crypto.randomUUID();

        // Masukkan nama satuan ke tabel units jika belum terdaftar
        const checkUnit = await db.select("SELECT id FROM units WHERE name = $1 LIMIT 1", [data.unit]);
        let finalUnitId = checkUnit.length > 0 ? checkUnit[0].id : unitId;

        if (checkUnit.length === 0) {
          await db.execute("INSERT INTO units (id, name) VALUES ($1, $2)", [finalUnitId, data.unit]);
        }

        // Masukkan nama komoditas ke tabel items lengkap dengan relasi id satuannya
        await db.execute('INSERT INTO items (id, name, "defaultUnitId") VALUES ($1, $2, $3)', [
          itemId,
          data.item,
          finalUnitId
        ]);
      }
      console.log("Seeding master data bawaan sukses diterapkan.");
    }
  } catch (seedError) {
    console.error("Gagal melakukan seeding data bawaan:", seedError);
  }

  return db;
}

export const dbActions = {
  async getDB() {
    return await getDB();
  },

  async addPurchase(data) {
    const db = await getDB();
    return await db.execute(
      `INSERT INTO purchases (id, "sellerId", item, jumlah, total, catatan, status, unit) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [crypto.randomUUID(), data.sellerId, data.item, data.jumlah, data.total, data.catatan, 'lunas', data.unit]
    );
  },

  async addDebt(debt) {
    const db = await initDB();
    const query = `
      INSERT INTO debts (id, "sellerId", item, unit, "jumlahJanji", "jumlahSisa", "uangDibayar", "saldoDPSisa", tanggal, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    try {
      await db.execute(query, [
        crypto.randomUUID(),
        debt.sellerId,
        debt.item,
        debt.unit,
        Number(debt.jumlahJanji) || 0,
        Number(debt.jumlahJanji) || 0,
        Number(debt.uangDibayar),
        Number(debt.uangDibayar),
        debt.tanggal, // String format YYYY-MM-DD langsung masuk dengan aman ke DATETIME SQLite
        'hutang'
      ]);
      return true;
    } catch (err) {
      console.error("Database Error (Save Debt):", err);
      throw err;
    }
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
    return await db.select("SELECT * FROM sellers ORDER BY name ASC");
  },

  // src/lib/api.js

  async getDebtHistory(debtId) {
    const db = await initDB();
    try {
      // 1. Ambil data sellerId terlebih dahulu untuk melacak seluruh transaksi milik petani ini
      const debtInfo = await db.select(`SELECT "sellerId" FROM debts WHERE id = $1 LIMIT 1`, [debtId]);
      if (debtInfo.length === 0) return [];
      const sellerId = debtInfo[0].sellerId;

      // 2. Query UNION: Menggabungkan riwayat pendaftaran PANJAR BARU dan riwayat POTONG BARANG/RETUR
      return await db.select(`
        -- JALUR A: Ambil riwayat setiap kali kasir MENAMBAH/MENCAIRKAN uang panjar baru ke petani
        SELECT 
          id,
          0 as "jumlahAmbil",
          0 as "hargaSaatIni",
          "uangDibayar" as "totalPotong",
          tanggal,
          'Suntik Saldo Panjar Baru' as itemName,
          unit as transactionUnit,
          'tambah' as tipeMutasi
        FROM debts
        WHERE "sellerId" = $1
        
        UNION ALL
        
        -- JALUR B: Ambil riwayat setiap kali petani POTONG UTANG (terima barang atau retur uang tunai)
        SELECT 
          id,
          "jumlahAmbil",
          "hargaSaatIni",
          "totalPotong",
          tanggal,
          itemName,
          transactionUnit,
          'potong' as tipeMutasi
        FROM debt_transactions
        WHERE "debtId" IN (SELECT id FROM debts WHERE "sellerId" = $1)
        
        ORDER BY tanggal DESC
      `, [sellerId]);
    } catch (err) {
      console.error("Gagal memuat riwayat gabungan panjar:", err);
      return [];
    }
  },

  async getOnlyDebts() {
    const db = await initDB();
    try {
      // PERBAIKAN UTAMA: Menggabungkan (Group By) panjar berdasarkan sellerId
      return await db.select(`
        SELECT 
          d.id, 
          d."sellerId", 
          d.item, 
          d.unit, 
          SUM(d."jumlahJanji") as "jumlahJanji", 
          SUM(d."jumlahSisa") as "jumlahSisa", 
          SUM(d."uangDibayar") as "uangDibayar", 
          SUM(d."saldoDPSisa") as "saldoDPSisa", 
          MAX(d.tanggal) as tanggal, 
          d.status, 
          s.name as "sellerName"
        FROM debts d
        LEFT JOIN sellers s ON d."sellerId" = s.id
        WHERE d.status = 'hutang'
        GROUP BY d."sellerId"
        
        UNION ALL
        
        -- Tetap tampilkan yang lunas secara individual di tab riwayat lunas
        SELECT 
          d.id, d."sellerId", d.item, d.unit, d."jumlahJanji", d."jumlahSisa", 
          d."uangDibayar", d."saldoDPSisa", d.tanggal, d.status, s.name as "sellerName"
        FROM debts d
        LEFT JOIN sellers s ON d."sellerId" = s.id
        WHERE d.status != 'hutang'
        ORDER BY tanggal DESC
      `);
    } catch (err) {
      console.error("Database Error (Load debts grouped):", err);
      return [];
    }
  },

  // BARU: Fungsi untuk mengedit data induk panjar
  async updateDebt(id, item, unit, jumlahJanji, jumlahSisa) {
    const db = await getDB();
    return await db.execute(
      `UPDATE debts SET 
        item = $1, 
        unit = $2, 
        "jumlahJanji" = $3, 
        "jumlahSisa" = $4 
       WHERE id = $5`,
      [item, unit, Number(jumlahJanji) || 0, Number(jumlahSisa) || 0, id]
    );
  },
  // BARU: Fungsi untuk mencatat pengembalian uang tunai sebagian atau seluruhnya
  async partialReturnDebt(debt, nominalKembali, isLunasSemua) {
    const db = await getDB();
    const formatUang = (nominal) => new Intl.NumberFormat('id-ID').format(nominal);

    // 1. Catat uang masuk ke log purchases sebagai arus kas masuk kembalian
    await db.execute(
      `INSERT INTO purchases (id, "sellerId", item, jumlah, total, tanggal, status, catatan, unit) 
       VALUES ($1, $2, $3, 0, 0, CURRENT_TIMESTAMP, 'lunas', $4, '-')`,
      [
        crypto.randomUUID(),
        debt.sellerId,
        debt.item,
        `Pengembalian Uang DP Tunai: Rp ${formatUang(nominalKembali)}`
      ]
    );

    // 2. Catat ke debt_transactions agar muncul di riwayat modal berjalan
    await db.execute(
      `INSERT INTO debt_transactions (id, "debtId", "jumlahAmbil", "hargaSaatIni", "totalPotong", tanggal, itemName, transactionUnit)
       VALUES ($1, $2, 0, 0, $3, CURRENT_TIMESTAMP, $4, '-')`,
      [crypto.randomUUID(), debt.id, nominalKembali, "Pengembalian Tunai"]
    );

    // 3. Update saldo di tabel debts
    const saldoBaru = Math.max(0, debt.saldoDPSisa - nominalKembali);
    const statusBaru = isLunasSemua || saldoBaru <= 0 ? 'returned' : 'hutang';
    const sisaBarangBaru = isLunasSemua || saldoBaru <= 0 ? 0 : debt.jumlahSisa;

    // Jika di-grup, kita update seluruh baris hutang milik petani ini agar adil memotong saldo
    await db.execute(
      `UPDATE debts SET 
        "saldoDPSisa" = "saldoDPSisa" - $1,
        status = CASE WHEN "saldoDPSisa" - $1 <= 0 THEN 'returned' ELSE 'hutang' END,
        "jumlahSisa" = CASE WHEN "saldoDPSisa" - $1 <= 0 THEN 0 ELSE "jumlahSisa" END
       WHERE "sellerId" = $2 AND status = 'hutang'`,
      [nominalKembali, debt.sellerId]
    );
  },

  async getAllTransactions() {
    const db = await initDB();
    return await db.select(`
      SELECT p.id, p.item, p.jumlah, p.total, p.tanggal, p."sellerId", p.unit, p.catatan, p.status, s.name as "sellerName"
      FROM purchases p
      LEFT JOIN sellers s ON p."sellerId" = s.id
      ORDER BY p.tanggal DESC
    `);
  },

  async deleteTransaction(id, status) {
    const db = await getDB();
    const table = status === "hutang" || status === "lunas-dp" ? "debts" : "purchases";
    return await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
  },



  async settleDebt(debt, jumlahMasuk, hargaSaatIni, nominalPotongManual) {
    const db = await getDB();

    const totalNilaiBarang = jumlahMasuk * hargaSaatIni;
    const sellerIdFix = debt.sellerId || null;

    // Amankan agar barang & satuan otomatis terdaftar di Master Data
    const namaBarangClean = debt.item ? debt.item.trim().toLowerCase() : "";
    const namaSatuanClean = debt.unit ? debt.unit.trim().toLowerCase() : "";

    if (namaBarangClean !== "") {
      const existingItem = await db.select("SELECT id FROM items WHERE name = $1 LIMIT 1", [namaBarangClean]);
      if (existingItem.length === 0) {
        await db.execute("INSERT INTO items (id, name) VALUES ($1, $2)", [
          crypto.randomUUID(),
          namaBarangClean
        ]);
      }
    }

    if (namaSatuanClean !== "") {
      const existingUnit = await db.select("SELECT id FROM units WHERE name = $1 LIMIT 1", [namaSatuanClean]);
      if (existingUnit.length === 0) {
        await db.execute("INSERT INTO units (id, name) VALUES ($1, $2)", [
          crypto.randomUUID(),
          namaSatuanClean
        ]);
      }
    }

    let porsiPotongDP = nominalPotongManual !== undefined && nominalPotongManual !== null
      ? Math.min(Number(debt.saldoDPSisa), Number(nominalPotongManual)) // <-- TAMBAHKAN Math.min DI SINI
      : Math.min(Number(debt.saldoDPSisa), totalNilaiBarang);

    let uangTambahanBayar = Math.max(0, totalNilaiBarang - porsiPotongDP);

    let teksCatatan = `Potong dari Panjar: Rp ${porsiPotongDP.toLocaleString('id-ID')}`;
    if (uangTambahanBayar > 0) {
      teksCatatan += ` | Bayar Tunai ke Petani: Rp ${uangTambahanBayar.toLocaleString('id-ID')}`;
    }

    // Masukkan data transaksi ke tabel purchases
    await db.execute(`
  INSERT INTO purchases (id, "sellerId", item, jumlah, total, tanggal, unit, catatan, status)
  VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8)
`, [
      crypto.randomUUID(),
      sellerIdFix,
      debt.item,
      jumlahMasuk,
      totalNilaiBarang,
      debt.unit,
      teksCatatan,
      'lunas'
    ]);

    // --- DI SINI PERBAIKANNYA: Petakan parameter $6 ke kolom itemName ---
    await db.execute(
      `INSERT INTO debt_transactions (id, "debtId", "jumlahAmbil", "hargaSaatIni", "totalPotong", tanggal, itemName, transactionUnit)
   VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)`,
      [
        crypto.randomUUID(),
        debt.id,
        jumlahMasuk,
        hargaSaatIni,
        porsiPotongDP,
        debt.item,
        debt.unit // <-- Sekarang teks "ton" / "subur" akan tersimpan dengan aman ke parameter $7
      ]
    );

    // Update saldo induk di tabel debts
    const sisaUangDPBaru = Math.max(0, debt.saldoDPSisa - porsiPotongDP);
    const sisaBarangBaru = debt.jumlahJanji > 0 ? Math.max(0, debt.jumlahSisa - jumlahMasuk) : 0;
    const statusBaru = sisaUangDPBaru <= 0 ? 'lunas-dp' : 'hutang';

    await db.execute(
      `UPDATE debts SET 
        "jumlahSisa" = $1, 
        "saldoDPSisa" = $2, 
        status = $3 
       WHERE id = $4`,
      [sisaBarangBaru, sisaUangDPBaru, statusBaru, debt.id]
    );
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
      // Tarik nama barang sekaligus nama satuan bawaannya dari tabel units
      return await db.select(`
        SELECT i.id, i.name, u.name as defaultUnitName 
        FROM items i
        LEFT JOIN units u ON i."defaultUnitId" = u.id
        ORDER BY i.name ASC
      `);
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
  },

  async getOrCreateSeller(name) {
    if (!name) return null;
    const db = await initDB();
    const existing = await db.select("SELECT id FROM sellers WHERE name = $1 LIMIT 1", [name]);
    if (existing.length > 0) return existing[0].id;

    const newId = crypto.randomUUID();
    await db.execute("INSERT INTO sellers (id, name) VALUES ($1, $2)", [newId, name]);
    return newId;
  }
};