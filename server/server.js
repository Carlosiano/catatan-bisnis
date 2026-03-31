import { serve } from "bun";
import { readFileSync, writeFileSync, existsSync } from "fs";

const DB_PATH = "./server/db.json";

function defaultDB() {
  return {
    sellers: [],
    purchases: [],
    debts: [],
    productions: [],
    incomes: []
  };
}

function readDB() {
  try {
    const text = readFileSync(DB_PATH, "utf-8");
    if (!text.trim()) return defaultDB();
    return JSON.parse(text);
  } catch {
    return defaultDB();
  }
}

function writeDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

if (!existsSync(DB_PATH)) {
  writeFileSync(DB_PATH, JSON.stringify(defaultDB(), null, 2));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);

    // ✅ Handle preflight (WAJIB)
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // GET DB
    if (req.method === "GET" && url.pathname === "/db") {
      return Response.json(readDB(), {
        headers: corsHeaders()
      });
    }

    // INSERT
    if (req.method === "POST" && url.pathname === "/insert") {
      const body = await req.json();
      const db = readDB();
      const { table, data } = body;

      // Proteksi: Jika tabel belum ada di JSON, buatkan array kosong dulu
      if (!db[table]) {
        db[table] = [];
      }

      db[table].push(data);

      writeDB(db);

      return Response.json(
        { success: true },
        { headers: corsHeaders() }
      );
    }

    // if (req.method === "POST" && url.pathname === "/delete") {
    //   const body = await req.json();
    //   const db = readDB();

    //   db[body.table] = db[body.table].filter(i => i.id !== body.id);

    //   writeDB(db);

    //   return Response.json({ success: true });
    // }

    if (req.method === "POST" && url.pathname === "/delete") {
      const body = await req.json();
      const db = readDB();

      // Hapus data berdasarkan ID
      db[body.table] = db[body.table].filter(i => i.id !== body.id);

      writeDB(db);

      // TAMBAHKAN HEADERS CORS DI SINI
      return Response.json(
        { success: true },
        { headers: corsHeaders() }
      );
    }

    if (req.method === "POST" && url.pathname === "/save") {
      const body = await req.json();
      writeDB(body);

      // TAMBAHKAN HEADERS DI SINI
      return Response.json(
        { success: true },
        { headers: corsHeaders() }
      );
    }

    return new Response("Not found", {
      status: 404,
      headers: corsHeaders()
    });
  }
});