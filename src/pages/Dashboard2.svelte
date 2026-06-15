<script lang="ts">
  import { onMount } from "svelte";
  import { dbActions } from "$lib/api";
  import { 
    TrendingUp, 
    Wallet, 
    Scale, 
    ArrowUpRight, 
    ArrowDownLeft, 
    ChevronRight,
    ShoppingBag
  } from "lucide-svelte";

  // --- States (Svelte 5 Runes) ---
  let loading = $state(true);
  let summary = $state({
    totalBeli: 0,
    totalPanjarAktif: 0,
    transaksiHariIni: 0,
  });
  let recentTransactions = $state([]);

  async function loadDashboardData() {
    try {
      loading = true;
      
      // Ambil data dari API Database SQLite universal
      const [allPurchases, allDebts] = await Promise.all([
        dbActions.getAllTransactions(),
        dbActions.getOnlyDebts()
      ]);

      // 1. Hitung Total Pengeluaran Beli Tunai
      const totalBeli = allPurchases.reduce((sum, p) => sum + (p.total || 0), 0);

      // 2. Hitung Total Saldo Panjar/DP yang masih aktif menggantung di Petani
      const totalPanjarAktif = allDebts
        .filter(d => d.status === 'hutang')
        .reduce((sum, d) => sum + (d.saldoDPSisa || 0), 0);

      // 3. Hitung Jumlah Transaksi Hari Ini
      const todayStr = new Date().toDateString();
      const tglHariIni = allPurchases.filter(p => new Date(p.tanggal).toDateString() === todayStr).length;

      summary = {
        totalBeli,
        totalPanjarAktif,
        transaksiHariIni: tglHariIni
      };

      // Ambil 5 transaksi terakhir untuk riwayat ringkas
      recentTransactions = allPurchases.slice(0, 5);

    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    } finally {
      loading = false;
    }
  }

  function rupiah(n: number) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }

  function formatTanggalMurni(txtDate: string) {
    if (!txtDate) return "-";
    const d = new Date(txtDate);
    if (isNaN(d.getTime())) return txtDate;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  }

  onMount(loadDashboardData);
</script>

