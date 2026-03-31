<!-- AddPurchaseModal.svelte -->
<script lang="ts">
  import { dbActions, getDB } from "$lib/api";
  import { onMount } from "svelte";
  import { showAddPurchases } from "$lib/stores";
  import {
    Plus,
    Wallet,
    ArrowLeft,
    Check,
    ChevronRight,
    Edit2,
    Trash2,
    X,
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

  // --- States ---
  let step = $state(1); // 1: Penjual, 2: Barang, 3: Nominal, 4: Manage Sellers
  let sellers = $state<Seller[]>([]);
  let items = $state<Item[]>([]);
  let units = $state<Unit[]>([]);

  let sellerId = $state("");
  let itemName = $state("");
  let unitName = $state("");
  let jumlah = $state<number | undefined>();
  let harga = $state<number | undefined>();
  let uangDibayar = $state<number | undefined>();
  let isDebt = $state(false); // Default ke False (Beli Tunai)

  let isPriceFixed = $state(false); // TRUE = Sudah Pasti, FALSE = Belum Pasti

  // --- Search/Suggestion States ---
  let itemSuggestions = $derived(
    items.filter(
      (i) => i.name.includes(itemName.toLowerCase()) && itemName !== i.name,
    ),
  );
  let unitSuggestions = $derived(
    units.filter(
      (u) => u.name.includes(unitName.toLowerCase()) && unitName !== u.name,
    ),
  );

  let isPriceEstimated = $state(false);

  // --- Derived ---
  const selectedSellerName = $derived(
    sellers.find((s) => s.id === sellerId)?.name || "",
  );
  const totalNilaiBarang = $derived((jumlah ?? 0) * (harga ?? 0));
  const sisaKekurangan = $derived(
    Math.max(0, totalNilaiBarang - (uangDibayar ?? 0)),
  );

  async function load() {
    const db = await getDB();
    const [sData, iData, uData] = await Promise.all([
      db.select("SELECT * FROM sellers ORDER BY name ASC"),
      db.select("SELECT * FROM items ORDER BY name ASC"),
      db.select("SELECT * FROM units ORDER BY name ASC"),
    ]);
    sellers = sData;
    items = iData;
    units = uData;
  }

  // --- Seller Management ---
  async function handleAddSeller() {
    const name = prompt("Nama penjual baru:");
    if (!name) return;
    const db = await getDB();
    await db.execute("INSERT INTO sellers (id, name) VALUES ($1, $2)", [
      crypto.randomUUID(),
      name,
    ]);
    await load();
  }

  async function editSeller(id: string, oldName: string) {
    const newName = prompt("Ubah nama penjual:", oldName);
    if (!newName || newName === oldName) return;
    const db = await getDB();
    await db.execute("UPDATE sellers SET name = $1 WHERE id = $2", [
      newName,
      id,
    ]);
    await load();
  }

  async function deleteSeller(id: string) {
    if (!confirm("Hapus penjual ini? Semua history mungkin terdampak.")) return;
    const db = await getDB();
    await db.execute("DELETE FROM sellers WHERE id = $1", [id]);
    if (sellerId === id) sellerId = "";
    await load();
  }

  async function handleAddItemUnit() {
    if (!itemName || !unitName) return alert("Lengkapi data!");
    const db = await getDB();
    if (!items.find((i) => i.name === itemName.toLowerCase())) {
      await db.execute("INSERT INTO items (id, name) VALUES ($1, $2)", [
        crypto.randomUUID(),
        itemName.toLowerCase(),
      ]);
    }
    if (!units.find((u) => u.name === unitName.toLowerCase())) {
      await db.execute("INSERT INTO units (id, name) VALUES ($1, $2)", [
        crypto.randomUUID(),
        unitName.toLowerCase(),
      ]);
    }
    await load();
    step = 3;
  }

  async function add() {
    // Validasi dasar
    if (!sellerId || !itemName || !jumlah)
      return alert("Lengkapi data minimal!");

    // Jika Tunai, harga WAJIB diisi.
    // Jika DP, harga WAJIB diisi HANYA JIKA isPriceFixed adalah TRUE.
    if (!isDebt && !harga)
      return alert("Harga wajib diisi untuk pembelian tunai!");
    if (isDebt && isPriceFixed && !harga)
      return alert("Harga wajib diisi jika harga sudah pasti!");

    const data = {
      sellerId,
      item: itemName,
      unit: unitName,
      jumlah,
      // Jika harga TIDAK fixed (false), maka set 0 (estimasi)
      harga: !isDebt || isPriceFixed ? (harga ?? 0) : 0,
      total: !isDebt || isPriceFixed ? jumlah * (harga ?? 0) : 0,
      uangDibayar: isDebt ? (uangDibayar ?? 0) : jumlah * (harga ?? 0),
      catatan: isDebt
        ? isPriceFixed
          ? "DP (Harga Flat/Pasti)"
          : "DP (Harga Belum Pasti)"
        : "Pembelian Tunai",
    };

    try {
      if (isDebt) await dbActions.addDebt(data);
      else await dbActions.addPurchase(data);
      $showAddPurchases = false;
      window.location.reload();
    } catch (err) {
      alert("Gagal simpan transaksi");
    }
  }

  onMount(load);
</script>

{#if $showAddPurchases}
  <div class="modal-overlay" onclick={() => ($showAddPurchases = false)}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        {#if step > 1}
          <button
            class="btn-back"
            onclick={() => (step = step === 4 ? 1 : step - 1)}
            ><ArrowLeft size={20} /></button
          >
        {/if}
        <h3 class={isDebt ? "label-transaksi-dp" : "label-transaksi-tunai"}>
          {step === 4
            ? "Kelola Penjual"
            : isDebt
              ? "DP / Panjar"
              : "Beli Tunai"}
        </h3>
        <button class="btn-close" onclick={() => ($showAddPurchases = false)}
          ><X size={20} /></button
        >
      </div>

      <hr />

      {#if step <= 3}
        <div class="mode-selector">
          <button class:active={!isDebt} onclick={() => (isDebt = false)}
            >Tunai</button
          >
          <button class:active={isDebt} onclick={() => (isDebt = true)}
            >DP / Panjar</button
          >
        </div>
      {/if}

      {#if step === 1}
        <div class="field-header">
          <label>Pilih Penjual</label>
          <button class="text-btn" onclick={() => (step = 4)}
            >Edit Daftar</button
          >
        </div>

        <div class="list-container">
          {#each sellers as s}
            <button
              class="list-item"
              class:active={sellerId === s.id}
              onclick={() => {
                sellerId = s.id;
                step = 2;
              }}
            >
              {s.name}
              {#if sellerId === s.id}<Check size={16} />{/if}
            </button>
          {/each}
          <button class="list-item add-new" onclick={handleAddSeller}>
            <Plus size={16} /> Tambah Penjual
          </button>
        </div>
      {:else if step === 2}
        <div class="step-body">
          <div class="info-tag">
            Penjual: <strong>{selectedSellerName}</strong>
          </div>

          <div class="input-wrapper">
            <label>Nama Barang</label>
            <input bind:value={itemName} placeholder="Ketik nama barang..." />
            {#if itemName && itemSuggestions.length > 0}
              <div class="suggestions">
                {#each itemSuggestions as sugg}
                  <button onclick={() => (itemName = sugg.name)}
                    >{sugg.name}</button
                  >
                {/each}
              </div>
            {/if}
          </div>

          <div class="input-wrapper">
            <label>Satuan</label>
            <input bind:value={unitName} placeholder="kg, butir, pcs..." />
            {#if unitName && unitSuggestions.length > 0}
              <div class="suggestions">
                {#each unitSuggestions as sugg}
                  <button onclick={() => (unitName = sugg.name)}
                    >{sugg.name}</button
                  >
                {/each}
              </div>
            {/if}
          </div>

          <button class="btn-next" onclick={handleAddItemUnit}
            >Lanjut <ChevronRight size={18} /></button
          >
        </div>
      {:else if step === 3}
        <div class="step-body">
          <div class="info-summary">
            <span>{selectedSellerName}</span> <span class="dot"></span>
            <span>{itemName} / {unitName}</span>
          </div>

          <div class="row">
            <div class="input-group">
              <label>Jumlah Janji</label>
              <input
                type="number"
                bind:value={jumlah}
                placeholder="Jumlah"
              />
              <span class="unit-label">/{unitName}</span>
            </div>

            {#if !isDebt || isPriceFixed}
              <div class="input-group">
                <label>Harga Satuan</label>
                <input type="number" bind:value={harga} placeholder="0" />
                <span class="unit-label">/{unitName}</span>
              </div>
            {/if}
          </div>

          {#if isDebt}
            <div class="price-notice-toggle" class:is-fixed={isPriceFixed}>
              <input type="checkbox" id="fixed" bind:checked={isPriceFixed} />
              <label for="fixed"
                >Centang jika harga per {unitName}
                <strong>sudah pasti</strong></label
              >
            </div>

            <div class="dp-section">
              <label><Wallet size={14} /> Bayar DP Sekarang</label>
              <input
                type="number"
                bind:value={uangDibayar}
                class="dp-input"
                placeholder="Rp 5.000.000"
              />

              {#if !isPriceEstimated && harga && jumlah}
                <div class="total-preview">
                  Total Nilai Barang (Fixed): <strong
                    >Rp {totalNilaiBarang.toLocaleString()}</strong
                  >
                </div>
              {/if}
            </div>
          {:else}
            <div class="total-box-simple">
              <span>Total Pembayaran Tunai:</span>
              <strong>Rp {totalNilaiBarang.toLocaleString()}</strong>
            </div>
          {/if}

          <button class={isDebt ? "save-debt" : "save-cash"} onclick={add}>
            {isDebt ? "Simpan DP" : "Simpan Transaksi"}
          </button>
        </div>
      {:else if step === 4}
        <div class="list-container">
          {#each sellers as s}
            <div class="list-item manage">
              <span>{s.name}</span>
              <div class="item-actions">
                <button onclick={() => editSeller(s.id, s.name)}
                  ><Edit2 size={16} /></button
                >
                <button class="del" onclick={() => deleteSeller(s.id)}
                  ><Trash2 size={16} /></button
                >
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
  .price-notice-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
    padding: 8px 12px;
    background: #fff8e1;
    border-radius: 8px;
    border: 1px solid #ffe082;
  }
  .price-notice-toggle input {
    width: auto;
  }
  .price-notice-toggle label {
    margin-bottom: 0;
    color: #856404;
    font-size: 11px;
    cursor: pointer;
  }
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
    margin-top: 10px;
  }

  .total-preview {
    margin-top: 8px;
    font-size: 12px;
    color: #666;
    border-top: 1px dashed #ddd;
    padding-top: 5px;
  }
  /* --- Layout Dasar --- */
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
  .btn-close,
  .btn-back {
    background: none;
    border: none;
    padding: 5px;
    color: #666;
  }

  /* --- Mode Tunai / DP --- */
  .mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #f0f0f0;
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 15px;
  }
  .mode-selector button {
    border: none;
    padding: 10px;
    border-radius: 10px;
    font-weight: bold;
    font-size: 13px;
    cursor: pointer;
    transition: 0.2s;
  }
  .mode-selector button.active {
    background: white;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    color: #db3434;
  }

  /* --- List & Inputs --- */
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
  }

  .list-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
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
  }
  .list-item.active {
    border-color: #db3434;
    color: #db3434;
    background: #fff5f5;
  }
  .list-item.manage {
    background: #fafafa;
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
  }
  .item-actions button.del {
    color: #db3434;
  }

  /* --- Suggestion Box --- */
  .input-wrapper {
    position: relative;
    margin-bottom: 15px;
  }
  .suggestions {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 5px;
  }
  .suggestions button {
    font-size: 11px;
    background: #f0f0f0;
    border: none;
    padding: 4px 10px;
    border-radius: 15px;
    cursor: pointer;
  }

  /* --- Utils --- */
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }
  .input-group {
    position: relative;
  }
  .unit-label {
    position: absolute;
    right: 10px;
    top: 12px;
    font-size: 12px;
    color: #999;
  }

  .btn-next,
  .save-debt,
  .save-cash {
    width: 100%;
    padding: 15px;
    border-radius: 12px;
    border: none;
    font-weight: bold;
    color: white;
    cursor: pointer;
    margin-top: 10px;
  }
  .btn-next {
    background: #333;
  }
  .save-debt {
    background: #db3434;
  }
  .save-cash {
    background: #27ae60;
  }

  .info-tag {
    background: #fff5f5;
    padding: 10px;
    border-radius: 10px;
    color: #b92929;
    font-size: 13px;
    margin-bottom: 15px;
  }
  input {
    padding: 12px;
    border: 1.5px solid #eee;
    border-radius: 10px;
    width: 100%;
    font-size: 14px;
    outline: none;
  }
  input:focus {
    border-color: #db3434;
  }
  label {
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 4px;
    display: block;
    color: #666;
  }
  hr {
    border: none;
    border-top: 1px solid #eee;
    margin-bottom: 10px;
  }
  .label-transaksi-tunai {
    color: green;
  }
  .label-transaksi-dp {
    color: #b92929;
  }

.price-notice-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
    padding: 8px 12px;
    background: #fff8e1; /* Kuning (Peringatan/Belum pasti) */
    border-radius: 8px;
    border: 1px solid #ffe082;
    transition: 0.3s;
  }

  .price-notice-toggle.is-fixed {
    background: #f0fff4; /* Hijau (Sudah pasti/Aman) */
    border-color: #c6f6d5;
  }

  .price-notice-toggle.is-fixed label {
    color: #27ae60;
  }
</style>
