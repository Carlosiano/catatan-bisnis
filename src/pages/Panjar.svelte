<!-- Panjar.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { dbActions } from "$lib/api";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import {
    X,
    User,
    Plus,
    ArrowLeft,
    Save,
    History,
    ChevronRight,
    Scale,
    Calendar,
    Package,
    Coins,
    Edit3,
    Undo2,
  } from "lucide-svelte";

  // --- States ---
  let debts = $state([]);
  let loading = $state(true);
  let mode = $state("list");

  let filterStatus = $state("hutang");

  // State untuk Detail (Modal)
  let selectedDebt = $state(null);
  let showModal = $state(false);
  let history = $state([]);

  // Sub-State Mode Operasi di dalam Modal
  let modalView = $state("detail"); // Options: "detail", "edit", "retur"

  // Tampungan form edit & retur
  let editForm = $state({ item: "", unit: "", jumlahJanji: 0, jumlahSisa: 0 });
  let returForm = $state({ nominal: undefined });

  let items = $state([]);
  let sellers = $state([]);
  let units = $state([]);
  let withItem = $state(false);

  let itemSearch = $state("");
  let showItemHits = $state(false);
  let unitSearch = $state("");
  let showUnitHits = $state(false);
  let sellerSearch = $state("");
  let showSellerHits = $state(false);

  let newDebt = $state({
    sellerName: "",
    item: "",
    unit: "",
    jumlahJanji: 0,
    uangDibayar: undefined,
    tanggal: new Date().toISOString().split("T")[0],
  });

  // --- Derived States ---
  let sellerHits = $derived(
    sellerSearch.trim() === ""
      ? []
      : sellers.filter((s) =>
          s.name.toLowerCase().includes(sellerSearch.toLowerCase()),
        ),
  );
  let itemHits = $derived(
    itemSearch.trim() === ""
      ? []
      : items.filter((i) =>
          i.name.toLowerCase().includes(itemSearch.toLowerCase()),
        ),
  );
  let unitHits = $derived(
    unitSearch.trim() === ""
      ? []
      : units.filter((u) =>
          u.name.toLowerCase().includes(unitSearch.toLowerCase()),
        ),
  );

  let filteredDebts = $derived(
    debts.filter((d) => {
      if (filterStatus === "hutang") return d.status === "hutang";
      if (filterStatus === "lunas-dp")
        return d.status === "lunas-dp" || d.status === "returned";
      return true;
    }),
  );

  const totalDP = $derived(
    debts.reduce((sum, d) => sum + (d.saldoDPSisa ?? 0), 0),
  );

  async function loadData() {
    loading = true;
    try {
      const [debtData, sellerData, unitData, itemData] = await Promise.all([
        dbActions.getOnlyDebts(),
        dbActions.getSellers(),
        dbActions.getUnits(),
        dbActions.getItems(),
      ]);
      debts = debtData;
      sellers = sellerData;
      units = unitData;
      items = itemData;

      if (units.length > 0 && !newDebt.unit) {
        newDebt.unit = units[0].name;
        unitSearch = units[0].name;
      }
    } catch (e) {
      console.error("Gagal muat data:", e);
    } finally {
      loading = false;
    }
  }

  async function openDetail(debt) {
    selectedDebt = debt;
    modalView = "detail";
    showModal = true;
    history = await dbActions.getDebtHistory(debt.id);

    // Siapkan data kloningan untuk form edit
    editForm = {
      item: debt.item,
      unit: debt.unit,
      jumlahJanji: debt.jumlahJanji,
      jumlahSisa: debt.jumlahSisa,
    };
    returForm.nominal = undefined;
  }

  async function handleUpdateDebt() {
    try {
      await dbActions.updateDebt(
        selectedDebt.id,
        editForm.item,
        editForm.unit,
        editForm.jumlahJanji,
        editForm.jumlahSisa,
      );
      alert("Perubahan dokumen panjar berhasil disimpan!");
      showModal = false;
      await loadData();
    } catch (e) {
      alert("Gagal memperbarui data.");
    }
  }

  async function handleReturnCash() {
    if (!returForm.nominal || returForm.nominal <= 0) {
      return alert("Masukkan nominal pengembalian uang yang valid!");
    }
    if (returForm.nominal > selectedDebt.saldoDPSisa) {
      return alert("Nominal retur melebihi sisa saldo panjar petani!");
    }

    const konfirm = confirm(
      `Apakah Anda yakin ingin mencatat pengembalian uang cash sebesar Rp ${rupiah(returForm.nominal)}?`,
    );
    if (!konfirm) return;

    try {
      const isLunasSemua = returForm.nominal === selectedDebt.saldoDPSisa;
      await dbActions.partialReturnDebt(
        selectedDebt,
        returForm.nominal,
        isLunasSemua,
      );
      alert("Pengembalian uang panjar berhasil dibukukan.");
      showModal = false;
      await loadData();
    } catch (e) {
      alert("Gagal memproses pengembalian uang.");
    }
  }

  function resetForm() {
    newDebt = {
      sellerName: "",
      item: "",
      unit: units[0]?.name || "Kg",
      jumlahJanji: 0,
      uangDibayar: undefined,
      tanggal: new Date().toISOString().split("T")[0],
    };
    sellerSearch = "";
    itemSearch = "";
    withItem = false;
  }

  async function handleSaveDebt() {
    if (!newDebt.sellerName || !newDebt.uangDibayar)
      return alert("Nama Penjual dan Nominal DP wajib diisi!");

    try {
      loading = true;
      const finalSellerId = await dbActions.getOrCreateSeller(
        newDebt.sellerName,
      );
      await dbActions.addDebt({
        ...newDebt,
        sellerId: finalSellerId,
        item: withItem ? newDebt.item : "Panjar Tunai",
        jumlahJanji: withItem ? newDebt.jumlahJanji || 0 : 0,
        unit: withItem ? newDebt.unit || "Kg" : "-",
      });
      alert("Panjar Berhasil Disimpan!");
      resetForm();
      mode = "list";
      await loadData();
    } catch (error) {
      alert("Gagal menyimpan data.");
    } finally {
      loading = false;
    }
  }

  function selectSeller(name) {
    newDebt.sellerName = name;
    sellerSearch = name;
    showSellerHits = false;
  }
  function selectItem(name) {
    newDebt.item = name;
    itemSearch = name;
    showItemHits = false;
  }
  function selectUnit(name) {
    newDebt.unit = name;
    unitSearch = name;
    showUnitHits = false;
  }

  $effect(() => {
    newDebt.item = itemSearch;
  });
  $effect(() => {
    newDebt.unit = unitSearch;
  });

  function handleSellerInput(e) {
    const val = e.target.value;
    sellerSearch = val;
    newDebt.sellerName = val;
    showSellerHits = true;
  }

  function rupiah(n) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }
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
  {#if mode === "list"}
    <header class="main-header" in:fade>
      <div>
        <h2>Manajemen Panjar</h2>
        <p class="subtitle">Pantau uang muka & sisa komoditas petani</p>
      </div>
    </header>

    <div class="summary-card" in:fade>
      <div class="summary-info">
        <span class="label">Total Saldo di Lapangan</span>
        <h2 class="value">Rp {rupiah(totalDP)}</h2>
      </div>
      <button class="btn-add-main" onclick={() => (mode = "add")}>
        <Plus size={18} /> Catat Panjar Baru
      </button>
    </div>

    <div class="status-filter-tabs">
      <button
        class:active={filterStatus === "hutang"}
        onclick={() => (filterStatus = "hutang")}>Belum Lunas</button
      >
      <button
        class:active={filterStatus === "lunas-dp"}
        onclick={() => (filterStatus = "lunas-dp")}>Lunas / Selesai</button
      >
      <button
        class:active={filterStatus === "all"}
        onclick={() => (filterStatus = "all")}>Semua ({debts.length})</button
      >
    </div>

    <div class="list-section">
      <div class="section-title">
        <h3>Daftar Evaluasi Dokumen</h3>
        <span class="count-badge">{filteredDebts.length} Baris</span>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Sinkronisasi pembukuan...</p>
        </div>
      {:else}
        <div class="grid-list">
          {#each filteredDebts as d}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="item-card {d.status !== 'hutang' ? 'is-lunas' : ''}"
              onclick={() => openDetail(d)}
              in:slide
            >
              <div class="item-info">
                <div class="name-row">
                  <span class="name">{d.sellerName || "Anonim"}</span>
                  {#if d.status === "lunas-dp"}<span class="badge lunas"
                      >Selesai</span
                    >
                  {:else if d.status === "returned"}<span class="badge returned"
                      >Retur</span
                    >{/if}
                </div>
                <div class="meta-row">
                  <span class="sub-time"
                    ><Calendar size={11} />
                    {formatTanggalMurni(d.tanggal)}</span
                  >
                  <span class="bullet">•</span>
                  <span class="sub-item-spec"
                    ><Package size={11} /> {d.item}</span
                  >
                </div>
                <div class="progress-container">
                  <span class="sub-progress">
                    Total Sisa Janji: <strong>{d.jumlahSisa}</strong> / {d.jumlahJanji >
                    0
                      ? d.jumlahJanji
                      : "-"}
                    {d.unit !== "-" ? d.unit : ""}
                  </span>
                </div>
              </div>
              <div class="item-price-side">
                <span
                  class="price-val {d.saldoDPSisa <= 0 ? 'muted' : 'active'}"
                >
                  {d.saldoDPSisa <= 0 ? "Rp 0" : `Rp ${rupiah(d.saldoDPSisa)}`}
                </span>
                <ChevronRight size={16} class="arrow-icon" />
              </div>
            </div>
          {:else}
            <div class="empty-card" in:fade>
              <Coins size={36} />
              <p>Tidak ada catatan panjar pada kategori ini.</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- View Form Tambah Panjar -->
    <div class="form-page" in:slide={{ axis: "x" }}>
      <header class="form-header">
        <button
          class="btn-icon-back"
          onclick={() => {
            mode = "list";
            resetForm();
          }}
          aria-label="Kembali"><ArrowLeft size={20} /></button
        >
        <div>
          <h3>Registrasi Panjar Baru</h3>
          <p class="subtitle">Buat nota perjanjian uang muka dengan petani</p>
        </div>
      </header>
      <div class="form-body">
        <div class="input-group search-container">
          <label for="seller-search">Nama Petani / Penjual</label>
          <div class="input-with-icon">
            <User size={16} class="icon-left" />
            <input
              id="seller-search"
              type="text"
              placeholder="Cari atau ketik nama petani..."
              value={sellerSearch}
              oninput={handleSellerInput}
              onfocus={() => (showSellerHits = true)}
              onblur={() => setTimeout(() => (showSellerHits = false), 200)}
            />
          </div>
          {#if showSellerHits && sellerHits.length > 0}
            <div class="search-results" transition:fade>
              {#each sellerHits as s}
                <button class="hit-item" onclick={() => selectSeller(s.name)}
                  ><span>{s.name}</span><small>Terdaftar</small></button
                >
              {/each}
            </div>
          {/if}
        </div>
        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-title">Detail Komoditas</span><span
              class="toggle-sub"
              >Gunakan jika panjar mengunci volume barang tertentu</span
            >
          </div>
          <label class="switch-mini"
            ><input type="checkbox" bind:checked={withItem} /><span
              class="slider-mini"
            ></span></label
          >
        </div>
        {#if withItem}
          <div class="optional-fields" transition:slide>
            <div class="grid-2">
              <div class="input-group search-container">
                <label for="item-search">Nama Barang</label>
                <input
                  id="item-search"
                  type="text"
                  placeholder="Kelapa Subur, Mente..."
                  bind:value={itemSearch}
                  onfocus={() => (showItemHits = true)}
                  onblur={() => setTimeout(() => (showItemHits = false), 200)}
                />
                {#if showItemHits && itemHits.length > 0}
                  <div class="search-results mini" transition:fade>
                    {#each itemHits as i}<button
                        class="hit-item-mini"
                        onclick={() => selectItem(i.name)}>{i.name}</button
                      >{/each}
                  </div>
                {/if}
              </div>
              <div class="input-group search-container">
                <label for="unit-search">Satuan</label>
                <input
                  id="unit-search"
                  type="text"
                  placeholder="Subur, Kg..."
                  bind:value={unitSearch}
                  onfocus={() => (showUnitHits = true)}
                  onblur={() => setTimeout(() => (showUnitHits = false), 200)}
                />
                {#if showUnitHits && unitHits.length > 0}
                  <div class="search-results mini" transition:fade>
                    {#each unitHits as u}<button
                        class="hit-item-mini"
                        onclick={() => selectUnit(u.name)}>{u.name}</button
                      >{/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="input-group">
              <label for="jumlah-janji">Janji Volume Jumlah Kuantitas</label
              ><input
                id="jumlah-janji"
                type="number"
                bind:value={newDebt.jumlahJanji}
                placeholder="0"
              />
            </div>
          </div>
        {/if}
        <div class="input-group highlight-input-group">
          <label for="uang-dibayar">Nominal Uang Panjar (Kas Keluar)</label>
          <div class="currency-input-wrapper">
            <span class="currency-prefix">Rp</span><input
              id="uang-dibayar"
              type="number"
              bind:value={newDebt.uangDibayar}
              placeholder="0"
            />
          </div>
        </div>
        <div class="input-group">
          <label for="tanggal-input">Tanggal Perjanjian</label><input
            id="tanggal-input"
            type="date"
            bind:value={newDebt.tanggal}
          />
        </div>
        <button class="btn-save" onclick={handleSaveDebt} disabled={loading}
          ><Save size={18} />
          {loading
            ? "Menyimpan Dokumen..."
            : "Validasi & Simpan Panjar"}</button
        >
      </div>
    </div>
  {/if}
</div>

{#if showModal && selectedDebt}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={() => (showModal = false)}
    transition:fade
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      in:slide={{ y: 100 }}
    >
      <!-- SUB-VIEW 1: RINGKASAN & DETAIL UTAMA -->
      {#if modalView === "detail"}
        <div class="modal-header">
          <div>
            <h4>Kartu Kontrol Lapangan ({selectedDebt.sellerName})</h4>
            <p class="subtitle">Gabungan saldo aktif berjalan</p>
          </div>
          <button
            class="btn-close"
            onclick={() => (showModal = false)}
            aria-label="Tutup"><X size={20} /></button
          >
        </div>

        <div class="modal-body">
          <div class="brief-info-grid">
            <div class="info-box">
              <span class="info-label">Total Cair</span><span class="info-val"
                >Rp {rupiah(selectedDebt.uangDibayar)}</span
              >
            </div>
            <div class="info-box accent">
              <span class="info-label">Sisa Saldo</span><span class="info-val"
                >Rp {rupiah(selectedDebt.saldoDPSisa)}</span
              >
            </div>
            <div class="info-box">
              <span class="info-label">Sisa Janji</span><span class="info-val"
                >{selectedDebt.jumlahSisa}
                {selectedDebt.unit !== "-" ? selectedDebt.unit : "Kg"}</span
              >
            </div>
            <div class="info-box">
              <span class="info-label">Update Akhir</span><span
                class="info-val datespec"
                >{formatTanggalMurni(selectedDebt.tanggal)}</span
              >
            </div>
          </div>

          <!-- Tombol Aksi Tambahan (Edit & Retur) -->
          {#if selectedDebt.status === "hutang"}
            <div class="action-shortcut-row">
              <button
                class="btn-shortcut edit"
                onclick={() => (modalView = "edit")}
                ><Edit3 size={14} /> Koreksi Kontrak</button
              >
              <button
                class="btn-shortcut retur"
                onclick={() => (modalView = "retur")}
                ><Undo2 size={14} /> Retur Uang Tunai</button
              >
            </div>
          {/if}

          <div class="history-log">
            <h5><History size={13} /> Riwayat Mutasi Saldo Berjalan</h5>
            <div class="log-scroll-area">
              {#each history as h}
                <div
                  class="log-item"
                  style="border-left: 3px solid {h.tipeMutasi === 'tambah'
                    ? '#10b981'
                    : '#ef4444'}; padding-left: 8px; margin-bottom: 6px;"
                >
                  <div class="log-meta">
                    <span class="log-date">{formatTanggalMurni(h.tanggal)}</span
                    >

                    {#if h.tipeMutasi === "tambah"}
                      <span class="log-item-name" style="color: #047857;"
                        >➕ PENCAIRAN PANJAR BARU</span
                      >
                      <span
                        class="log-desc"
                        style="display: block; margin-top: 2px; color: #475569; font-size: 12px;"
                      >
                        Registrasi modal awal / tambahan dana panjar ke petani
                      </span>
                    {:else}
                      <span class="log-item-name"
                        >📦 {h.itemName || "Mutasi"}</span
                      >
                      <span
                        class="log-desc"
                        style="display: block; margin-top: 2px; color: #475569; font-size: 12px;"
                      >
                        {#if h.jumlahAmbil > 0}
                          Terima {h.jumlahAmbil}
                          {h.transactionUnit || "Kg"} (Total Bruto Rp {rupiah(
                            h.jumlahAmbil * h.hargaSaatIni,
                          )})
                        {:else}
                          Arus kas masuk pengembalian mandiri tunai (Retur)
                        {/if}
                      </span>
                      <span
                        style="font-size: 11px; color: #64748b; font-style: italic; display: block; margin-top: 1px;"
                      >
                        *Mengurangi saldo berjalan
                      </span>
                    {/if}
                  </div>

                  {#if h.tipeMutasi === "tambah"}
                    <span
                      class="log-amount"
                      style="font-weight: 800; color: #10b981; font-size: 13.5px; align-self: center;"
                    >
                      +Rp {rupiah(h.totalPotong)}
                    </span>
                  {:else}
                    <span
                      class="log-amount"
                      style="font-weight: 800; color: #dc2626; font-size: 13.5px; align-self: center;"
                    >
                      -Rp {rupiah(h.totalPotong)}
                    </span>
                  {/if}
                </div>
              {:else}
                <div class="empty-log">
                  <p>
                    Belum ada manifest penerimaan atau cicilan potong saldo.
                  </p>
                </div>
              {/each}
            </div>
          </div>

          {#if selectedDebt.status === "hutang"}
            <button
              class="btn-go"
              onclick={() => {
                showModal = false;
                goto(`/terima?id=${selectedDebt.id}`);
              }}>Proses Terima Barang / Potong DP</button
            >
          {:else}
            <div class="status-info-banner">
              Kontrak ini telah terselesaikan ({selectedDebt.status})
            </div>
          {/if}
        </div>

        <!-- SUB-VIEW 2: FORM EDIT KONTRAK -->
      {:else if modalView === "edit"}
        <div class="modal-header">
          <div>
            <h4>Koreksi Data Perjanjian</h4>
            <p class="subtitle">
              Ubah teks komoditas atau target volume timbangan
            </p>
          </div>
          <button class="btn-close" onclick={() => (modalView = "detail")}
            ><X size={20} /></button
          >
        </div>
        <div class="modal-body form-body">
          <div class="input-group">
            <label for="edit-item-name">Nama Komoditas</label><input
              id="edit-item-name"
              type="text"
              bind:value={editForm.item}
            />
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label for="edit-janji-vol">Volume Janji Awal</label><input
                id="edit-janji-vol"
                type="number"
                bind:value={editForm.jumlahJanji}
              />
            </div>
            <div class="input-group">
              <label for="edit-sisa-vol">Sisa Janji Sekarang</label><input
                id="edit-sisa-vol"
                type="number"
                bind:value={editForm.jumlahSisa}
              />
            </div>
          </div>
          <div class="input-group">
            <label for="edit-unit-name">Satuan</label><input
              id="edit-unit-name"
              type="text"
              bind:value={editForm.unit}
            />
          </div>
          <div class="action-shortcut-row" style="margin-top: 10px;">
            <button
              class="btn-shortcut text-slate"
              onclick={() => (modalView = "detail")}>Batal</button
            >
            <button
              class="btn-confirm-premium"
              onclick={handleUpdateDebt}
              style="padding: 10px 20px; font-size: 13px;"
              ><Save size={14} /> Simpan Perubahan</button
            >
          </div>
        </div>

        <!-- SUB-VIEW 3: FORM RETUR UANG CASH -->
      {:else if modalView === "retur"}
        <div class="modal-header">
          <div>
            <h4>Retur Pengembalian Dana Tunai</h4>
            <p class="subtitle">
              Petani menyerahkan uang kas kembali tanpa masuk barang
            </p>
          </div>
          <button class="btn-close" onclick={() => (modalView = "detail")}
            ><X size={20} /></button
          >
        </div>
        <div class="modal-body form-body">
          <div class="info-box accent" style="margin-bottom: 4px;">
            <span class="info-label">Maksimal Dana Bisa Diretur</span>
            <span class="info-val" style="color: #059669; font-size: 16px;"
              >Rp {rupiah(selectedDebt.saldoDPSisa)}</span
            >
          </div>
          <div class="input-group">
            <label for="retur-money-input"
              >Nominal Uang Tunai yang Dikembalikan</label
            >
            <div class="currency-input-wrapper">
              <span class="currency-prefix">Rp</span><input
                id="retur-money-input"
                type="number"
                bind:value={returForm.nominal}
                placeholder="0"
              />
            </div>
          </div>
          <div class="action-shortcut-row" style="margin-top: 10px;">
            <button
              class="btn-shortcut text-slate"
              onclick={() => (modalView = "detail")}>Batal</button
            >
            <button
              class="btn-confirm-premium"
              onclick={handleReturnCash}
              style="padding: 10px 20px; font-size: 13px; background-color: #ef4444;"
              ><Undo2 size={14} /> Eksekusi Retur Cash</button
            >
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Stylesheet Bawaan Anda Tetap Utuh Ditambah Pembaruan Komponen Baru */
  :global(body) {
    background-color: #f8fafc;
  }
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
    padding-top: 4px;
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

  .status-filter-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    background: #e2e8f0;
    padding: 4px;
    border-radius: 12px;
    margin-bottom: 18px;
  }
  .status-filter-tabs button {
    background: transparent;
    border: none;
    padding: 10px 4px;
    font-size: 12.5px;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.15s ease;
  }
  .status-filter-tabs button.active {
    background: #ffffff;
    color: #4f46e5;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  }

  .summary-card {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    color: #ffffff;
    padding: 22px;
    border-radius: 18px;
    margin-bottom: 24px;
    box-shadow: 0 10px 25px rgba(30, 27, 75, 0.15);
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
    letter-spacing: -0.5px;
    color: #38bdf8;
  }
  .btn-add-main {
    width: 100%;
    background: #4f46e5;
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
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    transition: all 0.15s ease;
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
    letter-spacing: 0.5px;
  }
  .count-badge {
    font-size: 11px;
    background: #e2e8f0;
    color: #334155;
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
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.02);
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
    color: #4338ca;
    font-weight: 500;
  }
  .bullet {
    font-size: 10px;
    color: #cbd5e1;
  }
  .progress-container {
    margin-top: 6px;
  }
  .sub-progress {
    font-size: 11.5px;
    color: #475569;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 6px;
    display: inline-block;
  }
  .item-price-side {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .price-val {
    font-weight: 800;
    font-size: 14px;
    text-align: right;
  }
  .price-val.active {
    color: #10b981;
  }
  .price-val.muted {
    color: #94a3b8;
  }
  .arrow-icon {
    color: #94a3b8;
  }

  /* BARU: Shortcut Button Row di Dalam Modal */
  .action-shortcut-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .btn-shortcut {
    flex: 1;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: white;
    color: #475569;
  }
  .btn-shortcut.edit {
    border-color: #bfdbfe;
    color: #2563eb;
    background: #eff6ff;
  }
  .btn-shortcut.retur {
    border-color: #fde68a;
    color: #d97706;
    background: #fffbeb;
  }
  .btn-confirm-premium {
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .badge {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .badge.lunas {
    background: #d1fae5;
    color: #065f46;
  }
  .badge.returned {
    background: #fee2e2;
    color: #991b1b;
  }
  .item-card.is-lunas {
    border-color: #f1f5f9;
    background: #fafbfc;
    opacity: 0.65;
  }

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
    align-items: center;
    justify-content: center;
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
  .toggle-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 12px 14px;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .toggle-info {
    display: flex;
    flex-direction: column;
  }
  .toggle-title {
    font-size: 13px;
    font-weight: 700;
    color: #1e293b;
  }
  .toggle-sub {
    font-size: 11px;
    color: #64748b;
  }
  .input-with-icon {
    position: relative;
    width: 100%;
  }
  .icon-left {
    position: absolute;
    left: 12px;
    top: 14px;
    color: #94a3b8;
  }
  .input-with-icon input {
    padding-left: 36px;
  }
  input {
    width: 100%;
    padding: 12px;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-size: 14.5px;
    background: #ffffff;
    color: #1e293b;
    outline: none;
  }
  input:focus {
    border-color: #4f46e5;
  }
  label {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 4px;
    display: block;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .highlight-input-group {
    background: #f5f3ff;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #ddd6fe;
  }
  .highlight-input-group label {
    color: #5b21b6;
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
    color: #6d28d9;
    font-size: 15px;
  }
  .currency-input-wrapper input {
    padding-left: 38px;
    border-color: #c4b5fd;
    font-weight: 700;
    color: #5b21b6;
    font-size: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }
  .optional-fields {
    background: #f8fafc;
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed #cbd5e1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .btn-save {
    width: 100%;
    background: #4f46e5;
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
  }

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
  }

  .brief-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
  }
  .info-box {
    background: #f8fafc;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .info-box.accent {
    background: #ecfdf5;
    border-color: #a7f3d0;
  }
  .info-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
  }
  .info-val {
    font-weight: 800;
    color: #0f172a;
    font-size: 13.5px;
    display: block;
    margin-top: 1px;
  }
  .info-box.accent .info-val {
    color: #059669;
    font-size: 14.5px;
  }
  .datespec {
    font-size: 11.5px;
    color: #475569;
  }

  .history-log {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 12px;
    margin-bottom: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .history-log h5 {
    margin: 0 0 10px 0;
    font-size: 11px;
    color: #475569;
    font-weight: 700;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .log-scroll-area {
    overflow-y: auto;
    max-height: 160px;
    padding-right: 4px;
  }
  .log-scroll-area::-webkit-scrollbar {
    width: 4px;
  }
  .log-scroll-area::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .log-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .log-item:last-child {
    border-bottom: none;
  }
  .log-date {
    font-size: 10.5px;
    color: #94a3b8;
  }
  .log-item-name {
    font-weight: 700;
    color: #312e81;
    font-size: 12.5px;
    display: block;
    margin: 1px 0;
  }
  .log-desc {
    font-size: 11.5px;
    color: #475569;
  }
  .log-amount {
    font-weight: 800;
    color: #dc2626;
    font-size: 13px;
  }

  .btn-go {
    width: 100%;
    background: #0f172a;
    color: #ffffff;
    padding: 14px;
    border-radius: 12px;
    font-weight: 700;
    border: none;
    font-size: 14px;
    cursor: pointer;
  }
  .status-info-banner {
    text-align: center;
    padding: 10px;
    background: #f1f5f9;
    border-radius: 10px;
    color: #475569;
    font-size: 13px;
    font-style: italic;
  }

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
    max-height: 160px;
    overflow-y: auto;
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
    color: #059669;
    font-size: 10px;
    background: #ecfdf5;
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
  }

  .switch-mini {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }
  .switch-mini input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider-mini {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #cbd5e1;
    transition: 0.2s;
    border-radius: 20px;
  }
  .slider-mini:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }
  input:checked + .slider-mini {
    background-color: #4f46e5;
  }
  input:checked + .slider-mini:before {
    transform: translateX(16px);
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
    width: 24px;
    height: 24px;
    border: 3px solid #e2e8f0;
    border-top-color: #4f46e5;
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
    margin-top: 10px;
  }
  .empty-log {
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
    padding: 20px 0;
    font-style: italic;
  }
</style>
