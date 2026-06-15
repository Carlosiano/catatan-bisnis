<script lang="ts">
  import { dbActions } from "$lib/api";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    ArrowLeft,
    Scale,
    Banknote,
    CheckCircle2,
    Package,
    Calendar,
    Coins,
    ChevronRight,
    Calculator,
  } from "lucide-svelte";

  // --- States ---
  let activeDebts = $state([]);
  let selectedDebt = $state(null);
  let history = $state([]);
  let masterItems = $state([]);

  let qtyDiterima = $state<number | undefined>();
  let hargaPasarHariIni = $state<number | undefined>();
  let nominalPotongPanjar = $state<number | undefined>();

  let editItem = $state("");
  let editUnit = $state("");

  // --- Derived States ---
  const targetId = $derived($page.url.searchParams.get("id"));

  const totalNilaiBarang = $derived(
    (qtyDiterima ?? 0) * (hargaPasarHariIni ?? 0),
  );

  const uangFisikCash = $derived(
    Math.max(0, totalNilaiBarang - (nominalPotongPanjar ?? 0)),
  );

  const displaySisaSaldo = $derived(
    selectedDebt
      ? Math.max(0, selectedDebt.saldoDPSisa - (nominalPotongPanjar ?? 0))
      : 0,
  );

  async function loadData() {
    activeDebts = await dbActions.getOnlyDebts();
    masterItems = await dbActions.getItems();

    if (targetId && activeDebts.length > 0) {
      const found = activeDebts.find((d) => d.id === targetId);
      if (found) selectDebt(found);
    }
  }

  async function selectDebt(debt) {
    selectedDebt = debt;
    hargaPasarHariIni = debt.harga || undefined;
    editItem = "";
    editUnit = "";

    nominalPotongPanjar =
      Math.min(
        debt.saldoDPSisa,
        (qtyDiterima ?? 0) * (hargaPasarHariIni ?? 0),
      ) || debt.saldoDPSisa;

    history = await dbActions.getDebtHistory(debt.id);
  }

  $effect(() => {
    if (selectedDebt && editItem.trim() !== "") {
      const foundItem = masterItems.find(
        (i) => i.name.toLowerCase() === editItem.trim().toLowerCase(),
      );

      if (foundItem && foundItem.defaultUnitName) {
        editUnit = foundItem.defaultUnitName;
      }
    }
  });

  $effect(() => {
    if (selectedDebt && qtyDiterima && hargaPasarHariIni) {
      const computedTotal = qtyDiterima * hargaPasarHariIni;
      nominalPotongPanjar = Math.min(selectedDebt.saldoDPSisa, computedTotal);
    }
  });

  async function handleSettle() {
    if (selectedDebt.status !== "hutang") {
      return alert("Transaksi panjar ini sudah selesai/lunas!");
    }

    if (!qtyDiterima || !hargaPasarHariIni || !editItem) {
      return alert("Nama barang, jumlah, dan harga wajib diisi!");
    }

    if (Number(nominalPotongPanjar) > Number(selectedDebt.saldoDPSisa)) {
      return alert(
        `Gagal! Anda memasukkan Rp ${rupiah(nominalPotongPanjar)}. Nilai potong tidak boleh melebihi sisa saldo panjar petani (Maksimal: Rp ${rupiah(selectedDebt.saldoDPSisa)})`,
      );
    }

    try {
      await dbActions.settleDebt(
        { ...selectedDebt, item: editItem, unit: editUnit },
        qtyDiterima,
        hargaPasarHariIni,
        nominalPotongPanjar,
      );
      alert("Penerimaan barang berhasil dicatat dan saldo DP didebet.");
      goto("/beli");
    } catch (err) {
      alert("Gagal memproses transaksi.");
    }
  }

  const rupiah = (n) => new Intl.NumberFormat("id-ID").format(n || 0);

  function formatTanggalMurni(txtDate) {
    if (!txtDate) return "-";
    const d = new Date(txtDate);
    if (isNaN(d.getTime())) return txtDate;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  onMount(loadData);
</script>

<div class="page-container">
  {#if !selectedDebt}
    <header class="main-header">
      <h2>Terima Barang</h2>
      <p class="subtitle">
        Potong/debet saldo DP untuk penyerahan hasil bumi masuk
      </p>
    </header>

    <div class="debt-list">
      {#each activeDebts.filter((d) => d.status === "hutang") as d}
        <button class="debt-card-premium" onclick={() => selectDebt(d)}>
          <div class="card-main-info">
            <span class="seller-title">{d.sellerName || "Anonim"}</span>
            <div class="card-meta-row">
              <span class="meta-label-item"><Package size={11} /> {d.item}</span
              >
              <span class="bullet">•</span>
              <span class="meta-label-date"
                ><Calendar size={11} /> {formatTanggalMurni(d.tanggal)}</span
              >
            </div>
          </div>
          <div class="card-stats-grid">
            <div class="stat-box">
              <span class="stat-lbl">Sisa Janji</span>
              <span class="stat-val"
                >{d.jumlahSisa} {d.unit !== "-" ? d.unit : ""}</span
              >
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Saldo Panjar</span>
              <span class="stat-val price-green"
                >Rp {rupiah(d.saldoDPSisa)}</span
              >
            </div>
          </div>
          <ChevronRight size={16} class="arrow-right-icon" />
        </button>
      {:else}
        <div class="empty-state-box">
          <Coins size={36} />
          <p>Tidak ada tagihan/kontrak panjar aktif saat ini.</p>
        </div>
      {/each}
    </div>
  {:else}
    <div class="form-layout-page">
      <header class="form-header-clean">
        <button
          class="btn-back-premium"
          onclick={() => {
            selectedDebt = null;
            goto("/terima");
          }}
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3>Form Terima Barang</h3>
          <p class="subtitle">Pencatatan timbangan & hitungan cicilan panjar</p>
        </div>
      </header>

      <div class="farmer-info-card">
        <h4>{selectedDebt.sellerName}</h4>
        <div class="info-details-flex">
          <span class="detail-pill"
            ><Scale size={13} /> Kontrak:
            <b
              >{selectedDebt.item} ({selectedDebt.jumlahSisa}
              {selectedDebt.unit})</b
            ></span
          >
          <span class="detail-pill accent"
            ><Banknote size={13} /> Saldo DP Tersedia:
            <b>Rp {rupiah(selectedDebt.saldoDPSisa)}</b></span
          >
        </div>
      </div>

      {#if selectedDebt.status === "hutang"}
        <div class="input-form-body">
          <div class="input-field-group">
            <label for="item-name-input">Nama Komoditas Masuk</label>
            <input
              id="item-name-input"
              type="text"
              bind:value={editItem}
              placeholder="Contoh: Kelapa Subur, Mente"
              class="indigo-focus-input"
            />
          </div>

          <div class="qty-unit-grid">
            <div class="input-field-group">
              <label for="qty-input">Volume Jumlah Masuk</label>
              <input
                id="qty-input"
                type="number"
                bind:value={qtyDiterima}
                placeholder="0"
              />
            </div>
            <div class="input-field-group unit-box-wrapper">
              <label for="unit-input">Satuan</label>
              <input
                id="unit-input"
                type="text"
                bind:value={editUnit}
                placeholder="satuan"
              />
            </div>
          </div>

          <div class="input-field-group">
            <label for="price-input"
              >Harga Pasar Per {editUnit || "Satuan"} Hari Ini</label
            >
            <div class="currency-wrapper">
              <span class="prefix">Rp</span>
              <input
                id="price-input"
                type="number"
                bind:value={hargaPasarHariIni}
                placeholder="0"
              />
            </div>
          </div>

          <div class="input-field-group manual-potong-wrapper">
            <label for="potong-input"
              >Nominal Potong Saldo Panjar Hari Ini</label
            >
            <div class="currency-wrapper">
              <span class="prefix text-amber">Rp</span>
              <input
                id="potong-input"
                type="number"
                bind:value={nominalPotongPanjar}
                placeholder="Masukkan nominal cicilan..."
              />
            </div>
            <small class="hint-text-spec"
              >*Kurangi angka ini jika petani ingin mencicil sebagian potong
              utang</small
            >
          </div>

          <div class="calculation-premium-box">
            <div class="calc-header-title">
              <Calculator size={14} /> Ringkasan Pembayaran Kas
            </div>

            <div class="calc-item-row">
              <span>Total Bruto Nilai Barang:</span>
              <span class="val-white">Rp {rupiah(totalNilaiBarang)}</span>
            </div>

            <div class="calc-item-row underline-dashed">
              <span>Dipotong dari Saldo Panjar:</span>
              <span class="val-amber">- Rp {rupiah(nominalPotongPanjar)}</span>
            </div>

            <div class="calc-item-row cash-alert-banner">
              <span>Sisa Uang Fisik Dibayar Tunai (Cash):</span>
              <span class="val-emerald">Rp {rupiah(uangFisikCash)}</span>
            </div>

            <div class="calc-item-row final-result-row">
              <span>Sisa Saldo Panjar Petani Kedepan:</span>
              <span>Rp {rupiah(displaySisaSaldo)}</span>
            </div>
          </div>

          <button class="btn-confirm-premium" onclick={handleSettle}>
            <CheckCircle2 size={18} /> Validasi & Konfirmasi Potong DP
          </button>
        </div>
      {:else}
        <div class="status-disabled-banner">
          <p>
            ⚠️ Kontrak transaksi panjar ini telah ditutup dengan status <b
              >{selectedDebt.status}</b
            >.
          </p>
          <p>Sistem mengunci penambahan manifest baru untuk data ini.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* --- UI REDESIGN PREMIUM COCONUT APP --- */
  .page-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 16px 16px 100px 16px;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  .main-header {
    margin-bottom: 20px;
  }

  .main-header h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.5px;
  }

  .subtitle {
    margin: 3px 0 0 0;
    font-size: 12px;
    color: #64748b;
  }

  /* List & Premium Cards */
  .debt-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .debt-card-premium {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 14px 40px 14px 14px;
    text-align: left;
    cursor: pointer;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.01);
    width: 100%;
    transition: all 0.15s ease;
  }

  .debt-card-premium:active {
    background-color: #f8fafc;
    transform: scale(0.99);
  }

  .seller-title {
    display: block;
    font-weight: 700;
    font-size: 15px;
    color: #0f172a;
  }

  .card-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .meta-label-item,
  .meta-label-date {
    font-size: 11.5px;
    color: #64748b;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .meta-label-item {
    color: #4f46e5;
    font-weight: 500;
  }

  .bullet {
    font-size: 10px;
    color: #cbd5e1;
  }

  .card-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #f8fafc;
    border-radius: 8px;
    padding: 6px 10px;
    border: 1px solid #f1f5f9;
  }

  .stat-box {
    display: flex;
    flex-direction: column;
  }

  .stat-box .stat-lbl {
    font-size: 10px;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 700;
  }

  .stat-box .stat-val {
    font-weight: 700;
    font-size: 13.5px;
    color: #334155;
  }

  .price-green {
    color: #10b981 !important;
  }

  .arrow-right-icon {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #cbd5e1;
  }

  /* Form Redesign Mode */
  .form-header-clean {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 14px;
  }

  .btn-back-premium {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px;
    color: #334155;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .form-header-clean h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
  }

  /* Farmer Header Info Card */
  .farmer-info-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 14px;
    border-radius: 14px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.01);
  }

  .farmer-info-card h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: #0f172a;
    font-weight: 700;
  }

  .info-details-flex {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail-pill {
    font-size: 12px;
    color: #475569;
    background: #f1f5f9;
    padding: 4px 10px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .detail-pill.accent {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  /* Inputs Group Styling */
  .input-form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .input-field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-field-group label {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  input {
    width: 100%;
    padding: 12px;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-size: 14.5px;
    color: #1e293b;
    background: #ffffff;
    outline: none;
    transition: border-color 0.15s ease;
  }

  input:focus {
    border-color: #10b981;
  }

  .indigo-focus-input {
    border-color: #c4b5fd !important;
    background-color: #f5f3ff;
    font-weight: 600;
  }
  .indigo-focus-input:focus {
    border-color: #7c3aed !important;
  }

  .qty-unit-grid {
    display: grid;
    grid-template-columns: 1fr 110px;
    gap: 10px;
  }

  .unit-box-wrapper input {
    text-align: center;
    background-color: #f1f5f9;
    font-weight: 600;
  }

  /* Currency Wrapper Prefix Custom */
  .currency-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .currency-wrapper .prefix {
    position: absolute;
    left: 12px;
    font-weight: 700;
    font-size: 14.5px;
    color: #64748b;
  }

  .currency-wrapper input {
    padding-left: 38px;
  }

  /* Box Manual Cicilan Berwarna Kuning Amber */
  .manual-potong-wrapper {
    background: #fffbeb;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #fde68a;
  }

  .manual-potong-wrapper label {
    color: #b45309;
  }

  .manual-potong-wrapper .currency-wrapper input {
    border-color: #fcd34d;
    font-weight: 700;
    color: #b45309;
  }
  .manual-potong-wrapper .currency-wrapper input:focus {
    border-color: #d97706;
  }

  .text-amber {
    color: #d97706;
  }

  .hint-text-spec {
    font-size: 11px;
    color: #71717a;
    margin-top: 4px;
    font-style: italic;
    display: block;
  }

  /* Calculation Premium Card */
  .calculation-premium-box {
    background: #1e293b;
    color: #f8fafc;
    padding: 16px;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(15, 23, 42, 0.08);
  }

  .calc-header-title {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 1px solid #334155;
    padding-bottom: 6px;
    margin-bottom: 2px;
  }

  .calc-item-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #94a3b8;
  }

  .underline-dashed {
    border-bottom: 1px dashed #334155;
    padding-bottom: 6px;
  }

  .val-white {
    color: #ffffff;
  }
  .val-amber {
    color: #fbbf24;
    font-weight: 700;
  }

  .cash-alert-banner {
    background: rgba(16, 185, 129, 0.1);
    padding: 6px 10px;
    border-radius: 8px;
    margin: 2px 0;
    border-left: 3px solid #10b981;
    color: #a7f3d0;
  }

  .val-emerald {
    color: #10b981;
    font-weight: 800;
    font-size: 14px;
  }

  .result {
    border-top: 1px solid #334155;
    padding-top: 8px;
    color: #ffffff;
    font-weight: bold;
    font-size: 14px;
  }

  .final-result-row {
    border-top: 1px solid #334155;
    padding-top: 8px;
    font-weight: 700;
    color: #ffffff;
    font-size: 13.5px;
  }

  /* Confirm Button */
  .btn-confirm-premium {
    background: #10b981;
    color: #ffffff;
    border: none;
    padding: 15px;
    border-radius: 12px;
    font-weight: 700;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 15px;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
    margin-top: 4px;
  }

  .btn-confirm-premium:active {
    transform: scale(0.98);
  }

  /* Fallback Box Empty / Disabled */
  .empty-state-box {
    text-align: center;
    padding: 50px 20px;
    border: 2px dashed #cbd5e1;
    border-radius: 16px;
    color: #94a3b8;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .status-disabled-banner {
    text-align: center;
    padding: 20px;
    background: #fee2e2;
    border-radius: 14px;
    color: #991b1b;
    font-size: 14px;
    border: 1px solid #fca5a5;
  }
</style>