<div class="dashboard-container">
  <header class="dash-header">
    <div class="welcome">
      <h2>Ringkasan Bisnis</h2>
      <p class="subtitle">Pantau kas tunai, panjar kelapa, dan aktivitas hari ini</p>
    </div>
    <div class="date-tag">
      {new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long' })}
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <p>Memuat ringkasan data...</p>
    </div>
  {:else}
    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="card-icon">
          <TrendingUp size={20} />
        </div>
        <div class="card-info">
          <span class="card-label">Total Pembelian</span>
          <h3 class="card-value">Rp {rupiah(summary.totalBeli)}</h3>
          <span class="card-hint">Murni kas keluar tunai</span>
        </div>
      </div>

      <div class="stat-card orange">
        <div class="card-icon">
          <Wallet size={20} />
        </div>
        <div class="card-info">
          <span class="card-label">Sisa Panjar Aktif</span>
          <h3 class="card-value">Rp {rupiah(summary.totalPanjarAktif)}</h3>
          <span class="card-hint">Uang masih di petani</span>
        </div>
      </div>

      <div class="stat-card green">
        <div class="card-icon">
          <ShoppingBag size={20} />
        </div>
        <div class="card-info">
          <span class="card-label">Manifest Hari Ini</span>
          <h3 class="card-value">{summary.transaksiHariIni} Nota</h3>
          <span class="card-hint">Penerimaan kelapa baru</span>
        </div>
      </div>
    </div>

    <div class="content-section">
      <div class="quick-actions">
        <h3>Akses Cepat</h3>
        <div class="action-buttons">
          <a href="/beli" class="btn-action t-tunai">
            <ArrowUpRight size={16} /> Beli Tunai Baru
          </a>
          <a href="/terima" class="btn-action t-potong">
            <ArrowDownLeft size={16} /> Potong Panjar Kelapa
          </a>
        </div>
      </div>

      <div class="recent-section">
        <div class="section-title">
          <h3>Aktivitas Terakhir</h3>
          <a href="/beli" class="view-all">Semua <ChevronRight size={14} /></a>
        </div>

        <div class="recent-list">
          {#each recentTransactions as t}
            <div class="transaction-row">
              <div class="tx-meta">
                <span class="tx-date">{formatTanggalMurni(t.tanggal)}</span>
                <div class="tx-details">
                  <span class="tx-seller">{t.sellerName || "Anonim"}</span>
                  <span class="tx-item">{t.item} • {t.jumlah} {t.unit || 'Subur'}</span>
                </div>
              </div>
              <div class="tx-amount-box">
                <span class="tx-amount">Rp {rupiah(t.total)}</span>
                <span class="tx-status {t.catatan.includes('Potong') ? 'potong' : 'tunai'}">
                  {t.catatan.includes('Potong') ? 'Potong DP' : 'Tunai'}
                </span>
              </div>
            </div>
          {:else}
            <p class="empty-text">Belum ada aktivitas transaksi yang tercatat.</p>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* --- Dashboard Layout --- */
  .dashboard-container {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px 15px 120px 15px; /* Jarak bawah agar aman dari navigasi menu */
    font-family: system-ui, -apple-system, sans-serif;
    background-color: #f8fafc;
    min-height: 100vh;
  }

  .dash-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 25px;
  }

  .dash-header h2 {
    margin: 0;
    font-size: 22px;
    color: #1e293b;
    font-weight: 700;
  }

  .subtitle {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: #64748b;
  }

  .date-tag {
    font-size: 11px;
    background: #e2e8f0;
    color: #475569;
    padding: 4px 10px;
    border-radius: 20px;
    font-weight: 600;
  }

  /* --- Stats Grid & Cards --- */
  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 25px;
  }

  .stat-card {
    background: white;
    border-radius: 16px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 15px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.01);
  }

  .card-icon {
    padding: 12px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Warna Dinamis Tema Card */
  .stat-card.blue .card-icon { background: #eff6ff; color: #2563eb; }
  .stat-card.orange .card-icon { background: #fffbeb; color: #d97706; }
  .stat-card.green .card-icon { background: #f0fdf4; color: #16a34a; }

  .card-info {
    display: flex;
    flex-direction: column;
  }

  .card-label {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .card-value {
    margin: 2px 0;
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
  }

  .card-hint {
    font-size: 11px;
    color: #94a3b8;
    font-style: italic;
  }

  /* --- Content & Actions --- */
  .quick-actions h3, .recent-section h3 {
    font-size: 14px;
    color: #334155;
    margin: 0 0 12px 0;
    font-weight: 600;
  }

  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 25px;
  }

  .btn-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
  }

  .btn-action.t-tunai { background: #2563eb; color: white; }
  .btn-action.t-potong { background: #1e293b; color: white; }

  /* --- Riwayat Transaksi Section --- */
  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .view-all {
    font-size: 12px;
    color: #2563eb;
    text-decoration: none;
    display: flex;
    align-items: center;
    font-weight: 500;
  }

  .recent-list {
    background: white;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    padding: 4px 14px;
  }

  .transaction-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .transaction-row:last-child {
    border-bottom: none;
  }

  .tx-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tx-date {
    font-size: 11px;
    color: #64748b;
    background: #f1f5f9;
    padding: 4px 6px;
    border-radius: 6px;
    font-weight: bold;
    text-align: center;
    min-width: 45px;
  }

  .tx-details {
    display: flex;
    flex-direction: column;
  }

  .tx-seller {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
  }

  .tx-item {
    font-size: 12px;
    color: #64748b;
  }

  .tx-amount-box {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .tx-amount {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
  }

  .tx-status {
    font-size: 9px;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .tx-status.tunai { background: #e0f2fe; color: #0369a1; }
  .tx-status.potong { background: #fef3c7; color: #b45309; }

  .loading-state, .empty-text {
    text-align: center;
    padding: 30px;
    font-size: 13px;
    color: #94a3b8;
    font-style: italic;
  }
</style>