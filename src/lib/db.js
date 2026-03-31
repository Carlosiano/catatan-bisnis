import Database from "@tauri-apps/plugin-sql";

export async function initDB() {
    // Membuka atau membuat file sqlite baru bernama "warung.db"
    // Di Mobile/Desktop, file ini akan tersimpan di folder data aplikasi yang aman
    const db = await Database.load("sqlite:warung.db");

    // Menjalankan perintah pembuatan tabel
    await db.execute(`
        CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            is_synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS purchases (
            id TEXT PRIMARY KEY,
            sellerId TEXT,
            item TEXT,
            jumlah REAL,
            total INTEGER,
            tanggal TEXT,
            is_synced INTEGER DEFAULT 0,
            FOREIGN KEY (sellerId) REFERENCES sellers(id)
        );

        -- Tambahkan tabel lainnya sesuai skema sebelumnya
    `);

    return db;
}