<script>
  import { onMount } from "svelte";
  import { initDB } from "$lib/api";

  let items = [];
  let units = [];
  let itemName = "";
  let unitName = "";
  let db;

  async function load() {
    db = await initDB();
    items = await db.select("SELECT * FROM items ORDER BY name ASC");
    units = await db.select("SELECT * FROM units ORDER BY name ASC");
  }

  async function addItem() {
    if (!itemName) return;
    await db.execute("INSERT INTO items (id, name) VALUES ($1, $2)", [
      crypto.randomUUID(),
      itemName.toLowerCase(),
    ]);
    itemName = "";
    await load();
  }

  async function addUnit() {
    if (!unitName) return;
    await db.execute("INSERT INTO units (id, name) VALUES ($1, $2)", [
      crypto.randomUUID(),
      unitName.toLowerCase(),
    ]);
    unitName = "";
    await load();
  }

  async function updateDefaultUnit(itemId, unitId) {
    await db.execute("UPDATE items SET defaultUnitId = $1 WHERE id = $2", [
      unitId,
      itemId,
    ]);
    await load();
  }

  async function deleteItem(id) {
    if (!confirm("Hapus barang ini?")) return;
    await db.execute("DELETE FROM items WHERE id = $1", [id]);
    await load();
  }

  async function deleteUnit(id) {
    if (!confirm("Hapus satuan ini?")) return;
    await db.execute("DELETE FROM units WHERE id = $1", [id]);
    await load();
  }

  onMount(load);
</script>

<div class="container">
  <h2>Master Data</h2>

  <div class="input-stack">
    <div class="card border-blue">
      <h4>📦 Tambah Barang Baru</h4>
      <div class="input-row">
        <input bind:value={itemName} placeholder="Nama barang (misal: kopra)" />
        <button class="btn-save btn-blue" on:click={addItem}>Tambah</button>
      </div>
    </div>

    <div class="card border-purple">
      <h4>⚖️ Tambah Satuan Baru</h4>
      <div class="input-row">
        <input bind:value={unitName} placeholder="Satuan (misal: kg, subur)" />
        <button class="btn-save btn-purple" on:click={addUnit}>Tambah</button>
      </div>
    </div>
  </div>

  <hr class="divider" />

  <div class="table-container">
    <h4>Daftar Barang & Satuan Default</h4>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Barang</th>
            <th>Satuan Bawaan</th>
            <th style="text-align: center;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item}
            <tr>
              <td class="capitalize">{item.name}</td>
              <td>
                <select 
                  class="select-style"
                  value={item.defaultUnitId || ""} 
                  on:change={(e) => updateDefaultUnit(item.id, e.target.value)}
                >
                  <option value="">-- Pilih --</option>
                  {#each units as u}
                    <option value={u.id}>{u.name}</option>
                  {/each}
                </select>
              </td>
              <td style="text-align: center;">
                <button class="btn-del" on:click={() => deleteItem(item.id)}>Hapus</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="unit-summary">
    <h4>Semua Satuan Tersedia</h4>
    <div class="badge-list">
      {#each units as u}
        <div class="badge">
          {u.name}
          <button on:click={() => deleteUnit(u.id)}>×</button>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .container { padding: 15px; max-width: 600px; margin: auto; font-family: sans-serif; }
  
  /* DISUSUN KE BAWAH */
  .input-stack { 
    display: flex; 
    flex-direction: column; 
    gap: 15px; 
    margin-bottom: 25px; 
  }
  
  .card { 
    background: #fff; 
    padding: 15px; 
    border-radius: 12px; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border-left: 4px solid #ddd;
  }
  .border-blue { border-left-color: #3498db; }
  .border-purple { border-left-color: #9b59b6; }

  .card h4 { margin: 0 0 12px 0; font-size: 13px; color: #444; text-transform: uppercase; letter-spacing: 0.5px; }

  .input-row { display: flex; gap: 8px; flex-direction: column; }
  input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; outline: none; }
  input:focus { border-color: #3498db; }
  
  .btn-save { padding: 10px 15px; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
  .btn-save:active { opacity: 0.7; }
  .btn-blue { background: #3498db; }
  .btn-purple { background: #9b59b6; }

  .divider { border: none; height: 1px; background: #eee; margin: 30px 0; }

  /* TABEL STYLES */
  .table-container { background: white; border-radius: 12px; border: 1px solid #eee; overflow: hidden; }
  .table-container h4 { padding: 15px; margin: 0; background: #fdfdfd; border-bottom: 1px solid #eee; font-size: 14px; }
  .table-wrapper { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #fcfcfc; padding: 12px; text-align: left; font-size: 12px; color: #888; border-bottom: 2px solid #eee; }
  td { padding: 12px; border-bottom: 1px solid #f9f9f9; font-size: 14px; }

  .capitalize { text-transform: capitalize; }
  .select-style { width: 100%; padding: 5px; border-radius: 6px; border: 1px solid #eee; background: #fafafa; }
  
  .btn-del { color: #e74c3c; background: none; border: 1px solid #fadbd8; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; }

  .badge-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .badge { background: #f0f3f5; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 13px; border: 1px solid #e0e4e8; }
  .badge button { border: none; background: none; color: #e74c3c; cursor: pointer; font-weight: bold; font-size: 16px; }
</style>
