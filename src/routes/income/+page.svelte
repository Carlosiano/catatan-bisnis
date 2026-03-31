<script lang="ts">
  import { dbActions } from "$lib/api";
  import { onMount } from "svelte";
  import { page } from "$app/stores"; // Tambahkan ini
  import { goto } from "$app/navigation"; // Tambahkan ini
  import { ArrowLeft, Scale, Banknote, CheckCircle2 } from "lucide-svelte";

  let activeDebts = $state([]);
  let selectedDebt = $state(null);

  // Input untuk proses terima barang
  let qtyDiterima = $state<number | undefined>();
  let hargaPasarHariIni = $state<number | undefined>();

  // Ambil ID dari URL (?id=...)
  const targetId = $derived($page.url.searchParams.get("id"));

  async function loadDebts() {
    activeDebts = await dbActions.getOnlyDebts();

    // Jika ada ID di URL, otomatis pilih debt tersebut
    if (targetId && activeDebts.length > 0) {
      const found = activeDebts.find((d) => d.id === targetId);
      if (found) {
        selectDebt(found);
      }
    }
  }

  function selectDebt(debt) {
    selectedDebt = debt;
    // qtyDiterima = debt.jumlahSisa; // Otomatis isi dengan sisa janji
    hargaPasarHariIni = debt.harga || undefined; // Otomatis isi jika harga sudah pasti
  }

  async function handleSettle() {
    if (!qtyDiterima || !hargaPasarHariIni) {
      return alert("Masukkan jumlah barang dan harga pasar saat ini!");
    }

    if (qtyDiterima > selectedDebt.jumlahSisa) {
      return alert(`Jumlah melebihi sisa janji (${selectedDebt.jumlahSisa})`);
    }

    try {
      // Pastikan selectedDebt yang dikirim punya data saldoDPSisa terbaru
      await dbActions.settleDebt(selectedDebt, qtyDiterima, hargaPasarHariIni);
      alert("Barang diterima. Saldo DP berkurang.");

      // Alihkan ke halaman DP untuk melihat hasilnya
      goto("/dp");
    } catch (err) {
      alert("Gagal memproses transaksi.");
    }
  }

  onMount(loadDebts);

  const totalPotong = $derived((qtyDiterima ?? 0) * (hargaPasarHariIni ?? 0));
</script>

<div class="page-container">
  <header>
    <h2>Terima Barang (Potong DP)</h2>
    <p class="subtitle">Gunakan saldo DP untuk penerimaan barang baru</p>
  </header>

  {#if !selectedDebt}
    <div class="debt-list">
      {#each activeDebts as d}
        <button class="debt-card" onclick={() => selectDebt(d)}>
          <div class="card-main">
            <span class="seller-name">{d.sellerName}</span>
            <span class="item-info">{d.item} ({d.unit})</span>
          </div>
          <div class="card-stats">
            <div class="stat">
              <label>Sisa Janji</label>
              <span class="val">{d.jumlahSisa} {d.unit}</span>
            </div>
            <div class="stat">
              <label>Sisa Saldo DP</label>
              <span class="val price">Rp {d.saldoDPSisa.toLocaleString()}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="settle-form">
      <button
        class="btn-back"
        onclick={() => {
          selectedDebt = null;
          goto("/income");
        }}
      >
        <ArrowLeft size={18} /> Kembali ke daftar
      </button>

      <div class="info-box">
        <h4>{selectedDebt.sellerName} - {selectedDebt.item}</h4>
        <div class="grid-info">
          <span
            ><Scale size={14} /> Sisa Janji:
            <b>{selectedDebt.jumlahSisa} {selectedDebt.unit}</b></span
          >
          <span
            ><Banknote size={14} /> Saldo DP:
            <b>Rp {selectedDebt.saldoDPSisa.toLocaleString()}</b></span
          >
        </div>
      </div>

      <div class="input-section">
        <div class="input-group">
          <label>Jumlah Barang Diterima ({selectedDebt.unit})</label>
          <input type="number" bind:value={qtyDiterima} placeholder="0" />
        </div>

        <div class="input-group">
          <label>Harga Pasar Per {selectedDebt.unit} (Hari Ini)</label>
          <input
            type="number"
            bind:value={hargaPasarHariIni}
            placeholder="Rp 0"
          />
        </div>

        <div class="calculation-box">
          <div class="calc-row">
            <span>Total Nilai Barang:</span>
            <span>Rp {totalPotong.toLocaleString()}</span>
          </div>
          <div class="calc-row result">
            <span>Sisa Saldo DP Nanti:</span>
            <span
              class={selectedDebt.saldoDPSisa - totalPotong < 0
                ? "negatif"
                : ""}
            >
              Rp {(selectedDebt.saldoDPSisa - totalPotong).toLocaleString()}
            </span>
          </div>
        </div>

        <button class="btn-confirm" onclick={handleSettle}>
          <CheckCircle2 size={18} /> Konfirmasi Penerimaan
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-container {
    padding: 20px;
    max-width: 600px;
    margin: 0 auto;
  }
  header {
    margin-bottom: 25px;
  }
  h2 {
    margin: 0;
    color: #333;
  }
  .subtitle {
    font-size: 13px;
    color: #666;
  }

  .debt-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .debt-card {
    background: white;
    border: 1.5px solid #eee;
    border-radius: 16px;
    padding: 16px;
    text-align: left;
    cursor: pointer;
    transition: 0.2s;
  }
  .debt-card:hover {
    border-color: #db3434;
    background: #fffcfc;
  }
  .seller-name {
    display: block;
    font-weight: bold;
    font-size: 16px;
  }
  .item-info {
    font-size: 13px;
    color: #666;
  }

  .card-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 12px;
    border-top: 1px dashed #eee;
    pt: 10px;
  }
  .stat label {
    font-size: 10px;
    color: #999;
    display: block;
    text-transform: uppercase;
  }
  .stat .val {
    font-weight: bold;
    font-size: 14px;
  }
  .price {
    color: #27ae60;
  }

  .settle-form {
    background: #f9f9f9;
    padding: 20px;
    border-radius: 20px;
  }
  .btn-back {
    background: none;
    border: none;
    color: #666;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    margin-bottom: 15px;
  }

  .info-box {
    background: white;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  .grid-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    margin-top: 10px;
    color: #555;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  input {
    width: 100%;
    padding: 14px;
    border: 1.5px solid #ddd;
    border-radius: 12px;
    font-size: 16px;
  }

  .calculation-box {
    background: #333;
    color: white;
    padding: 15px;
    border-radius: 12px;
  }
  .calc-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    opacity: 0.8;
    margin-bottom: 5px;
  }
  .result {
    border-top: 1px solid #555;
    padding-top: 5px;
    opacity: 1;
    font-weight: bold;
    font-size: 15px;
  }
  .negatif {
    color: #ff6b6b;
  }

  .btn-confirm {
    background: #db3434;
    color: white;
    border: none;
    padding: 16px;
    border-radius: 12px;
    font-weight: bold;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
</style>
