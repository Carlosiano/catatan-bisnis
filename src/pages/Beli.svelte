<!-- Beli.svelte -->
<script>
  import { onMount } from "svelte";
  import { showAddPurchases } from "$lib/stores";
  import { dbActions } from "$lib/api";
  import AddPurchaseModal from "$components/AddPurchaseModal.svelte";
  import { goto } from "$app/navigation";
  import { X, User, Package, Check, ChevronDown } from "lucide-svelte";

  let sellers = [];
  let purchases = [];
  let items = [];

  let groupBy = "none";
  let selectedSeller = "";
  let selectedItem = "";
  let selectedId = null;

  let selectedTransaction = null;
  let showDetailModal = false;

  // --- States untuk Kontrol Modal Overlay Terpisah ---
  let showSellerModal = false;
  let showItemModal = false;
  let searchSellerQuery = "";
  let searchItemQuery = "";

  // --- Derived Pencarian Reaktif ---
  $: filteredSellersInModal = sellers.filter((s) =>
    s.name.toLowerCase().includes(searchSellerQuery.toLowerCase()),
  );

  $: filteredItemsInModal = items.filter((i) =>
    i.name.toLowerCase().includes(searchItemQuery.toLowerCase()),
  );

  // PERBAIKAN 1: Mengubah fungsi menjadi deklarasi variabel reaktif ($:) agar UI otomatis terupdate
  $: currentSellerName = (() => {
    if (!selectedSeller) return "Semua Penjual";
    const found = sellers.find(
      (s) => s.id?.toString() === selectedSeller?.toString(),
    );
    return found ? found.name : "Semua Penjual";
  })();

  $: currentItemName = (() => {
    return selectedItem && selectedItem.trim() !== ""
      ? selectedItem
      : "Semua Barang";
  })();

  function openDetail(p) {
    selectedTransaction = p;
    showDetailModal = true;
  }

  function closeDetail() {
    showDetailModal = false;
    selectedTransaction = null;
  }

  function handleEdit(p) {
    alert("Fitur edit untuk " + p.item + " akan segera hadir!");
  }

  function handleAddClick() {
    $showAddPurchases = true;
  }

  async function load() {
    try {
      purchases = await dbActions.getAllTransactions();
      sellers = await dbActions.getSellers();
      items = await dbActions.getItems();
    } catch (err) {
      console.error("Gagal memuat data:", err);
    }
  }

  async function hapusTransaksi(id, status) {
    if (!confirm("Hapus transaksi ini selamanya?")) return;

    try {
      const table =
        status === "hutang" || status === "lunas-dp" ? "debts" : "purchases";
      const activeDb = await dbActions.getDB();
      await activeDb.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);

      selectedId = null;
      await load();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus data");
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return "-";
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (isNaN(d.getTime())) return "Format Salah";

    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleTerimaBarang(debt) {
    goto(`/terima?id=${debt.id}`);
  }

  async function handleRetur(debt) {
    if (confirm(`Kembalikan uang DP Rp ${rupiah(debt.uangDibayar)}?`)) {
      await dbActions.returnDebt(debt);
      await load();
    }
  }

  function rupiah(n) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }

  $: filteredData = purchases.filter((p) => {
    const pDate = new Date(p.tanggal);
    const now = new Date();

    const matchSeller =
      selectedSeller === "" ||
      p.sellerId?.toString() === selectedSeller.toString();
    const matchItem = selectedItem === "" || p.item === selectedItem;

    let matchTime = true;
    if (groupBy === "day") {
      matchTime = pDate.toDateString() === now.toDateString();
    } else if (groupBy === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      matchTime = pDate >= startOfWeek;
    } else if (groupBy === "month") {
      matchTime =
        pDate.getMonth() === now.getMonth() &&
        pDate.getFullYear() === now.getFullYear();
    }

    return matchSeller && matchItem && matchTime;
  });

  function getGroupedData(data) {
    const groups = {};
    data.forEach((p) => {
      const date = new Date(p.tanggal);
      let key = "Tanggal Tidak Diketahui";

      if (!isNaN(date.getTime())) {
        key =
          groupBy !== "day"
            ? date.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Transaksi Hari Ini";
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }

  onMount(load);
</script>

<div class="container">
  <div class="header-fixed">
    <div class="filter-split-buttons">
      <div
        class="filter-btn-trigger {selectedSeller !== '' ? 'has-value' : ''}"
        onclick={() => (showSellerModal = true)}
      >
        <User size={14} />
        <span class="btn-truncate">{currentSellerName}</span>
        <ChevronDown size={14} class="arrow-down" />
      </div>

      <div
        class="filter-btn-trigger {selectedItem !== '' ? 'has-value' : ''}"
        onclick={() => (showItemModal = true)}
      >
        <Package size={14} />
        <span class="btn-truncate">{currentItemName}</span>
        <ChevronDown size={14} class="arrow-down" />
      </div>
    </div>

    <div class="time-toggle">
      {#each [{ id: "none", label: "Semua" }, { id: "day", label: "Harian" }, { id: "week", label: "Mingguan" }, { id: "month", label: "Bulanan" }] as opt}
        <button
          class:active={groupBy === opt.id}
          onclick={() => (groupBy = opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="scroll-content">
    {#if filteredData.length === 0}
      <div class="empty"><p>Tidak ada riwayat transaksi.</p></div>
    {:else}
      {#each Object.entries(getGroupedData(filteredData)) as [groupName, list]}
        <div class="group-wrapper">
          <div class="group-title">
            <span>{groupName}</span>
            <span class="total-label"
              >Rp {rupiah(list.reduce((a, b) => a + b.total, 0))}</span
            >
          </div>

          {#each list as p}
            <div
              class="item-row {p.status === 'hutang'
                ? 'is-debt'
                : ''} {p.status === 'lunas-dp' ? 'is-settled-dp' : ''}"
              onclick={() => openDetail(p)}
            >
              <div class="info-main">
                <div class="name-wrapper">
                  <span class="seller-name">{p.sellerName || "Anonim"}</span>
                  {#if p.status === "hutang"}
                    <span class="badge-debt">Panjar Aktif</span>
                  {:else if p.status === "lunas-dp"}
                    <span class="badge-lunas-dp">DP Selesai</span>
                  {/if}
                </div>

                <span class="item-detail">
                  {p.item} • {p.jumlah}
                  {p.unit || "Kg"}
                  {#if p.jumlah && p.jumlah > 0}
                    <span class="unit-price-tag">
                      @ Rp {rupiah(Math.round(p.total / p.jumlah))} /{p.unit ||
                        "Kg"}
                    </span>
                  {/if}
                </span>

                {#if p.catatan}
                  <span class="note-text">💬 {p.catatan}</span>
                {/if}

                <span class="time-stamp">{formatTime(p.tanggal)}</span>
              </div>

              <div class="info-price">
                <span
                  class="total-price {p.status === 'lunas-dp'
                    ? 'total-price-muted'
                    : ''}">Rp {rupiah(p.total)}</span
                >
              </div>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>

  <div class="footer-fixed">
    <button class="fab-add" onclick={handleAddClick}>
      <span class="plus-icon">+</span>
      Tambah Pembelian Baru
    </button>

    <div class="footer-summary">
      <div class="summary-info">
        <span class="label">Total Omset</span>
        <span class="amount"
          >Rp {rupiah(filteredData.reduce((a, b) => a + b.total, 0))}</span
        >
      </div>
    </div>
  </div>
</div>

{#if showSellerModal}
  <div class="modal-overlay" onclick={() => (showSellerModal = false)}>
    <div class="filter-modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header-clean">
        <div>
          <h4>Pilih Petani / Penjual</h4>
          <p class="subtitle">
            Saring manifest berdasarkan nama nama terdaftar
          </p>
        </div>
        <button
          class="btn-close-circle"
          onclick={() => (showSellerModal = false)}><X size={18} /></button
        >
      </div>

      <div class="filter-modal-body">
        <input
          type="text"
          placeholder="Cari nama penjual..."
          bind:value={searchSellerQuery}
          class="modal-search-input"
        />
        <div class="pill-selector-area layout-vertical">
          <button
            class="list-pill-row"
            class:selected={selectedSeller === ""}
            onclick={() => {
              selectedSeller = "";
              showSellerModal = false;
            }}
          >
            <span>Semua Penjual</span>
            {#if selectedSeller === ""}<Check size={14} />{/if}
          </button>
          {#each filteredSellersInModal as s}
            <button
              class="list-pill-row"
              class:selected={selectedSeller?.toString() === s.id?.toString()}
              onclick={() => {
                selectedSeller = s.id; 
                showSellerModal = false; 
              }}
            >
              <span>{s.name}</span>
              {#if selectedSeller?.toString() === s.id?.toString()}<Check
                  size={14}
                />{/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showItemModal}
  <div class="modal-overlay" onclick={() => (showItemModal = false)}>
    <div class="filter-modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header-clean">
        <div>
          <h4>Pilih Jenis Barang</h4>
          <p class="subtitle">Saring manifest berdasarkan komoditas masuk</p>
        </div>
        <button class="btn-close-circle" onclick={() => (showItemModal = false)}
          ><X size={18} /></button
        >
      </div>

      <div class="filter-modal-body">
        <input
          type="text"
          placeholder="Cari nama barang..."
          bind:value={searchItemQuery}
          class="modal-search-input"
        />
        <div class="pill-selector-area layout-vertical">
          <button
            class="list-pill-row"
            class:selected={selectedItem === ""}
            onclick={() => {
              selectedItem = "";
              showItemModal = false;
            }}
          >
            <span>Semua Barang</span>
            {#if selectedItem === ""}<Check size={14} />{/if}
          </button>
          {#each filteredItemsInModal as i}
            <button
              class="list-pill-row"
              class:selected={selectedItem === i.name}
              onclick={() => {
                selectedItem = i.name; 
                showItemModal = false; 
              }}
            >
              <span>{i.name}</span>
              {#if selectedItem === i.name}<Check size={14} />{/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if $showAddPurchases}
  <AddPurchaseModal
    loadListBeli={load}
    on:close={() => {
      $showAddPurchases = false;
      load();
    }}
  />
{/if}

{#if showDetailModal && selectedTransaction}
  <div class="modal-overlay" onclick={closeDetail}>
    <div class="detail-card" onclick={(e) => e.stopPropagation()}>
      <div class="detail-header">
        <h3>Detail Transaksi</h3>
        <button class="btn-close" onclick={closeDetail}>&times;</button>
      </div>

      <div class="detail-body">
        <div class="detail-item">
          <label>Penjual</label>
          <p>{selectedTransaction.sellerName || "Anonim"}</p>
        </div>
        <div class="detail-item">
          <label>Barang</label>
          <p>
            {selectedTransaction.item} ({selectedTransaction.jumlah}
            {selectedTransaction.unit || "Kg"})
          </p>
        </div>
        <div class="detail-item">
          <label>Waktu</label>
          <p>{new Date(selectedTransaction.tanggal).toLocaleString("id-ID")}</p>
        </div>
        <div class="detail-item">
          <label>Total / DP</label>
          <p class="price-big">Rp {rupiah(selectedTransaction.total)}</p>
        </div>
        {#if selectedTransaction.catatan}
          <div class="detail-item">
            <label>Catatan</label>
            <p class="note-box">{selectedTransaction.catatan}</p>
          </div>
        {/if}
      </div>

      <div class="detail-actions">
        {#if selectedTransaction.status === "hutang"}
          <button
            class="btn-act receive"
            onclick={() => {
              handleTerimaBarang(selectedTransaction);
              closeDetail();
            }}
          >
            Terima Barang
          </button>
          <button
            class="btn-act return"
            onclick={() => {
              handleRetur(selectedTransaction);
              closeDetail();
            }}
          >
            Pembalikan Uang
          </button>
        {/if}

        <div class="action-row-bottom">
          <button
            class="btn-act edit"
            onclick={() => handleEdit(selectedTransaction)}>Edit</button
          >
          <button
            class="btn-act delete"
            onclick={() => {
              hapusTransaksi(
                selectedTransaction.id,
                selectedTransaction.status,
              );
              closeDetail();
            }}
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Seluruh kode CSS di bawah ini dibiarkan tetap utuh sesuai file asli Anda */
  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: #f8fafc;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .header-fixed {
    padding: 12px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .filter-split-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }

  .filter-btn-trigger {
    background: #f1f5f9;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: #475569;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.15s ease;
  }

  .filter-btn-trigger:active {
    background: #e2e8f0;
  }

  .filter-btn-trigger.has-value {
    background: #e0e7ff;
    border-color: #4f46e5;
    color: #4f46e5;
  }

  .btn-truncate {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .arrow-down {
    opacity: 0.6;
  }

  .time-toggle {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .time-toggle button {
    flex: 1;
    padding: 8px 14px;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    background: #f1f5f9;
    color: #475569;
    white-space: nowrap;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }

  .time-toggle button.active {
    color: white;
    background-color: #4f46e5;
    border-color: #4f46e5;
  }

  .scroll-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 12px 260px 12px;
  }

  .group-wrapper {
    background: white;
    margin-bottom: 12px;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }

  .group-title {
    background: #f8fafc;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
    border-bottom: 1px solid #e2e8f0;
    font-size: 12px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
  }

  .item-row:last-child {
    border-bottom: none;
  }
  .item-row:active {
    background-color: #f8fafc;
  }

  .info-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .seller-name {
    font-weight: 700;
    font-size: 15px;
    color: #0f172a;
  }
  .item-detail {
    font-size: 13px;
    color: #475569;
  }

  .unit-price-tag {
    display: inline-block;
    margin-left: 4px;
    color: #4f46e5;
    font-weight: 600;
    font-size: 11px;
    background: #f5f3ff;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .note-text {
    font-size: 12px;
    color: #059669;
    background: #ecfdf5;
    padding: 2px 6px;
    border-radius: 4px;
    align-self: flex-start;
    margin-top: 2px;
  }
  .time-stamp {
    font-size: 11px;
    color: #94a3b8;
  }
  .info-price {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .total-price {
    font-weight: 800;
    font-size: 15px;
    color: #0f172a;
  }

  .is-debt {
    border-left: 4px solid #f59e0b;
    background: #fffbeb !important;
  }
  .badge-debt {
    background: #fef3c7;
    color: #92400e;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .is-settled-dp {
    border-left: 4px solid #10b981;
    background-color: #f0fdf4 !important;
  }
  .badge-lunas-dp {
    background-color: #d1fae5;
    color: #065f46;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .total-price-muted {
    color: #94a3b8;
    text-decoration: line-through;
  }

  .filter-modal-content {
    background: white;
    width: 100%;
    max-width: 480px;
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    max-height: 75vh;
    box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.05);
  }

  .modal-header-clean {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }

  .modal-header-clean h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
  }
  .subtitle {
    margin: 3px 0 0 0;
    font-size: 12px;
    color: #64748b;
  }
  .btn-close-circle {
    background: #f1f5f9;
    border: none;
    border-radius: 50%;
    padding: 6px;
    color: #64748b;
    cursor: pointer;
  }

  .filter-modal-body {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-bottom: 20px;
  }

  .modal-search-input {
    padding: 12px;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-size: 14.5px;
    outline: none;
    margin-bottom: 12px;
  }

  .modal-search-input:focus {
    border-color: #4f46e5;
  }

  .pill-selector-area.layout-vertical {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .list-pill-row {
    width: 100%;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    color: #334155;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .list-pill-row:active {
    background: #f8fafc;
  }

  .list-pill-row.selected {
    background: #f5f3ff;
    border-color: #6366f1;
    color: #4f46e5;
    font-weight: 700;
  }

  .footer-fixed {
    position: fixed;
    bottom: 97px;
    left: 0;
    right: 0;
    padding: 14px;
    background: linear-gradient(to top, #f8fafc 85%, transparent);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
  }

  .fab-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    background: #4f46e5;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 12px;
    font-weight: bold;
    font-size: 15px;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    cursor: pointer;
  }

  .fab-add:active {
    transform: scale(0.98);
  }
  .footer-summary {
    background: #1e293b;
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
  }
  .summary-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-summary .label {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 700;
  }
  .amount {
    font-size: 16px;
    font-weight: 800;
    color: #10b981;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    display: flex;
    justify-content: center;
    align-items: flex-end;
    z-index: 100;
    backdrop-filter: blur(1.5px);
  }

  .detail-card {
    background: white;
    width: 100%;
    max-width: 480px;
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    padding: 20px;
    margin-bottom: 40px;
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }
  .btn-close {
    background: none;
    border: none;
    font-size: 24px;
    color: #999;
    cursor: pointer;
  }
  .detail-body {
    margin-bottom: 25px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .detail-item label {
    display: block;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .detail-item p {
    margin: 0;
    font-weight: 600;
    color: #2d3436;
  }
  .price-big {
    font-size: 20px;
    color: #4f46e5 !important;
    font-weight: 800 !important;
  }
  .note-box {
    background: #f0fdf4;
    padding: 10px;
    border-radius: 8px;
    font-style: italic;
    font-weight: normal !important;
    border-left: 3px solid #10b981;
    color: #16a34a;
  }
  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .btn-act {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    border: none;
    font-weight: bold;
    cursor: pointer;
  }
  .btn-act.receive {
    background: #4f46e5;
    color: white;
  }
  .btn-act.return {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }
  .action-row-bottom {
    display: flex;
    gap: 10px;
  }
  .btn-act.edit {
    background: #f1f5f9;
    color: #334155;
    flex: 1;
  }
  .btn-act.delete {
    background: #fee2e2;
    color: #dc2626;
    flex: 1;
  }
  .empty {
    text-align: center;
    padding: 40px;
    color: #94a3b8;
    font-style: italic;
    font-size: 14px;
  }
</style>