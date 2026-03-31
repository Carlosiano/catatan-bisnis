<!-- Purchases.svelte -->
<script>
  import { onMount } from "svelte";
  import Database from "@tauri-apps/plugin-sql"; // Import Plugin Tauri
  import AddPurchaseModal from "$components/AddPurchaseModal.svelte";
  import { showAddPurchases } from "$lib/stores";
  import { dbActions, initDB } from "$lib/api"; // Import dari api.js
  import AddPurchaseModalNew from "$components/AddPurchaseModalNew.svelte";
  import { goto } from "$app/navigation";

  let sellers = [];
  let purchases = [];
  let items = [];
  let db; // Variabel untuk menampung koneksi DB

  let groupBy = "none";
  let selectedSeller = "";
  let selectedItem = "";
  let selectedId = null;

  function toggleDelete(id) {
    selectedId = selectedId === id ? null : id;
  }

  async function load() {
    try {
      db = await initDB();

      // Ambil master data DULUAN agar getSellerName punya referensi
      const sData = await db.select("SELECT * FROM sellers ORDER BY name ASC");
      sellers = sData;

      const iData = await db.select("SELECT * FROM items ORDER BY name ASC");
      items = iData;

      // Baru ambil transaksi
      const data = await dbActions.getAllTransactions();
      purchases = [...data];
    } catch (err) {
      console.error("Gagal memuat data:", err);
    }
  }

  async function hapusTransaksi(id, status) {
    if (!confirm("Hapus transaksi ini selamanya?")) return;

    try {
      const table = status === "hutang" ? "debts" : "purchases";
      await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);

      selectedId = null;
      await load(); // Refresh data tanpa reload halaman
    } catch (err) {
      alert("Gagal menghapus data");
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  async function handleTerimaBarang(debt) {
    // Arahkan ke route income sambil membawa ID debt sebagai query parameter
    goto(`/income?id=${debt.id}`);
  }

  // async function handleTerimaBarang(debt) {
  //   const promptValue = prompt(
  //     `Berapa ${debt.unit} yang diterima?`,
  //     debt.jumlahSisa,
  //   );

  //   if (!promptValue) return;

  //   const jumlahMasuk = parseFloat(promptValue);
  //   const hargaSatuan = parseFloat(debt.harga || 0);
  //   const dpSudahMasuk = parseFloat(debt.uangDibayar || 0);

  //   // Hitung total harga barang yang baru datang
  //   const totalHargaBarangBaru = jumlahMasuk * hargaSatuan;

  //   // Tambah bayar hanya jika harga barang baru > DP yang tersedia
  //   const uangTambahan = Math.max(0, totalHargaBarangBaru - dpSudahMasuk);

  //   if (
  //     confirm(
  //       `Terima ${jumlahMasuk} ${debt.unit}?\nTotal Harga: Rp ${rupiah(totalHargaBarangBaru)}\nDP Terpakai: Rp ${rupiah(Math.min(totalHargaBarangBaru, dpSudahMasuk))}\n-------------------\nTambah Bayar: Rp ${rupiah(uangTambahan)}`,
  //     )
  //   ) {
  //     try {
  //       await dbActions.settleDebt(debt, jumlahMasuk, uangTambahan);
  //       await load();
  //     } catch (err) {
  //       console.error(err);
  //       alert("Gagal memproses penerimaan barang");
  //     }
  //   }
  // }

  async function handleRetur(debt) {
    if (confirm(`Kembalikan uang DP Rp ${rupiah(debt.uangDibayar)}?`)) {
      await dbActions.returnDebt(debt);
      await load();
    }
  }

  // Fungsi helper rupiah
  function rupiah(n) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }

  function getSellerName(id) {
    if (!sellers || sellers.length === 0) return "Memuat...";
    // Gunakan == agar lebih fleksibel dibanding === jika ada perbedaan tipe data
    const seller = sellers.find((s) => s.id.toString() === id?.toString());
    return seller ? seller.name : "Anonim";
  }

  // Logika Filter & Grouping tetap sama (menggunakan reactive Svelte)
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
      startOfWeek.setHours(0, 0, 0, 0); // Reset jam ke 00:00
      matchTime = pDate >= startOfWeek;
    } else if (groupBy === "month") {
      matchTime =
        pDate.getMonth() === now.getMonth() &&
        pDate.getFullYear() === now.getFullYear();
    }
    // Jika groupBy === "none", matchTime tetap true (lolos semua)

    return matchSeller && matchItem && matchTime;
  });

  // Fungsi grouping data (tetap sama)
  function getGroupedData(data) {
    const groups = {};
    data.forEach((p) => {
      const date = new Date(p.tanggal);
      let key =
        groupBy !== "day"
          ? date.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Transaksi Hari Ini";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }

  onMount(load);
</script>

{#if $showAddPurchases}
  <AddPurchaseModalNew
    on:close={() => {
      $showAddPurchases = false;
      load();
    }}
  />
{/if}

<div class="container">
  <div class="filter-card">
    <div class="time-toggle">
      {#each [{ id: "none", label: "Semua" }, { id: "day", label: "Harian" }, { id: "week", label: "Mingguan" }, { id: "month", label: "Bulanan" }] as opt}
        <button
          class:active={groupBy === opt.id}
          on:click={() => (groupBy = opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    <div class="dropdown-grid">
      <div class="field">
        <label>Penjual</label>
        <select bind:value={selectedSeller}>
          <option value="">-- Semua Penjual --</option>
          {#each sellers as s}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <label>Barang</label>
        <select bind:value={selectedItem}>
          <option value="">-- Semua Barang --</option>
          {#each items as i}
            <option value={i.name}>{i.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- {#if sellerDebtInfo}
      <div class="debt-info-box">
        <div class="debt-row">
          <span>Uang Keluar (Bon):</span>
          <span class="text-red">Rp {rupiah(sellerDebtInfo.borrowed)}</span>
        </div>
        <div class="debt-row">
          <span>Barang Masuk:</span>
          <span class="text-green">Rp {rupiah(sellerDebtInfo.delivered)}</span>
        </div>
        <div class="debt-divider"></div>
        <div class="debt-row total">
          <span>Sisa Utang Penjual:</span>
          <span
            class={sellerDebtInfo.balance >= 0 ? "status-debt" : "status-plus"}
          >
            {sellerDebtInfo.balance >= 0 ? "" : "(Kelebihan) "} Rp {rupiah(
              Math.abs(sellerDebtInfo.balance),
            )}
          </span>
        </div>
      </div>
    {/if} -->
  </div>

  <div class="content">
    {#if filteredData.length === 0}
      <div class="empty"><p>Tidak ada transaksi.</p></div>
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
  class="item-row"
  /* Tetap beri style DP jika statusnya 'hutang' ATAU 'lunas-dp' */
  class:is-debt={p.status === "hutang" || p.status === "lunas-dp"}
  class:selected={selectedId === p.id}
  on:click={() => toggleDelete(p.id)}
>
              <div class="info-main">
                <div class="name-wrapper">
                  <span class="seller-name">{getSellerName(p.sellerId)}</span>
                </div>
                {#if p.status === "hutang"}
                  <span class="badge-debt"
                    >MENUNGGU {p.jumlahSisa} {p.unit}</span
                  >
                {:else if p.catatan && p.catatan.includes("Lunas")}
                  <span class="badge-settled">LUNAS DP</span>
                {/if}
                <span class="item-detail">
                  {p.item} • {p.jumlah !== undefined
                    ? p.jumlah
                    : p.jumlahJanji || 0}
                  {p.unit}
                </span>

                {#if p.catatan}
                  <span class="note-text">{p.catatan}</span>
                {/if}

                <span class="time-stamp">{formatTime(p.tanggal)}</span>
              </div>

              <div class="info-price">
                {#if p.status === "hutang"}
                  <div class="dp-info">
                    <span class="dp-label">DP Masuk:</span>
                    <span class="dp-amount">Rp {rupiah(p.uangDibayar)}</span>
                  </div>

                  <div class="action-buttons">
                    <button
                      class="btn-receive"
                      on:click|stopPropagation={() => handleTerimaBarang(p)}
                    >
                      Terima Barang
                    </button>

                    <button
                      class="btn-cancel-debt"
                      on:click|stopPropagation={() => handleRetur(p)}
                    >
                      Pembalikan Uang
                    </button>
                  </div>
                {:else}
                  <span class="total-price">Rp {rupiah(p.total)}</span>
                  {#if p.uangKembali}
                    <span class="text-green" style="font-size: 11px;"
                      >(Uang Kembali)</span
                    >
                  {/if}
                {/if}

                {#if selectedId === p.id}
                  <button
                    class="btn-quick-delete"
                    on:click|stopPropagation={() =>
                      hapusTransaksi(p.id, p.status)}
                  >
                    HAPUS
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>

  <div class="footer-summary">
    <div class="summary-info">
      <span class="label">Total Pembelian</span>
      <span class="amount"
        >Rp {rupiah(filteredData.reduce((a, b) => a + b.total, 0))}</span
      >
    </div>
  </div>
</div>

<style>
  /* CSS TAMBAHAN UNTUK UTANG & BARIS */
  .debt-info-box {
    margin-top: 15px;
    padding: 12px;
    background: #fff9f0;
    border-radius: 8px;
    border: 1px solid #ffeaa7;
  }
  .debt-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    margin-bottom: 4px;
  }
  .debt-divider {
    height: 1px;
    background: #ddd;
    margin: 8px 0;
  }
  .debt-row.total {
    font-weight: bold;
    font-size: 14px;
  }

  .status-debt {
    color: #d63031;
  } /* Penjual masih utang kita */
  .status-plus {
    color: #00b894;
  } /* Kita yang utang ke penjual */
  .text-red {
    color: #d63031;
  }
  .text-green {
    color: #00b894;
  }
  .name-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Label UTANG */
  .badge-debt {
    background: #e74c3c;
    color: white;
    font-size: 9px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  /* Baris yang statusnya utang akan punya border kiri merah */
  .item-row.is-debt {
    border-left: 4px solid #e74c3c;
    background: #fffafa; /* Background agak kemerahan tipis */
  }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    border-bottom: 1px solid #eee;
    transition: background 0.2s;
    position: relative;
    cursor: pointer;
  }

  /* Memberi warna berbeda saat baris dipilih */
  .item-row.selected {
    background-color: #f0f7ff !important;
  }

  .btn-quick-delete {
    margin-top: 10px;
    background-color: #ff4757;
    color: white;
    border: none;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(255, 71, 87, 0.3);
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .btn-quick-delete:hover {
    background-color: #ff6b81;
  }

  .info-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .seller-name {
    font-weight: bold;
    font-size: 1rem;
    color: #2d3436;
  }
  .item-detail {
    font-size: 13px;
    color: #636e72;
  }
  .time-stamp {
    font-size: 0.8rem;
    color: #b2bec3;
  }

  .info-price {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .unit-price {
    font-size: 12px;
    color: #636e72;
    background: #f1f2f6;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .total-price {
    font-weight: bold;
    font-size: 15px;
    color: #007bff;
  }

  /* Style Container & Filter Card tetap seperti sebelumnya... */
  .container {
    padding: 10px;
    padding-bottom: 140px;
    font-family: sans-serif;
    background: #f4f7f6;
    min-height: 100vh;
  }
  .filter-card {
    background: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    margin-bottom: 15px;
  }
  .time-toggle {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 10px;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
  }
  .time-toggle button {
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid #ddd;
    background: white;
    white-space: nowrap;
    cursor: pointer;
    font-size: 14px;
  }
  .time-toggle button.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
  .dropdown-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .group-wrapper {
    background: white;
    margin-bottom: 20px;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }
  .group-title {
    background: #f8f9fa;
    padding: 12px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    border-bottom: 2px solid #007bff;
  }

  .group-title span {
    font-size: 0.9rem;
  }
  .footer-summary {
    position: fixed;
    bottom: 104px;
    left: 15px;
    right: 15px;
    background: #2d3436;
    color: white;
    padding: 15px 20px;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }
  .summary-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .amount {
    font-size: 18px;
    font-weight: bold;
    color: #00cec9;
  }

  .btn-receive {
    background: #3498db;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
  }
  .btn-receive:hover {
    background: #2980b9;
    transform: scale(1.05);
  }
  .badge-debt {
    background: #f39c12;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.2rem;
  }

  .is-debt {
    background: #fff9f9 !important;
    border-left: 5px solid #d63031 !important;
  }
  .badge-settled {
    background: #2ecc71; /* Warna hijau */
    color: white;
    font-size: 9px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .note-text {
    font-size: 10px;
    color: #27ae60;
    font-style: italic;
    margin-top: 2px;
  }
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .btn-cancel-debt {
    background: #f1f2f6;
    color: #e74c3c;
    border: 1px solid #e74c3c;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
  }
  .btn-cancel-debt:hover {
    background: #ffeaea;
  }

  .dp-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px dashed #fab1a0; /* Garis tipis pemisah */
  }

  .dp-label {
    font-size: 10px;
    color: #e17055;
    text-transform: uppercase;
    font-weight: bold;
  }

  .dp-amount {
    font-size: 14px;
    font-weight: bold;
    color: #d63031;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
  }

  /* Tambahan agar tombol tidak terlalu lebar jika di desktop */
  .btn-receive,
  .btn-cancel-debt {
    min-width: 100px;
  }
</style>
