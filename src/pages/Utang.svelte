<!-- Utang.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { dbActions } from "$lib/api";
  import { fade, slide } from "svelte/transition";
  import {
    X,
    User,
    Plus,
    ArrowLeft,
    Save,
    Calendar,
    Package,
    Coins,
    CheckCircle2,
    Scale,
    AlertCircle,
    ChevronRight,
  } from "lucide-svelte";

  // --- States (Svelte 5 Runes) ---
  let debts = $state([]);
  let sellers = $state([]);
  let items = $state([]);
  let units = $state([]);
  let loading = $state(true);
  let mode = $state("list"); // "list" atau "add"

  // State untuk Modal Pelunasan
  let selectedDebt = $state(null);
  let showPayModal = $state(false);
  let catatanPelunasan = $state("");

  // States untuk Form Pendaftaran Utang Baru
  let newDebt = $state({
    sellerName: "",
    item: "",
    unit: "",
    jumlah: undefined,
    totalUtang: undefined,
    catatan: "",
  });

  let sellerSearchText = $state("");
  let itemSearchText = $state("");
  let unitSearchText = $state("");
  let showSellerHits = $state(false);
  let showItemHits = $state(false);
  let showUnitHits = $state(false);

  // --- Derived States ---
  // Menghilangkan duplikat nama barang untuk sugesti input
  let uniqueItems = $derived(
    items.reduce((acc, current) => {
      const x = acc.find(
        (i) =>
          i.name.trim().toLowerCase() === current.name.trim().toLowerCase(),
      );
      if (!x) return acc.concat([current]);
      return acc;
    }, []),
  );

  let sellerHits = $derived(
    sellerSearchText.trim() === ""
      ? []
      : sellers.filter((s) =>
          s.name.toLowerCase().includes(sellerSearchText.toLowerCase()),
        ),
  );
  let itemHits = $derived(
    itemSearchText.trim() === ""
      ? []
      : uniqueItems.filter((i) =>
          i.name.toLowerCase().includes(itemSearchText.toLowerCase()),
        ),
  );
  let unitHits = $derived(
    unitSearchText.trim() === ""
      ? []
      : units.filter((u) =>
          u.name.toLowerCase().includes(unitSearchText.toLowerCase()),
        ),
  );

  const totalUtangKita = $derived(
    Array.isArray(debts)
      ? debts.reduce((sum, d) => sum + (Number(d?.total) || 0), 0)
      : 0,
  );

  // --- Functions ---
  async function loadData() {
    loading = true;
    try {
      // PERBAIKAN 2: Jalankan pemanggilan data secara terpisah (bukan Promise.all)
      // agar jika salah satu master data kosong, list utang tidak ikut macet lock.
      const debtData = await dbActions.getOurDebts();
      debts = Array.isArray(debtData) ? debtData : [];

      sellers = (await dbActions.getSellers()) || [];
      items = (await dbActions.getItems()) || [];
      units = (await dbActions.getUnits()) || [];

      if (units.length > 0 && !newDebt.unit) {
        newDebt.unit = units[0].name;
        unitSearchText = units[0].name;
      }
    } catch (e) {
      console.error("Gagal muat data di halaman utang:", e);
    } finally {
      // Diisolasi penuh agar pasti mengeksekusi pemberhentian loading text
      setTimeout(() => {
        loading = false;
      }, 50);
    }
  }

  async function handleSaveDebt() {
    if (!newDebt.sellerName || !newDebt.item || !newDebt.totalUtang) {
      return alert("Nama Petani, Komoditas, dan Nominal Utang wajib diisi!");
    }

    try {
      loading = true; // Spinner mulai berputar
      const finalSellerId = await dbActions.getOrCreateSeller(
        newDebt.sellerName.trim(),
      );

      await dbActions.addOurDebt({
        sellerId: finalSellerId,
        item: newDebt.item.trim().toLowerCase(),
        unit: newDebt.unit ? newDebt.unit.trim().toLowerCase() : "kg",
        jumlah: Number(newDebt.jumlah) || 0,
        total: Number(newDebt.totalUtang),
        catatan: newDebt.catatan
          ? newDebt.catatan.trim()
          : "Utang nota beli barang",
      });

      alert("Catatan utang ke petani berhasil disimpan!");
      resetForm();
      mode = "list";
      await loadData(); // Mengambil data ulang setelah sukses input
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan utang.");
    } finally {
      loading = false; // PERNYATAAN WAJIB: Spinner dipaksa mati baik sukses maupun gagal
    }
  }

  async function handleSettleDebt() {
    if (
      !confirm(
        `Tandai utang ke ${selectedDebt.sellerName} sebesar Rp ${rupiah(selectedDebt.total)} sebagai LUNAS?`,
      )
    )
      return;

    try {
      const infoLunas =
        catatanPelunasan.trim() !== ""
          ? `LUNAS: ${catatanPelunasan.trim()}`
          : `LUNAS dibayar tunai pada ${new Date().toLocaleDateString("id-ID")}`;

      await dbActions.payOurDebt(selectedDebt.id, infoLunas);
      alert("Utang berhasil dilunasi!");
      showPayModal = false;
      await loadData();
    } catch (e) {
      alert("Gagal memperbarui status pelunasan.");
    }
  }

  function resetForm() {
    newDebt = {
      sellerName: "",
      item: "",
      unit: units[0]?.name || "kg",
      jumlah: undefined,
      totalUtang: undefined,
      catatan: "",
    };
    sellerSearchText = "";
    itemSearchText = "";
    unitSearchText = units[0]?.name || "kg";
  }

  function openPayModal(d) {
    selectedDebt = d;
    catatanPelunasan = "";
    showPayModal = true;
  }

  function rupiah(n) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }
  function formatTanggal(txtDate) {
    if (!txtDate) return "-";
    const d = new Date(txtDate);
    return isNaN(d.getTime())
      ? txtDate
      : d.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  }

  onMount(loadData);
