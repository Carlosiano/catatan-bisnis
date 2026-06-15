<script lang="ts">
  import { dbActions, getDB, initDB } from "$lib/api";
  import { onMount } from "svelte";
  import { showAddPurchases } from "$lib/stores";
  import {
    ArrowLeft,
    Check,
    ChevronRight,
    Edit2,
    Trash2,
    X,
    Plus
  } from "lucide-svelte";

  // --- Interfaces ---
  interface Seller {
    id: string;
    name: string;
  }
  interface Item {
    id: string;
    name: string;
  }
  interface Unit {
    id: string;
    name: string;
  }

  let { loadListBeli } = $props();

  // --- States ---
  let step = $state(1); // 1: Penjual, 2: Barang, 3: Nominal, 4: Manage Sellers
  let sellers = $state<Seller[]>([]);
  let items = $state<Item[]>([]);
  let units = $state<Unit[]>([]);

  let sellerId = $state("");
  let sellerNameInput = $state(""); // State penampung ketikan nama penjual
  let itemName = $state("");
  let unitName = $state("");
  let jumlah = $state<number | undefined>();
  let harga = $state<number | undefined>();

  // --- Derived State Svelte 5 ---
  // Menampilkan daftar penjual yang cocok dengan ketikan input
  let filteredSellers = $derived(
    sellers.filter((s) =>
      s.name.toLowerCase().includes(sellerNameInput.toLowerCase())
    )
  );

  // Mengecek apakah nama yang diketik persis sama dengan salah satu yang ada di DB
  let isExactSellerExist = $derived(
    sellers.some((s) => s.name.toLowerCase() === sellerNameInput.trim().toLowerCase())
  );

  let itemSuggestions = $derived(
    items.filter(
      (i) => i.name.toLowerCase().includes(itemName.toLowerCase()) && itemName.toLowerCase() !== i.name.toLowerCase()
    )
  );

  let unitSuggestions = $derived(
    units.filter(
      (u) => u.name.toLowerCase().includes(unitName.toLowerCase()) && unitName.toLowerCase() !== u.name.toLowerCase()
    )
  );

  const selectedSellerName = $derived(
    sellers.find((s) => s.id === sellerId)?.name || sellerNameInput
  );
  
  const totalNilaiBarang = $derived((jumlah ?? 0) * (harga ?? 0));

  async function load() {
    try {
      await initDB();
      sellers = await dbActions.getSellers();
      items = await dbActions.getItems();
      units = await dbActions.getUnits();
    } catch (e) {
      console.error("Gagal memuat data master:", e);
    }
  }

  // --- Registrasi Otomatis dari Input Ketikan ---
  async function handleAutoCreateSeller(customName: string) {
    const cleanName = customName.trim();
    if (!cleanName) return;

    try {
      const db = await getDB();
      const newId = crypto.randomUUID();
      await db.execute("INSERT INTO sellers (id, name) VALUES ($1, $2)", [newId, cleanName]);
      
      await load(); // Reload data dari DB
      sellerId = newId;
      sellerNameInput = cleanName;
      step = 2; // Langsung lompat ke langkah input barang
    } catch (err) {
      alert("Gagal mendaftarkan penjual baru otomatis: " + err);
    }
  }

  async function editSeller(id: string, oldName: string) {
    const newName = prompt("Ubah nama penjual:", oldName);
    if (!newName || newName === oldName) return;
    const db = await getDB();
    await db.execute("UPDATE sellers SET name = $1 WHERE id = $2", [newName, id]);
    await load();
    await loadListBeli();
  }

  async function deleteSeller(id: string) {
    if (!confirm("Hapus penjual ini beserta seluruh riwayat pembeliannya?")) return;
    const db = await getDB();
    await db.execute(`DELETE FROM purchases WHERE "sellerId" = $1`, [id]);
    await db.execute(`DELETE FROM debts WHERE "sellerId" = $1`, [id]);
    await db.execute("DELETE FROM sellers WHERE id = $1", [id]);
    if (sellerId === id) sellerId = "";
    await load();
    await loadListBeli();
  }

  async function handleAddItemUnit() {
    if (!itemName || !unitName) return alert("Nama Barang dan Satuan wajib diisi!");
    const db = await getDB();
    
    if (!items.find((i) => i.name.toLowerCase() === itemName.trim().toLowerCase())) {
      await db.execute("INSERT INTO items (id, name) VALUES ($1, $2)", [
        crypto.randomUUID(),
        itemName.trim().toLowerCase(),
      ]);
    }
    if (!units.find((u) => u.name.toLowerCase() === unitName.trim().toLowerCase())) {
      await db.execute("INSERT INTO units (id, name) VALUES ($1, $2)", [
        crypto.randomUUID(),
        unitName.trim().toLowerCase(),
      ]);
    }
    await load();
    step = 3;
  }

  async function add() {
    if (!sellerId || !itemName || !jumlah || !harga) {
      return alert("Mohon lengkapi seluruh data kuantitas dan harga tunai!");
    }

    const data = {
      sellerId,
      item: itemName.trim(),
      unit: unitName.trim(),
      jumlah: Number(jumlah),
      harga: Number(harga),
      total: totalNilaiBarang,
      catatan: "Pembelian Tunai",
    };

    try {
      await dbActions.addPurchase(data);
      $showAddPurchases = false;
      await loadListBeli();
      window.location.reload();
    } catch (err) {
      console.error("Gagal menyimpan transaksi tunai:", err);
      alert("Gagal simpan transaksi: " + err);
    }
  }

  onMount(load);

