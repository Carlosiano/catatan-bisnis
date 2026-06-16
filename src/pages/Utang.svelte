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
    History,
    Trash2,
  } from "lucide-svelte";

  // --- States (Svelte 5 Runes) ---
  let debts = $state([]);
  let sellers = $state([]);
  let items = $state([]);
  let units = $state([]);
  let loading = $state(true);
  let mode = $state("list"); // "list" atau "add"

  // Tab Filter Status Utang Kita
  let filterStatus = $state("hutang"); // "hutang", "lunas", "all"

  // State untuk Modal Riwayat & Pelunasan
  let selectedDebt = $state(null);
  let showPayModal = $state(false);
  let debtHistory = $state([]); // Menyimpan data log transaksi
  let nominalBayarForm = $state<number | undefined>();
  let catatanPelunasan = $state("");
  let subModalView = $state("detail"); // "detail" untuk log riwayat, "bayar" untuk form input uang

  // States untuk Form Pendaftaran Utang Baru
  let newDebt = $state({
    sellerName: "",
    item: "",
    unit: "",
    jumlah: undefined,
    hargaSatuan: undefined,
    totalUtang: undefined,
    catatan: "",
  });

  let sellerSearchText = $state("");
  let itemSearchText = $state("");
  let unitSearchText = $state("");
  let showSellerHits = $state(false);
  let showItemHits = $state(false);
  let showUnitHits = $state(false);

  // --- Efek Reaktif untuk Pengisian Satuan Otomatis ---
  $effect(() => {
    const cleanItemName = newDebt.item.trim().toLowerCase();
    if (cleanItemName !== "") {
      if (cleanItemName === "kelapa") {
        newDebt.unit = "subur";
        unitSearchText = "subur";
      } else {
        const matchItem = items.find(
          (i) => i.name.toLowerCase() === cleanItemName,
        );
        if (matchItem && matchItem.defaultUnitName) {
          newDebt.unit = matchItem.defaultUnitName;
          unitSearchText = matchItem.defaultUnitName;
        }
      }
    }
  });

  // --- Efek Kalkulasi Otomatis Nominal Utang Baru ---
  $effect(() => {
    if (newDebt.jumlah !== undefined && newDebt.hargaSatuan !== undefined) {
      newDebt.totalUtang = Number(newDebt.jumlah) * Number(newDebt.hargaSatuan);
    }
  });

  // --- Derived States ---
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

  // Filter Baris Akun Utang berdasarkan Tab
  let filteredDebts = $derived(
    debts.filter((d) => {
      if (filterStatus === "hutang") return d.status === "hutang";
      if (filterStatus === "lunas") return d.status === "lunas";
      return true;
    }),
  );

  // Total hanya menjumlahkan nominal akun yang statusnya belum lunas
  const totalUtangKita = $derived(
    Array.isArray(debts)
      ? debts
          .filter((d) => d.status === "hutang")
          .reduce((sum, d) => sum + (Number(d?.total) || 0), 0)
      : 0,
  );

  // Perhitungan sisa utang pasca bayar secara live
  const sisaUtangPascaBayar = $derived(
    selectedDebt
      ? Math.max(0, Number(selectedDebt.total) - (nominalBayarForm || 0))
      : 0,
  );

  // --- Functions ---
  async function loadData() {
    loading = true;
    try {
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
    }
    file: {
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
      loading = true;
      const finalSellerId = await dbActions.getOrCreateSeller(
        newDebt.sellerName.trim(),
      );

      await dbActions.addOurDebt({
        sellerId: finalSellerId,
        item: newDebt.item.trim().toLowerCase(),
        unit: newDebt.unit ? newDebt.unit.trim().toLowerCase() : "kg",
        jumlah: Number(newDebt.jumlah) || 0,
        hargaSatuan: Number(newDebt.hargaSatuan) || 0,
        total: Number(newDebt.totalUtang),
        catatan: newDebt.catatan
          ? newDebt.catatan.trim()
          : "Utang nota beli barang",
      });

      alert("Catatan utang ke petani berhasil disimpan!");
      resetForm();
      mode = "list";
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan utang.");
    } finally {
      loading = false;
    }
  }

  async function handleSettleDebt() {
    if (!nominalBayarForm || nominalBayarForm <= 0) {
      return alert("Masukkan nilai nominal pembayaran yang valid!");
    }
    if (nominalBayarForm > selectedDebt.total) {
      return alert("Nominal pembayaran melebihi batas total utang petani!");
    }

    const pesanKonfirm =
      nominalBayarForm === selectedDebt.total
        ? `Tandai utang ke ${selectedDebt.sellerName} sebesar Rp ${rupiah(nominalBayarForm)} sebagai LUNAS TOTAL?`
        : `Bayar cicilan ke ${selectedDebt.sellerName} sebesar Rp ${rupiah(nominalBayarForm)}? (Sisa utang: Rp ${rupiah(sisaUtangPascaBayar)})`;

    if (!confirm(pesanKonfirm)) return;

    try {
      const teksKeterangan =
        catatanPelunasan.trim() !== ""
          ? catatanPelunasan.trim()
          : `Dicairkan cash kasir pada tanggal ${new Date().toLocaleDateString("id-ID")}`;

      await dbActions.payOurDebt(
        selectedDebt.sellerId,
        nominalBayarForm,
        teksKeterangan,
      );
      alert("Pembayaran utang berhasil dibukukan!");
      showPayModal = false;
      await loadData();
    } catch (e) {
      alert("Gagal memperbarui status transaksi pelunasan.");
    }
  }

  async function handleDeleteGroup() {
    if (!selectedDebt) return;

    const pesanKonfirm = `⚠️ PERINGATAN BERSALDO TOTAL!\n\nApakah Anda yakin ingin MENGHAPUS SEKALIGUS seluruh daftar utang & riwayat log milik "${selectedDebt.sellerName}"?\n\nTindakan ini akan menghapus semua nota berjalan dan tidak bisa dikembalikan.`;

    if (!confirm(pesanKonfirm)) return;

    try {
      loading = true;
      await dbActions.deleteOurDebtGroup(selectedDebt.sellerId);
      alert(
        `Seluruh berkas tanggungan utang ${selectedDebt.sellerName} berhasil dibersihkan!`,
      );
      showPayModal = false;
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus berkas utang dari database.");
    } finally {
      loading = false;
    }
  }

  // Fungsi baru untuk menghapus satu nota transaksi lunas yang dipilih
  async function handleDeleteSingleTransaction(transactionId) {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus arsip riwayat transaksi ini secara permanen?\n\nJika ini adalah riwayat cicilan, saldo sisa utang Anda akan otomatis bertambah kembali.",
      )
    )
      return;

    try {
      // 1. Kirim ID log transaksi ke backend perbaikan kita
      await dbActions.deleteOurDebtTransaction(transactionId);
      alert("Nota riwayat transaksi berhasil dibersihkan dari pembukuan.");

      // 2. Ambil ulang data manifes riwayat agar langsung hilang dari layar modal
      if (selectedDebt) {
        debtHistory = await dbActions.getOurDebtHistory(selectedDebt.sellerId);

        // 3. Muat ulang daftar kelompok utama di background agar nominal luar ikut sinkron
        const updatedDebts = await dbActions.getOurDebts();
        debts = Array.isArray(updatedDebts) ? updatedDebts : [];

        // 4. Cari ulang data grup saat ini untuk memperbarui sisa saldo berjalan di kepala modal
        const currentGroup = debts.find(
          (d) => d.sellerId === selectedDebt.sellerId,
        );
        if (currentGroup) {
          selectedDebt = currentGroup;
        } else {
          showPayModal = false; // Tutup modal jika seluruh data riwayat petani ini habis total
        }
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus riwayat transaksi.");
    }
  }

  function resetForm() {
    newDebt = {
      sellerName: "",
      item: "",
      unit: units[0]?.name || "kg",
      jumlah: undefined,
      hargaSatuan: undefined,
      totalUtang: undefined,
      catatan: "",
    };
    sellerSearchText = "";
    itemSearchText = "";
    unitSearchText = units[0]?.name || "kg";
  }

  async function openPayModal(d) {
    selectedDebt = d;
    nominalBayarForm = d.total > 0 ? d.total : undefined;
    catatanPelunasan = "";
    subModalView = "detail";
    showPayModal = true;

    debtHistory = await dbActions.getOurDebtHistory(d.sellerId);
  }

  function rupiah(n) {
    return new Intl.NumberFormat("id-ID").format(n || 0);
  }

  function formatTanggal(txtDate) {
    if (!txtDate) return "-";
    const d = new Date(txtDate);
    if (isNaN(d.getTime())) return txtDate;

    const tanggalBiasa = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const jamMenit = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${tanggalBiasa} - Waktu: ${jamMenit}`;
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

    <div
      class="status-filter-tabs"
      style="display: grid; grid-template-columns: 1fr 1fr 1fr; background: #e2e8f0; padding: 4px; border-radius: 12px; margin-bottom: 18px;"
    >
      <button
        class:active={filterStatus === "hutang"}
        onclick={() => (filterStatus = "hutang")}
        style="background: {filterStatus === 'hutang'
          ? 'white'
          : 'transparent'}; color: {filterStatus === 'hutang'
          ? '#b91c1c'
          : '#475569'}; border: none; padding: 10px 4px; font-size: 12.5px; font-weight: 700; border-radius: 8px; cursor: pointer;"
      >
        Belum Lunas
      </button>
      <button
        class:active={filterStatus === "lunas"}
        onclick={() => (filterStatus = "lunas")}
        style="background: {filterStatus === 'lunas'
          ? 'white'
          : 'transparent'}; color: {filterStatus === 'lunas'
          ? '#b91c1c'
          : '#475569'}; border: none; padding: 10px 4px; font-size: 12.5px; font-weight: 700; border-radius: 8px; cursor: pointer;"
      >
        Lunas / Selesai
      </button>
      <button
        class:active={filterStatus === "all"}
        onclick={() => (filterStatus = "all")}
        style="background: {filterStatus === 'all'
          ? 'white'
          : 'transparent'}; color: {filterStatus === 'all'
          ? '#b91c1c'
          : '#475569'}; border: none; padding: 10px 4px; font-size: 12.5px; font-weight: 700; border-radius: 8px; cursor: pointer;"
      >
        Semua ({debts.length})
      </button>
    </div>

    <div class="list-section">
      <div class="section-title">
        <h3>Daftar Tanggungan Kelompok Petani</h3>
        <span
          class="count-badge"
          style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;"
        >
          {filteredDebts.length} Baris
        </span>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Memuat berkas utang...</p>
        </div>
      {:else}
        <div class="grid-list">
          {#if filteredDebts.length > 0}
            {#each filteredDebts as d (d.sellerId)}
              <div
                class="item-card"
                onclick={() => openPayModal(d)}
                style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-left: 4px solid {d.status ===
                'hutang'
                  ? '#ef4444'
                  : '#10b981'}; opacity: {d.status === 'lunas' ? 0.75 : 1};"
              >
                <div class="item-info" style="flex: 1; padding-right: 8px;">
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
                    {#if d.status === "hutang"}
                      <span class="badge-warning">Bon Aktif</span>
                    {:else}
                      <span
                        class="badge-warning"
                        style="background: #d1fae5; color: #065f46;"
                        >Selesai</span
                      >
                    {/if}
                  </div>

                  <div
                    class="meta-row"
                    style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: #64748b;"
                  >
                    <span class="sub-time"
                      >⏰ Aktivitas Akhir: {formatTanggal(d.tanggal)}</span
                    >
                  </div>

                  <div class="progress-container" style="margin-top: 6px;">
                    <span
                      class="sub-progress"
                      style="font-size: 11.5px; color: #1e293b; background: #f1f5f9; padding: 4px 10px; border-radius: 8px; display: block; line-height: 1.4; border: 1px solid #e2e8f0; white-space: normal; word-break: break-word;"
                    >
                      Muatan Terikat: <strong style="color: #4f46e5;"
                        >{d.unit}</strong
                      >
                    </span>
                  </div>
                </div>

                <div
                  class="item-price-side"
                  style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;"
                >
                  <span
                    class="price-val"
                    style="font-weight: 800; color: {d.status === 'hutang'
                      ? '#dc2626'
                      : '#10b981'}; font-size: 15px;"
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
              <p>Tidak ada tanggungan utang pada kategori ini.</p>
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
              oninput={(e) => {
                newDebt.item = e.target.value;
                itemSearchText = e.target.value;
              }}
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
              oninput={(e) => {
                newDebt.unit = e.target.value;
                unitSearchText = e.target.value;
              }}
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

        <div class="grid-2">
          <div class="input-group">
            <label for="qty-input">Volume / Jumlah Barang *</label>
            <input
              id="qty-input"
              type="number"
              step="any"
              placeholder="0"
              bind:value={newDebt.jumlah}
            />
          </div>
          <div class="input-group">
            <label for="price-unit-input"
              >Harga Per {newDebt.unit || "Satuan"} *</label
            >
            <input
              id="price-unit-input"
              type="number"
              placeholder="0"
              bind:value={newDebt.hargaSatuan}
            />
          </div>
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
          {#if newDebt.jumlah && newDebt.hargaSatuan}
            <small
              style="color: #b91c1c; font-size: 11px; margin-top: 4px; display: block; font-style: italic;"
            >
              * Otomatis dihitung: {newDebt.jumlah} x Rp {rupiah(
                newDebt.hargaSatuan,
              )}
            </small>
          {/if}
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
      {#if subModalView === "detail"}
        <div class="modal-header">
          <div>
            <h4>Kartu Kontrol Pembayaran ({selectedDebt.sellerName})</h4>
            <p class="subtitle">
              Riwayat penambahan nota utang & cicilan keluar berjalan
            </p>
          </div>
          <button class="btn-close" onclick={() => (showPayModal = false)}
            ><X size={20} /></button
          >
        </div>

        <div class="modal-body form-body">
          <div
            class="brief-info-box"
            style="border-left: 4px solid {selectedDebt.total > 0
              ? '#dc2626'
              : '#10b981'}; background: {selectedDebt.total > 0
              ? '#fff5f5'
              : '#f0fdf4'};"
          >
            <span
              class="info-lbl"
              style="color: {selectedDebt.total > 0 ? '#991b1b' : '#065f46'};"
              >Sisa Sisa Total Utang Kita Saat Ini</span
            >
            <span
              class="info-val"
              style="font-size: 18px; color: {selectedDebt.total > 0
                ? '#dc2626'
                : '#10b981'}; font-weight: 800;"
            >
              Rp {rupiah(selectedDebt.total)}
            </span>
          </div>

          <div
            class="history-log"
            style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; max-height: 220px; overflow-y: auto; background: #f8fafc;"
          >
            <h5
              style="margin: 0 0 10px 0; font-size: 11px; color: #475569; font-weight: 700; text-transform: uppercase; display: flex; align-items: center; gap: 4px;"
            >
              <History size={13} /> Log Arus Pembukuan Utang
            </h5>

            <div class="log-scroll-area">
              {#each debtHistory as log}
                <div
                  class="log-item"
                  style="border-left: 4px solid {log.tipe === 'tambah'
                    ? '#dc2626'
                    : '#10b981'}; padding: 10px; margin-bottom: 10px; background: white; border-radius: 10px; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; position: relative;"
                >
                  {#if log.tipe === "kurang" || selectedDebt.status === "lunas"}
                    <button
                      onclick={() => handleDeleteSingleTransaction(log.id)}
                      style="position: absolute; right: 10px; bottom: 10px; background: #fee2e2; border: none; color: #ef4444; padding: 6px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                      title="Hapus Nota Ini"
                    >
                      <Trash2 size={13} />
                    </button>
                  {/if}

                  <div
                    style="display: flex; flex-direction: column; gap: 4px; width: 100%;"
                  >
                    <div
                      style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding-right: 25px;"
                    >
                      <span
                        class="log-date"
                        style="font-size: 11px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;"
                      >
                        📅 {formatTanggal(log.tanggal)}
                      </span>
                      <span
                        style="font-weight: 800; font-size: 14px; color: {log.tipe ===
                        'tambah'
                          ? '#dc2626'
                          : '#10b981'};"
                      >
                        {log.tipe === "tambah" ? "+(Utang)" : "-(Bayar)"} Rp {rupiah(
                          log.nominal,
                        )}
                      </span>
                    </div>

                    <div style="margin-top: 4px;">
                      <span
                        class="log-item-name"
                        style="font-weight: 800; font-size: 13.5px; color: #0f172a; text-transform: uppercase;"
                      >
                        {log.tipe === "tambah"
                          ? "📦 PEMBUKAAN NOTA UTANG BARU"
                          : "💸 TRANSAKSI KAS KELUAR (CICILAN)"}
                      </span>
                      <p
                        style="color: #334155; font-size: 12px; margin: 4px 0 0 0; line-height: 1.5; font-style: italic; background: #fafafa; padding: 6px; border-radius: 6px; border: 1px dashed #e2e8f0; white-space: normal; word-break: break-word;"
                      >
                        📝 {log.catatan}
                      </p>
                    </div>
                  </div>
                </div>
              {:else}
                <p
                  style="font-size: 12px; color: #94a3b8; font-style: italic; text-align: center; padding: 30px 0;"
                >
                  Belum ada jejak riwayat mutasi.
                </p>
              {/each}
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 5px; width: 100%;">
            <button
              class="btn-save"
              onclick={handleDeleteGroup}
              style="background: #ef4444; color: white; flex: 1; padding: 12px; font-size: 13px;"
            >
              🗑️ Hapus Grup
            </button>

            {#if selectedDebt.status === "hutang"}
              <button
                class="btn-settle-confirm"
                onclick={() => {
                  subModalView = "bayar";
                }}
                style="background: #0f172a; color: white; flex: 2; padding: 12px; font-size: 13px;"
              >
                💸 Buka Form Bayar / Cicil
              </button>
            {:else}
              <button
                disabled
                style="background: #cbd5e1; color: #94a3b8; flex: 2; padding: 12px; font-size: 13px; border: none; border-radius: 12px; font-weight: 700; cursor: not-allowed;"
              >
                ✅ Utang Sudah Lunas
              </button>
            {/if}
          </div>
        </div>
      {:else if subModalView === "bayar"}
        <div class="modal-header">
          <div>
            <h4>Input Pembayaran Kas Keluar</h4>
            <p class="subtitle">
              Kurangi saldo utang berjalan milik {selectedDebt.sellerName}
            </p>
          </div>
          <button
            class="btn-close"
            onclick={() => {
              subModalView = "detail";
            }}><ArrowLeft size={16} /></button
          >
        </div>

        <div class="modal-body form-body">
          <div
            class="grid-2"
            style="gap: 10px; grid-template-columns: 1fr 1fr;"
          >
            <div class="brief-info-box">
              <span class="info-lbl">Total Sisa Bon</span>
              <span class="info-val" style="font-size: 14px; color: #dc2626;"
                >Rp {rupiah(selectedDebt.total)}</span
              >
            </div>
            <div
              class="brief-info-box"
              style="background: #f0fdf4; border-color: #bbf7d0;"
            >
              <span class="info-lbl" style="color: #166534;"
                >Sisa Pasca Bayar</span
              >
              <span class="info-val" style="font-size: 14px; color: #15803d;"
                >Rp {rupiah(sisaUtangPascaBayar)}</span
              >
            </div>
          </div>

          <div
            class="input-group highlight-input-group"
            style="background: #fffbeb; border-color: #fef08a;"
          >
            <label for="pay-money-input" style="color: #854d0e;"
              >Nominal Uang Tunai Keluar *</label
            >
            <div class="currency-input-wrapper">
              <span class="currency-prefix" style="color: #a16207;">Rp</span>
              <input
                id="pay-money-input"
                type="number"
                placeholder="0"
                style="border-color: #fef08a; color: #854d0e;"
                bind:value={nominalBayarForm}
              />
            </div>
            <small
              style="color: #a16207; font-size: 11px; margin-top: 2px; display: block;"
            >
              * Ketik nominal lebih kecil dari total bon jika ingin **MENCICIL
              SEBAGIAN**.
            </small>
          </div>

          <div class="input-group">
            <label for="pay-note">Catatan Alasan / Penyerahan Uang</label>
            <input
              id="pay-note"
              type="text"
              placeholder="Contoh: Cicilan nota kelapa 100 subur"
              bind:value={catatanPelunasan}
            />
          </div>

          <div
            class="action-shortcut-row"
            style="display: flex; gap: 8px; margin-top: 4px;"
          >
            <button
              class="btn-save"
              onclick={() => {
                subModalView = "detail";
              }}
              style="background: #e2e8f0; color: #475569; flex: 1;"
              >Kembali</button
            >
            <button
              class="btn-settle-confirm"
              onclick={handleSettleDebt}
              style="background: #4f46e5; flex: 2; height: 100%; margin: 0;"
            >
              <CheckCircle2 size={16} /> Validasi & Potong Utang
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* CSS bawaan Anda tetap utuh */
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
    gap: 6px;
  }
  .price-val {
    font-weight: 800;
    font-size: 14.5px;
    text-align: right;
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
  .highlight-input-group {
    background: #fef2f2;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #fee2e2;
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
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    margin-bottom: 38px;
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
    width: 100%;
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
    max-height: 150px;
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
    color: #b91c1c;
    font-size: 10px;
    background: #fee2e2;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
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
  .log-scroll-area {
    overflow-y: auto;
    max-height: 214px;
    padding-right: 2px;
  }
</style>
