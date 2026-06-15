<!-- Panjar.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { dbActions } from "$lib/api";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation"; // Import navigasi SvelteKit
  import { X, Calendar, Package, User, ChevronRight, RefreshCcw } from "lucide-svelte";

  // --- States (Svelte 5) ---
  let debts = $state([]);
  let loading = $state(true);
  let selectedDebt = $state(null);
  let showModal = $state(false);

  // --- Derived (Svelte 5) ---
  const totalDPOutstanding = $derived(
    debts.reduce((sum, d) => sum + (d.saldoDPSisa ?? d.uangDibayar ?? 0), 0),
  );
  const totalBarangTunggu = $derived(debts.length);

  async function loadData() {
    loading = true;
    debts = await dbActions.getOnlyDebts();
    loading = false;
  }

  function openDetail(debt) {
    selectedDebt = debt;
    showModal = true;
  }

  function closeDetail() {
    showModal = false;
    selectedDebt = null;
  }

  // Fungsi navigasi ke halaman income dengan ID spesifik
  function goToReceive(id: string) {
    goto(`/terima?id=${id}`);
  }

  function rupiah(n: number) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }

  function hitungPersen(sisa: number, janji: number) {
    const masuk = janji - sisa;
    if (janji === 0) return 0;
    return Math.round((masuk / janji) * 100);
  }

  onMount(loadData);
</script>

