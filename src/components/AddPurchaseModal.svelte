<script lang="ts">
  import { dbActions, getDB } from "$lib/api";
  import { onMount } from "svelte";
  import { showAddPurchases } from "$lib/stores";
  import { Plus, Wallet } from "lucide-svelte";

  // --- Interfaces ---
  interface Seller {
    id: string;
    name: string;
  }
  interface Item {
    id: string;
    name: string;
    defaultUnitId?: string;
  }
  interface Unit {
    id: string;
    name: string;
  }

  // --- States (Runes) ---
  let sellers = $state<Seller[]>([]);
  let items = $state<Item[]>([]);
  let units = $state<Unit[]>([]);

  let sellerId = $state("");
  let itemName = $state("kelapa");
  let unitName = $state("");

  // Menggunakan undefined agar input kosong di awal
  let jumlah = $state<number | undefined>();
  let harga = $state<number | undefined>();
  let uangDibayar = $state<number | undefined>();

  let isDebt = $state(false);

  // --- Derived States ---
  const totalNilaiBarang = $derived((jumlah ?? 0) * (harga ?? 0));
  const sisaKekurangan = $derived(
    Math.max(0, totalNilaiBarang - (uangDibayar ?? 0)),
  );

  // Tambahkan ini:
  const placeholderJumlah = $derived(
    unitName ? `Jumlah (${unitName})` : "Jumlah",
  );
  const placeholderHarga = $derived(
    unitName ? `Harga per ${unitName}` : "Harga per unit",
  );

  // --- Effects ---
  // Sinkronisasi uang dibayar jika bukan mode DP
  $effect(() => {
    if (!isDebt) {
      // Mode Tunai: Otomatis isi sesuai total
      uangDibayar = totalNilaiBarang > 0 ? totalNilaiBarang : undefined;
    } else {
      // Mode DP: Kosongkan jika sebelumnya nilainya sama dengan total
      // Ini agar saat user klik checkbox "Uang keluar sekarang...", inputnya kosong
      if (uangDibayar === totalNilaiBarang) {
        uangDibayar = undefined;
      }
    }
  });

  // Pantau perubahan itemName untuk satuan default
  $effect(() => {
    if (itemName && items.length > 0) {
      applyDefaultUnit();
    }
  });

  // --- Functions ---
  async function load() {
    const db = await getDB();
    const [sData, iData] = await Promise.all([
      db.select("SELECT * FROM sellers ORDER BY name ASC"),
      db.select("SELECT * FROM items ORDER BY name ASC"),
    ]);

    sellers = sData;
    items = iData;

    try {
      units = await db.select("SELECT * FROM units ORDER BY name ASC");
    } catch (e) {
      units = [];
    }
    applyDefaultUnit();
  }

  function applyDefaultUnit() {
    const selectedItem = items.find((i) => i.name === itemName);
    if (selectedItem?.defaultUnitId) {
      const matchedUnit = units.find(
        (u) => u.id === selectedItem.defaultUnitId,
      );
      if (matchedUnit) unitName = matchedUnit.name;
    }
  }

  async function quickAddSeller() {
    const name = prompt("Masukkan nama penjual baru:");
    if (name) {
      const db = await getDB();
      const id = crypto.randomUUID();
      await db.execute("INSERT INTO sellers (id, name) VALUES ($1, $2)", [
        id,
        name,
      ]);
      await load();
      sellerId = id;
    }
  }

  async function quickAddItem() {
    const name = prompt("Masukkan nama barang baru:");
    if (name) {
      const db = await getDB();
      const id = crypto.randomUUID();
      await db.execute("INSERT INTO items (id, name) VALUES ($1, $2)", [
        id,
        name.toLowerCase(),
      ]);
      await load();
      itemName = name.toLowerCase();
    }
  }

  async function quickAddUnit() {
    const name = prompt("Masukkan nama satuan baru:");
    if (name) {
      const db = await getDB();
      try {
        await db.execute("INSERT INTO units (id, name) VALUES ($1, $2)", [
          crypto.randomUUID(),
          name.toLowerCase(),
        ]);
        await load();
        unitName = name.toLowerCase();
      } catch (e) {
        alert("Tabel units belum tersedia.");
      }
    }
  }

  async function add() {
    if (!sellerId || !itemName || !jumlah || !harga || !unitName) {
      alert("Mohon lengkapi semua data!");
      return;
    }

    const data = {
      sellerId,
      item: itemName,
      unit: unitName,
      jumlah: jumlah,
      harga: harga,
      total: totalNilaiBarang,
      uangDibayar: uangDibayar ?? 0,
      catatan: isDebt ? "DP Awal" : "Pembelian Tunai",
    };

    try {
      if (isDebt) {
        await dbActions.addDebt(data);
      } else {
        await dbActions.addPurchase(data);
      }
      $showAddPurchases = false;
      window.location.reload();
    } catch (err) {
      alert("Gagal menyimpan ke SQLite");
    }
  }

  function rupiah(n: number | undefined) {
    return new Intl.NumberFormat("id-ID").format(n ?? 0);
  }

  onMount(load);
</script>