</script>

<div class="page-container">
  {#if mode === "list"}
    <header class="main-header" in:fade>
      <div>
        <h2>Utang ke Petani</h2>
        <p class="subtitle">
          Daftar sisa pembayaran barang petani yang belum kita lunasi
        </p>
      </div>
    </header>

    <div class="summary-card" in:fade>
      <div class="summary-info">
        <span class="label">Total Utang Kita di Lapangan</span>
        <h2 class="value">Rp {rupiah(totalUtangKita)}</h2>
      </div>
      <button
        class="btn-add-main"
        onclick={() => {
          mode = "add";
          resetForm();
        }}
      >
        <Plus size={18} /> Catat Utang Baru
      </button>
    </div>

    <div class="list-section">
      <div class="section-title">
        <h3>Daftar Tanggungan Belum Dibayar</h3>
        <span class="count-badge">{debts.length} Orang</span>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Memuat berkas utang...</p>
        </div>
      {:else}
        <div class="grid-list">
          {#if debts.length > 0}
            {#each debts as d (d.id)}
              <div
                class="item-card active-debt"
                onclick={() => openPayModal(d)}
                style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"
              >
                <div class="item-info">
                  <div
                    class="name-row"
                    style="display: flex; align-items: center; gap: 8px;"
                  >
                    <span
                      class="name"
                      style="font-weight: 700; color: #0f172a; font-size: 15px;"
                    >
                      {d.sellerName || "Anonim"}
                    </span>
                    <span class="badge-warning">Belum Bayar</span>
                  </div>

                  <div
                    class="meta-row"
                    style="display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 11px; color: #64748b;"
                  >
                    <span class="sub-time">⏰ {formatTanggal(d.tanggal)}</span>
                    <span class="bullet">•</span>
                    <span
                      class="sub-item-spec"
                      style="color: #b91c1c; font-weight: 500; text-transform: capitalize;"
                    >
                      📦 {d.item || "Barang"}
                    </span>
                  </div>

                  <div class="progress-container" style="margin-top: 5px;">
                    <span
                      class="sub-progress"
                      style="font-size: 11.5px; color: #475569; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; display: inline-block;"
                    >
                      Volume Barang: <strong>{d.jumlah || 0}</strong>
                      {d.unit || "kg"}
                    </span>
                  </div>

                  {#if d.catatan}
                    <p
                      class="note-text"
                      style="margin: 6px 0 0 0; font-size: 11.5px; color: #475569; font-style: italic;"
                    >
                      📋 {d.catatan}
                    </p>
                  {/if}
                </div>

                <div
                  class="item-price-side"
                  style="display: flex; align-items: center; gap: 6px;"
                >
                  <span
                    class="price-val text-red"
                    style="font-weight: 800; color: #dc2626; font-size: 14.5px;"
                  >
                    Rp {rupiah(d.total)}
                  </span>
                  <ChevronRight
                    size={16}
                    class="arrow-icon"
                    style="color: #cbd5e1;"
                  />
                </div>
              </div>
            {/each}
          {:else}
            <div class="empty-card">
              <Coins size={36} />
              <p>Hebat! Tidak ada tanggungan utang ke petani saat ini.</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="form-page" in:slide={{ axis: "x" }}>
      <header class="form-header">
        <button
          class="btn-icon-back"
          onclick={() => {
            mode = "list";
          }}
          aria-label="Kembali"><ArrowLeft size={20} /></button
        >
        <div>
          <h3>Catat Utang Baru</h3>
          <p class="subtitle">Input sisa bon/pembayaran barang milik petani</p>
        </div>
      </header>

      <div class="form-body">
        <div class="input-group search-container">
          <label for="seller-search">Nama Petani / Penerima Uang *</label>
          <div class="input-with-icon">
            <User size={16} class="icon-left" />
            <input
              id="seller-search"
              type="text"
              placeholder="Cari atau ketik nama petani..."
              bind:value={sellerSearchText}
              oninput={(e) => (newDebt.sellerName = e.target.value)}
              onfocus={() => (showSellerHits = true)}
              onblur={() => setTimeout(() => (showSellerHits = false), 200)}
            />
          </div>
          {#if showSellerHits && sellerHits.length > 0}
            <div class="search-results">
              {#each sellerHits as s}
                <button
                  class="hit-item"
                  onclick={() => {
                    newDebt.sellerName = s.name;
                    sellerSearchText = s.name;
                    showSellerHits = false;
                  }}><span>{s.name}</span><small>Terdaftar</small></button
                >
              {/each}
            </div>
          {/if}
        </div>

        <div class="grid-2">
          <div class="input-group search-container">
            <label for="item-search">Komoditas Barang *</label>
            <input
              id="item-search"
              type="text"
              placeholder="Kelapa, kopra..."
              bind:value={itemSearchText}
              oninput={(e) => (newDebt.item = e.target.value)}
              onfocus={() => (showItemHits = true)}
              onblur={() => setTimeout(() => (showItemHits = false), 200)}
            />
            {#if showItemHits && itemHits.length > 0}
              <div class="search-results mini">
                {#each itemHits as i}
                  <button
                    class="hit-item-mini"
                    onclick={() => {
                      newDebt.item = i.name;
                      itemSearchText = i.name;
                      showItemHits = false;
                    }}>{i.name}</button
                  >
                {/each}
              </div>
            {/if}
          </div>

          <div class="input-group search-container">
            <label for="unit-search">Satuan</label>
            <input
              id="unit-search"
              type="text"
              placeholder="kg, subur..."
              bind:value={unitSearchText}
              oninput={(e) => (newDebt.unit = e.target.value)}
              onfocus={() => (showUnitHits = true)}
              onblur={() => setTimeout(() => (showUnitHits = false), 200)}
            />
            {#if showUnitHits && unitHits.length > 0}
              <div class="search-results mini">
                {#each unitHits as u}
                  <button
                    class="hit-item-mini"
                    onclick={() => {
                      newDebt.unit = u.name;
                      unitSearchText = u.name;
                      showUnitHits = false;
                    }}>{u.name}</button
                  >
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="input-group">
          <label for="qty-input">Volume / Jumlah Barang yang Diterima</label>
          <input
            id="qty-input"
            type="number"
            step="any"
            placeholder="0 (Boleh dikosongkan)"
            bind:value={newDebt.jumlah}
          />
        </div>

        <div class="input-group highlight-input-group">
          <label for="total-input"
            >Nominal Utang Kita (Sisa Uang Pembayaran) *</label
          >
          <div class="currency-input-wrapper">
            <span class="currency-prefix">Rp</span>
            <input
              id="total-input"
              type="number"
              placeholder="0"
              bind:value={newDebt.totalUtang}
            />
          </div>
        </div>

        <div class="input-group">
          <label for="note-input">Keterangan Tambahan / Alasan Utang</label>
          <input
            id="note-input"
            type="text"
            placeholder="Contoh: Kurang bayar nota timbangan kopra 2 ton"
            bind:value={newDebt.catatan}
          />
        </div>

        <button class="btn-save" onclick={handleSaveDebt} disabled={loading}>
          <Save size={18} />
          {loading ? "Menyimpan Berkas..." : "Validasi & Catat Utang Kita"}
        </button>
      </div>
    </div>
  {/if}
</div>

{#if showPayModal && selectedDebt}
  <div
    class="modal-overlay"
    onclick={() => (showPayModal = false)}
    transition:fade
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      in:slide={{ y: 100 }}
    >
      <div class="modal-header">
        <div>
          <h4>Pelunasan Utang ke Petani</h4>
          <p class="subtitle">
            Catat pembayaran kas keluar untuk melunasi bon petani
          </p>
        </div>
        <button class="btn-close" onclick={() => (showPayModal = false)}
          ><X size={20} /></button
        >
      </div>

      <div class="modal-body form-body">
        <div class="brief-info-box">
          <span class="info-lbl">Nama Petani</span>
          <span class="info-val">{selectedDebt.sellerName}</span>
        </div>

        <div class="grid-2" style="gap: 10px;">
          <div class="brief-info-box">
            <span class="info-lbl">Komoditas</span><span
              class="info-val"
              style="text-transform: capitalize;">{selectedDebt.item}</span
            >
          </div>
          <div class="brief-info-box alert-red">
            <span class="info-lbl">Wajib Dibayar</span><span
              class="info-val text-red"
              style="font-size: 16px;">Rp {rupiah(selectedDebt.total)}</span
            >
          </div>
        </div>

        <div class="input-group">
          <label for="pay-note">Catatan Pelunasan (Opsional)</label>
          <input
            id="pay-note"
            type="text"
            placeholder="Contoh: Diambil cash oleh istrinya / Transfer BRI"
            bind:value={catatanPelunasan}
          />
        </div>

        <button class="btn-settle-confirm" onclick={handleSettleDebt}>
          <CheckCircle2 size={18} /> Tandai Sudah Lunas (Kas Keluar)
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* --- STYLESHEET RESMI PREMIUM UTANG APP --- */
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
    margin-bottom: 16px;
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

  .summary-card {
    background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
    color: #ffffff;
    padding: 22px;
    border-radius: 18px;
    margin-bottom: 24px;
    box-shadow: 0 10px 25px rgba(153, 27, 27, 0.15);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .summary-info .label {
    font-size: 11px;
    opacity: 0.75;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .summary-info .value {
    font-size: 28px;
    margin: 4px 0 0 0;
    font-weight: 800;
    color: #fca5a5;
  }

  .btn-add-main {
    width: 100%;
    background: #ef4444;
    border: none;
    color: #ffffff;
    padding: 12px;
    border-radius: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13.5px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
  }
  .btn-add-main:active {
    transform: scale(0.98);
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .section-title h3 {
    font-size: 13px;
    color: #475569;
    text-transform: uppercase;
    font-weight: 700;
    margin: 0;
  }
  .count-badge {
    font-size: 11px;
    background: #fee2e2;
    color: #991b1b;
    padding: 2px 8px;
    border-radius: 20px;
    font-weight: 600;
  }

  .grid-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item-card {
    background: #ffffff;
    padding: 14px 16px;
    border-radius: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #e2e8f0;
    cursor: pointer;
  }
  .item-card.active-debt {
    border-left: 4px solid #ef4444;
  }
  .item-card:active {
    background-color: #f8fafc;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .item-info .name {
    font-weight: 700;
    color: #0f172a;
    font-size: 15px;
  }
  .badge-warning {
    background: #fee2e2;
    color: #991b1b;
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
  }
  .sub-time,
  .sub-item-spec {
    font-size: 11px;
    color: #64748b;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .sub-item-spec {
    color: #b91c1c;
    font-weight: 500;
    text-transform: capitalize;
  }
  .bullet {
    font-size: 10px;
    color: #cbd5e1;
  }

  .progress-container {
    margin-top: 5px;
  }
  .sub-progress {
    font-size: 11.5px;
    color: #475569;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 6px;
    display: inline-block;
  }
  .note-text {
    margin: 6px 0 0 0;
    font-size: 11.5px;
    color: #475569;
    font-style: italic;
  }

  .item-price-side {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .price-val {
    font-weight: 800;
    font-size: 14.5px;
    text-align: right;
  }
  .text-red {
    color: #dc2626 !important;
  }
  .arrow-icon {
    color: #cbd5e1;
  }

  /* Form & Form Elements */
  .form-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 14px;
  }
  .btn-icon-back {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px;
    color: #334155;
    cursor: pointer;
    display: flex;
  }
  .form-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
  }
  .form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  input {
    width: 100%;
    padding: 12px;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-size: 14.5px;
    color: #1e293b;
    outline: none;
  }
  input:focus {
    border-color: #ef4444;
  }
  label {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 4px;
    display: block;
    color: #475569;
    text-transform: uppercase;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }

  .highlight-input-group {
    background: #fef2f2;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #fee2e2;
  }
  .highlight-input-group label {
    color: #991b1b;
  }
  .currency-input-wrapper {
    display: flex;
    align-items: center;
    position: relative;
  }
  .currency-prefix {
    position: absolute;
    left: 12px;
    font-weight: 700;
    color: #b91c1c;
  }
  .currency-input-wrapper input {
    padding-left: 38px;
    border-color: #fca5a5;
    font-weight: 700;
    color: #991b1b;
  }
  .currency-input-wrapper input:focus {
    border-color: #ef4444;
  }

  .btn-save {
    width: 100%;
    background: #dc2626;
    color: #ffffff;
    border: none;
    padding: 14px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 14.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
  }

  /* Modal Sheet Pelunasan */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    display: flex;
    align-items: flex-end;
    z-index: 100;
    backdrop-filter: blur(2px);
  }
  .modal-content {
    background: #ffffff;
    width: 100%;
    padding: 20px;
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .modal-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
  }
  .btn-close {
    background: #f1f5f9;
    border: none;
    border-radius: 50%;
    padding: 6px;
    color: #64748b;
    cursor: pointer;
    display: flex;
  }

  .brief-info-box {
    background: #f8fafc;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .brief-info-box.alert-red {
    background: #fff5f5;
    border-color: #feb2b2;
  }
  .info-lbl {
    font-size: 10px;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
    display: block;
  }
  .info-val {
    font-weight: 800;
    color: #0f172a;
    font-size: 14px;
    display: block;
    margin-top: 2px;
  }

  .btn-settle-confirm {
    width: 100%;
    background: #10b981;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 14.5px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.2);
  }

  /* Autocomplete & Dropdowns */
  .search-container {
    position: relative;
  }
  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    z-index: 50;
    max-height: 150px;
    overflow-y: auto;
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.05);
  }
  .hit-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 11px 14px;
    border: none;
    background: white;
    text-align: left;
    cursor: pointer;
    font-size: 13.5px;
  }
  .hit-item small {
    color: #b91c1c;
    font-size: 10px;
    background: #fee2e2;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  .search-results.mini {
    max-height: 110px;
  }
  .hit-item-mini {
    width: 100%;
    padding: 10px;
    text-align: left;
    background: white;
    border: none;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
    color: #334155;
    cursor: pointer;
    text-transform: capitalize;
  }
  .hit-item-mini:hover,
  .hit-item:hover {
    background: #fef2f2;
    color: #dc2626;
  }

  .loading-state {
    text-align: center;
    padding: 40px;
    color: #64748b;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .spinner {
    width: 22px;
    height: 22px;
    border: 3px solid #e2e8f0;
    border-top-color: #ef4444;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .empty-card {
    text-align: center;
    padding: 40px 20px;
    border: 2px dashed #cbd5e1;
    border-radius: 16px;
    color: #94a3b8;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