$effect(() => {
    if (itemName.trim() !== "") {
      // Cari apakah teks barang yang diketik sudah terdaftar di database master
      const matchItem = items.find(
        (i) => i.name.toLowerCase() === itemName.trim().toLowerCase()
      );
      
      // Jika ketemu dan barang tersebut punya pasangan nama satuan default, isi otomatis kolom satuannya
      if (matchItem && matchItem.defaultUnitName) {
        unitName = matchItem.defaultUnitName;
      }
    }
  });
</script>

{#if $showAddPurchases}
  <div class="modal-overlay" onclick={() => ($showAddPurchases = false)}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        {#if step > 1}
          <button class="btn-back" onclick={() => (step = step === 4 ? 1 : step - 1)}>
            <ArrowLeft size={20} />
          </button>
        {/if}
        <h3 class="label-transaksi-tunai">
          {step === 4 ? "Kelola Penjual" : "Pembelian Tunai"}
        </h3>
        <button class="btn-close" onclick={() => ($showAddPurchases = false)}>
          <X size={20} />
        </button>
      </div>

      <hr />

      {#if step === 1}
        <div class="field-header">
          <label for="seller-search">Nama Penjual</label>
          <button class="text-btn" onclick={() => (step = 4)}>Edit Daftar</button>
        </div>

        <div class="search-wrapper">
          <input
            id="seller-search"
            type="text"
            bind:value={sellerNameInput}
            placeholder="Ketik nama penjual..."
            class="search-input"
          />
        </div>

        <div class="list-container">
          {#if sellerNameInput.trim() !== "" && !isExactSellerExist}
            <button class="list-item add-auto" onclick={() => handleAutoCreateSeller(sellerNameInput)}>
              <span class="create-text"><Plus size={14} /> Buat baru: "<strong>{sellerNameInput}</strong>"</span>
              <ChevronRight size={16} />
            </button>
          {/if}

          {#each filteredSellers as s}
            <button
              class="list-item"
              class:active={sellerId === s.id}
              onclick={() => {
                sellerId = s.id;
                sellerNameInput = s.name;
                step = 2;
              }}
            >
              {s.name}
              {#if sellerId === s.id}<Check size={16} />{/if}
            </button>
          {:else}
            {#if sellerNameInput.trim() === ""}
              <p class="empty-text">Silakan ketik nama petani/penjual di atas...</p>
            {/if}
          {/each}
        </div>
      {:else if step === 2}
        <div class="step-body">
          <div class="info-tag">
            Penjual: <strong>{selectedSellerName}</strong>
          </div>

          <div class="input-wrapper">
            <label for="item-name">Nama Barang</label>
            <input id="item-name" bind:value={itemName} placeholder="Kelapa subur, kelapa reject..." />
            {#if itemName && itemSuggestions.length > 0}
              <div class="suggestions">
                {#each itemSuggestions as sugg}
                  <button onclick={() => (itemName = sugg.name)}>{sugg.name}</button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="input-wrapper">
            <label for="unit-name">Satuan</label>
            <input id="unit-name" bind:value={unitName} placeholder="subur, kg, butir..." />
            {#if unitName && unitSuggestions.length > 0}
              <div class="suggestions">
                {#each unitSuggestions as sugg}
                  <button onclick={() => (unitName = sugg.name)}>{sugg.name}</button>
                {/each}
              </div>
            {/if}
          </div>

          <button class="btn-next" onclick={handleAddItemUnit}>
            Lanjut Kuantitas <ChevronRight size={18} />
          </button>
        </div>
      {:else if step === 3}
        <div class="step-body">
          <div class="info-summary">
            <strong>{selectedSellerName}</strong> <span class="dot">•</span>
            <span>{itemName} / {unitName}</span>
          </div>

          <div class="row">
            <div class="input-group">
              <label for="quantity-input">Jumlah {itemName}</label>
              <input id="quantity-input" type="number" bind:value={jumlah} placeholder="0" />
              <span class="unit-label">/{unitName}</span>
            </div>

            <div class="input-group">
              <label for="price-input">Harga Per {unitName}</label>
              <input id="price-input" type="number" bind:value={harga} placeholder="Rp 0" />
              <span class="unit-label">/{unitName}</span>
            </div>
          </div>

          <div class="total-box-simple">
            <span>Total Bayar Tunai:</span>
            <strong>Rp {totalNilaiBarang.toLocaleString('id-ID')}</strong>
          </div>

          <button class="save-cash" onclick={add}>
            Simpan Transaksi Tunai
          </button>
        </div>
      {:else if step === 4}
        <div class="field-header">
          <label for="manage-search">Cari Penjual Kontrol</label>
        </div>
        <input
          id="manage-search"
          type="text"
          bind:value={sellerNameInput}
          placeholder="Cari nama untuk edit/hapus..."
          class="search-input"
          style="margin-bottom: 10px;"
        />
        <div class="list-container">
          {#each filteredSellers as s}
            <div class="list-item manage">
              <span>{s.name}</span>
              <div class="item-actions">
                <button onclick={() => editSeller(s.id, s.name)} aria-label="Edit Penjual"><Edit2 size={16} /></button>
                <button class="del" onclick={() => deleteSeller(s.id)} aria-label="Hapus Penjual"><Trash2 size={16} /></button>
              </div>
            </div>
          {/each}
        </div>
        <button class="btn-next" onclick={() => (step = 1)}>Selesai</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .total-box-simple {
    background: #f0fff4;
    border: 1px solid #c6f6d5;
    padding: 15px;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    color: #27ae60;
    margin-top: 15px;
    font-weight: 500;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: white;
    padding: 20px;
    border-radius: 20px;
    width: 92%;
    max-width: 400px;
    max-height: 85vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  
  .btn-close, .btn-back {
    background: none;
    border: none;
    padding: 5px;
    color: #666;
    cursor: pointer;
  }

  .field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .text-btn {
    background: none;
    border: none;
    color: #0088ad;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
  }

  .list-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 260px;
    overflow-y: auto;
    margin-top: 5px;
    border-top: 1px solid #f0f0f0;
    padding-top: 10px;
  }
  
  .list-item {
    padding: 14px;
    border: 1.5px solid #eee;
    border-radius: 12px;
    background: white;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    cursor: pointer;
    color: #334155;
  }
  
  .list-item.active {
    border-color: #27ae60;
    color: #27ae60;
    background: #f0fff4;
    font-weight: 600;
  }
  
  .list-item.add-auto {
    border: 1.5px dashed #2563eb;
    background: #eff6ff;
    color: #2563eb;
    font-weight: 500;
  }

  .list-item.add-auto .create-text {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .list-item.manage {
    background: #fafafa;
    cursor: default;
  }

  .item-actions {
    display: flex;
    gap: 10px;
  }
  
  .item-actions button {
    background: white;
    border: 1px solid #ddd;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
  }
  
  .item-actions button.del {
    color: #db3434;
  }

  .input-wrapper {
    position: relative;
    margin-bottom: 15px;
  }
  
  .suggestions {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 6px;
  }
  
  .suggestions button {
    font-size: 11px;
    background: #f1f5f9;
    border: none;
    padding: 5px 12px;
    border-radius: 15px;
    cursor: pointer;
    color: #475569;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .input-group {
    position: relative;
  }
  
  .unit-label {
    position: absolute;
    right: 12px;
    top: 36px;
    font-size: 12px;
    color: #94a3b8;
  }

  .btn-next, .save-cash {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    font-weight: bold;
    color: white;
    cursor: pointer;
    margin-top: 15px;
    font-size: 15px;
  }
  
  .btn-next {
    background: #334155;
  }
  
  .save-cash {
    background: #27ae60;
    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2);
  }

  .info-tag {
    background: #f0fff4;
    padding: 10px;
    border-radius: 10px;
    color: #1e824c;
    font-size: 13px;
    margin-bottom: 15px;
  }

  .info-summary {
    font-size: 14px;
    color: #475569;
    margin-bottom: 12px;
    background: #f8fafc;
    padding: 10px;
    border-radius: 8px;
  }

  .info-summary .dot {
    margin: 0 4px;
  }

  input {
    padding: 12px;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    width: 100%;
    font-size: 14px;
    outline: none;
    background: #ffffff;
    color: #334155;
    margin-top: 4px;
  }
  
  input:focus {
    border-color: #27ae60;
  }
  
  label {
    font-size: 12px;
    font-weight: 600;
    display: block;
    color: #475569;
    text-transform: uppercase;
  }
  
  hr {
    border: none;
    border-top: 1px solid #eee;
    margin-bottom: 12px;
  }
  
  .label-transaksi-tunai {
    color: #27ae60;
    margin: 0;
    font-size: 16px;
  }

  .search-wrapper {
    margin-bottom: 12px;
  }

  .search-input {
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    padding: 12px;
    font-size: 14px;
    margin-top: 4px;
  }

  .search-input:focus {
    background: white;
    border-color: #27ae60;
  }

  .empty-text {
    text-align: center;
    font-size: 13px;
    color: #94a3b8;
    padding: 20px;
    font-style: italic;
  }
</style>