<div class="modal-overlay" onclick={() => ($showAddPurchases = false)}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>{isDebt ? "Bayar DP / Panjar" : "Tambah Pembelian"}</h3>
      {#if isDebt}
        <span class="debt-badge">Mode DP</span>
      {/if}
    </div>

    <label class="debt-option">
      <input
        type="checkbox"
        bind:checked={isDebt}
        style="width: fit-content;"
      />
      <span>Uang keluar sekarang, barang masuk nanti?</span>
    </label>

    <hr />

    <div class="field-header">
      <label for="seller">Penjual</label>
      <button class="btn-plus" onclick={quickAddSeller}
        ><Plus size={20} /> Tambah</button
      >
    </div>
    <select id="seller" bind:value={sellerId}>
      <option value="">Pilih penjual</option>
      {#each sellers as s}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>

    <div class="row">
      <div class="col">
        <div class="field-header">
          <label class="small-label" for="item">Barang</label>
          <button class="btn-plus" onclick={quickAddItem}
            ><Plus size={20} />Tambah</button
          >
        </div>
        <select id="item" bind:value={itemName}>
          {#each items as i}
            <option value={i.name}>{i.name}</option>
          {/each}
        </select>
      </div>
      <div class="col">
        <div class="field-header">
          <label class="small-label" for="unit">Satuan</label>
          <button class="btn-plus" onclick={quickAddUnit}
            ><Plus size={20} />Tambah</button
          >
        </div>
        <select id="unit" bind:value={unitName}>
          <option value="">Pilih...</option>
          {#each units as u}
            <option value={u.name}>{u.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <label for="plan">Rencana Pembelian (Janji)</label>
    <div class="row">
      <input
        type="number"
        bind:value={jumlah}
        placeholder={placeholderJumlah}
      />

      <input type="number" bind:value={harga} placeholder={placeholderHarga} />
    </div>

    {#if isDebt}
      <div class="dp-section">
        <label for="dp"><Wallet size={14} /> Uang Tunai yang Dibayarkan</label>
        <input
          id="dp"
          type="number"
          bind:value={uangDibayar}
          class="dp-input"
          placeholder="Masukkan nominal DP..."
        />
        <div class="dp-info-text">
          Sisa kekurangan: <strong>Rp {rupiah(sisaKekurangan)}</strong>
        </div>
      </div>
    {/if}

    <div class="total-box">
      <div class="total-row">
        <span>Total Nilai Barang:</span>
        <span>Rp {rupiah(totalNilaiBarang)}</span>
      </div>
      <div class="total-row main">
        <span>Kas Keluar Hari Ini:</span>
        <span class={isDebt ? "text-warn" : "text-success"}
          >Rp {rupiah(uangDibayar)}</span
        >
      </div>
    </div>

    <div class="actions">
      <button class="cancel" onclick={() => ($showAddPurchases = false)}
        >Batal</button
      >
      <button class={isDebt ? "save-debt" : "save"} onclick={add}>
        {isDebt ? "Simpan DP" : "Simpan Transaksi"}
      </button>
    </div>
  </div>
</div>

<style>
  /* Style tetap sama dengan CSS Anda yang sudah diperbarui dengan warna merah/dark red */
  /* Pastikan menggunakan style yang Anda berikan sebelumnya */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999;
  }
  .modal-content {
    background: white;
    padding: 18px;
    border-radius: 12px;
    width: 90%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-family: sans-serif;
  }

  .field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 5px;
    /* margin-bottom: 8px; */
  }
  .small-label {
    font-size: 1rem;
    color: #777;
  }
  .btn-plus {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .btn-icon {
    background: #eee;
    border: none;
    border-radius: 4px;
    padding: 2px 5px;
    cursor: pointer;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .row .field-header {
    margin-bottom: 8px;
  }

  input,
  select {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
    font-size: 14px;
  }
  .dp-section {
    background: #f6f1f1;
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #db3434;
    margin-top: 5px;
  }
  .dp-section label {
    font-size: 12px;
    font-weight: bold;
    color: #b92929;
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 5px;
  }
  .dp-input {
    border: 2px solid #db3434;
    font-weight: bold;
    font-size: 16px;
    color: #b92929;
  }
  .dp-info-text {
    font-size: 11px;
    margin-top: 5px;
    color: #666;
  }
  .total-box {
    background: #fafafa;
    padding: 12px;
    border-radius: 8px;
    margin: 10px 0;
    border: 1px solid #eee;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #666;
  }
  .total-row.main {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-top: 5px;
    border-top: 1px solid #eee;
    padding-top: 5px;
  }
  .text-success {
    color: #27ae60;
  }
  .text-warn {
    color: #e67e22;
  }
  .actions {
    display: flex;
    gap: 10px;
    /* margin-top: 10px; */
  }
  .save {
    flex: 1;
    background: #2ecc71;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
  }
  .save-debt {
    flex: 1;
    background: #db3434;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
  }
  .cancel {
    background: #eee;
    border: none;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
  }
  .debt-badge {
    background: #db3434;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: bold;
  }
  .debt-option {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fbebeb;
    padding: 10px;
    border-radius: 8px;
    border: 1px dashed #db3434;
    cursor: pointer;
    font-size: 13px;
    color: #b92929;
  }
  hr {
    border: none;
    border-top: 1px solid #eee;
    margin: 5px 0;
  }
</style>
