<script>
  import { onMount } from "svelte";
  import { getDB } from "$lib/api";
  import { goto } from "$app/navigation";
  import { initDB } from "$lib/jsondb";

  let summary = {
    totalUangKeluar: 0,
    totalUangKembali: 0,
    totalNilaiBarang: 0,
    sisaDP: 0,
    jumlahTransaksiHutang: 0
  };

  let topSellers = [];

  async function loadDashboard() {
    const db = await getDB();
    const purchases = db.purchases || [];
    const debts = db.debts || [];

    // 1. Hitung Uang Keluar (DP + Pelunasan Langsung)
    const uangKeluar = purchases.reduce((a, b) => a + (b.uangKeluar || 0), 0) + 
                       debts.reduce((a, b) => a + (b.uangDibayar || 0), 0);

    // 2. Hitung Uang yang Kembali (Retur)
    const uangKembali = purchases.reduce((a, b) => a + (b.uangKembali || 0), 0);

    // 3. Hitung Total Nilai Barang yang Sudah Diterima
    const nilaiBarang = purchases.reduce((a, b) => a + (b.total || 0), 0);

    // 4. Hitung Sisa DP yang masih aktif di tabel debts
    const sisaDP = debts.reduce((a, b) => a + (b.uangDibayar || 0), 0);

    summary = {
      totalUangKeluar: uangKeluar,
      totalUangKembali: uangKembali,
      totalNilaiBarang: nilaiBarang,
      sisaDP: sisaDP,
      jumlahTransaksiHutang: debts.length
    };
  }

  function rupiah(n) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(n);
  }

  onMount(async () => {
    await initDB();
  });

  onMount(loadDashboard);
</script>

<div class="dashboard-container">
  <header class="dash-header">
    <h1>Ringkasan Usaha</h1>
    <p>{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
  </header>

  <div class="stats-grid">
    <div class="stat-card highlight">
      <span class="label">DP Aktif (Uang di Penjual)</span>
      <span class="value text-orange">{rupiah(summary.sisaDP)}</span>
      <span class="sub-label">{summary.jumlahTransaksiHutang} Transaksi Menunggu</span>
    </div>

    <div class="stat-card">
      <span class="label">Total Uang Keluar</span>
      <span class="value">{rupiah(summary.totalUangKeluar)}</span>
    </div>

    <div class="stat-card">
      <span class="label">Total Nilai Barang Masuk</span>
      <span class="value text-green">{rupiah(summary.totalNilaiBarang)}</span>
    </div>

    <div class="stat-card">
      <span class="label">Total Uang Kembali (Retur)</span>
      <span class="value text-red">{rupiah(summary.totalUangKembali)}</span>
    </div>
  </div>

  <div class="quick-actions">
    <button class="btn-main" on:click={() => goto('purchases')}>
      Lihat Riwayat Transaksi
    </button>
  </div>
</div>

<style>
  .dashboard-container {
    padding: 20px;
    background: #f8f9fa;
    min-height: 100vh;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  .dash-header {
    margin-bottom: 25px;
  }

  .dash-header h1 {
    font-size: 24px;
    color: #2d3436;
    margin: 0;
  }

  .dash-header p {
    font-size: 14px;
    color: #636e72;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  /* Kartu Sisa DP dibuat full width agar menonjol */
  .stat-card.highlight {
    grid-column: span 2;
    background: #fff3e0;
    border-left: 5px solid #ff9800;
  }

  .stat-card {
    background: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .label {
    font-size: 12px;
    color: #636e72;
    font-weight: 600;
    text-transform: uppercase;
  }

  .value {
    font-size: 18px;
    font-weight: bold;
    color: #2d3436;
  }

  .sub-label {
    font-size: 11px;
    color: #b2bec3;
  }

  .text-orange { color: #e67e22; }
  .text-green { color: #27ae60; }
  .text-red { color: #d63031; }

  .quick-actions {
    margin-top: 30px;
  }

  .btn-main {
    width: 100%;
    padding: 15px;
    border: none;
    border-radius: 10px;
    background: #0984e3;
    color: white;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
  }

  /* Responsive untuk layar kecil */
  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
    .stat-card.highlight {
      grid-column: span 1;
    }
  }
</style>