<div class="debt-container">
  <div class="summary-grid">
    <div class="stat-card purple">
      <span class="stat-label">Total DP di Penjual</span>
      <span class="stat-value">Rp {rupiah(totalDPOutstanding)}</span>
      <span class="stat-sub">Dari {totalBarangTunggu} transaksi aktif</span>
    </div>
  </div>

  <div class="header-section">
    <h3>Daftar Tunggu Barang (DP)</h3>
    <button class="btn-refresh" onclick={loadData}><RefreshCcw size=20 /> Segarkan</button>
  </div>

  {#if loading}
    <div class="loading">Memuat data hutang...</div>
  {:else if debts.length === 0}
    <div class="empty-state" in:fade>
      <p>🎉 Semua barang sudah diterima atau tidak ada DP aktif.</p>
    </div>
  {:else}
    <div class="debt-list">
      {#each debts as d (d.id)}
        <div class="debt-card" in:slide>
          <div class="card-top">
            <div class="seller-info" onclick={() => openDetail(d)}>
              <span class="seller-name">{d.sellerName || "Anonim"}</span>
              <span class="item-name">{d.item}</span>
            </div>
            <div class="date-badge">
              {new Date(d.tanggal).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
              })}
            </div>
          </div>

          <div class="progress-container">
            <div class="progress-text">
              <span
                >Progres: <b
                  >{d.jumlahJanji - d.jumlahSisa} / {d.jumlahJanji} {d.unit}</b
                ></span
              >
              <span>{hitungPersen(d.jumlahSisa, d.jumlahJanji)}%</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: {hitungPersen(d.jumlahSisa, d.jumlahJanji)}%"
              ></div>
            </div>
          </div>

          <div class="card-actions-grid">
            <button class="btn-detail" onclick={() => openDetail(d)}>
              Detail
            </button>
            <button class="btn-receive-quick" onclick={() => goToReceive(d.id)}>
              Terima Barang <ChevronRight size={14} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showModal && selectedDebt}
  <div
    class="modal-overlay"
    transition:fade={{ duration: 200 }}
    onclick={closeDetail}
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      in:slide={{ y: 50 }}
    >
      <div class="modal-header">
        <h4>Detail Transaksi DP</h4>
        <button class="close-icon" onclick={closeDetail}><X size={20} /></button
        >
      </div>

      <div class="modal-body">
        <div class="info-group">
          <div class="info-row">
            <User size={16} class="icon" />
            <span>Penjual: <strong>{selectedDebt.sellerName}</strong></span>
          </div>
          <div class="info-row">
            <Package size={16} class="icon" />
            <span
              >Barang: <strong>{selectedDebt.item}</strong>
              ({selectedDebt.unit})</span
            >
          </div>
          <div class="info-row">
            <Calendar size={16} class="icon" />
            <span
              >Tanggal: {new Date(selectedDebt.tanggal).toLocaleDateString(
                "id-ID",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                },
              )}</span
            >
          </div>
        </div>

        <div class="calc-box">
          <div class="calc-row">
            <span>Pesanan Awal:</span>
            <span>{selectedDebt.jumlahJanji} {selectedDebt.unit}</span>
          </div>
          <div class="calc-row">
            <span>Sudah Diterima:</span>
            <span class="text-green"
              >{selectedDebt.jumlahJanji - selectedDebt.jumlahSisa}
              {selectedDebt.unit}</span
            >
          </div>
          <div class="calc-row divider">
            <span>Sisa Menunggu:</span>
            <span class="text-red"
              ><strong>{selectedDebt.jumlahSisa} {selectedDebt.unit}</strong
              ></span
            >
          </div>
        </div>

        <div class="payment-box">
          <div class="calc-row">
            <span>Saldo DP Awal:</span>
            <span class="text-green">Rp {rupiah(selectedDebt.uangDibayar)}</span
            >
          </div>
        </div>

        <div class="payment-box">
          <div class="calc-row">
            <span>Sisa Saldo DP Saat Ini:</span>
            <span class="text-green">
              Rp {rupiah(selectedDebt.saldoDPSisa ?? selectedDebt.uangDibayar)}
            </span>
          </div>

          {#if selectedDebt.saldoDPSisa !== null && selectedDebt.saldoDPSisa !== selectedDebt.uangDibayar}
            <div
              class="calc-row"
              style="font-size: 11px; opacity: 0.6; margin-top: -5px;"
            >
              <span>Modal Awal: Rp {rupiah(selectedDebt.uangDibayar)}</span>
            </div>
          {/if}
        </div>

        <button
          class="btn-main-action"
          onclick={() => goToReceive(selectedDebt.id)}
        >
          Proses Penerimaan Barang
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* --- Style Baru untuk Navigasi --- */
  .card-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 10px;
  }

  .btn-detail {
    padding: 10px;
    border: 1px solid #dfe6e9;
    background: white;
    border-radius: 8px;
    color: #636e72;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-receive-quick {
    padding: 10px;
    background: #6c5ce7;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 13px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  }

  .btn-main-action {
    width: 100%;
    padding: 16px;
    background: #6c5ce7;
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: bold;
    font-size: 15px;
    cursor: pointer;
    margin-top: 10px;
  }

  /* --- Styles Original (dengan sedikit perbaikan) --- */
  .debt-container {
    padding: 15px;
    background: #f8f9fa;
    min-height: 100vh;
    padding-bottom: 120px;
  }
  .summary-grid {
    margin-bottom: 25px;
  }
  .stat-card {
    padding: 20px;
    border-radius: 16px;
    color: white;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  .stat-card.purple {
    background: linear-gradient(135deg, #6c5ce7, #a29bfe);
  }
  .stat-label {
    font-size: 14px;
    opacity: 0.9;
  }
  .stat-value {
    font-size: 24px;
    font-weight: bold;
    margin: 5px 0;
  }
  .stat-sub {
    font-size: 12px;
    opacity: 0.8;
  }

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  .debt-card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 15px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #edf2f7;
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    cursor: pointer;
  }
  .seller-name {
    display: block;
    font-weight: bold;
    font-size: 16px;
    color: #2d3436;
  }
  .item-name {
    font-size: 13px;
    color: #636e72;
  }
  .date-badge {
    font-size: 11px;
    background: #f1f2f6;
    padding: 4px 8px;
    border-radius: 6px;
    color: #636e72;
  }

  .progress-container {
    margin-bottom: 15px;
  }
  .progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 6px;
  }
  .progress-bar {
    height: 8px;
    background: #eee;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #fdcb6e;
    border-radius: 4px;
    transition: width 0.5s ease;
  }

  /* MODAL STYLES */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }
  .modal-content {
    background: white;
    width: 100%;
    max-width: 500px;
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    padding: 24px;
    padding-bottom: 40px;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .close-icon {
    background: #f1f2f6;
    border: none;
    border-radius: 50%;
    padding: 8px;
    cursor: pointer;
  }
  .info-group {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
  }
  .info-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .icon {
    color: #6c5ce7;
  }
  .calc-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
  }
  .calc-row.divider {
    border-top: 1px dashed #ddd;
    padding-top: 10px;
    margin-top: 10px;
    font-weight: bold;
  }
  .text-green {
    color: #00b894;
  }
  .text-red {
    color: #d63031;
  }
  .btn-refresh {
    background: none;
    border: none;
    color: #0984e3;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
  }
</style>
