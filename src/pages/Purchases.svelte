<script>
  import { onMount } from "svelte";
  import { getDB, insert } from "$lib/api";
  import AddPurchaseModal from "$components/AddPurchaseModal.svelte";
  import { showAddPurchases } from "$lib/stores";

  let sellers = [];
  let purchases = [];

  let sellerId = "";
  let item = "kelapa";

  let jumlah = 0;
  let harga = 100000;

  let unit = "subur";
  let customUnit = "";
  let useCustomUnit = false;

  let groupBy = "none";

  // default unit mapping
  const itemUnits = {
    kelapa: "subur",
    kopra: "kg",
    mente: "kg",
    jagung: "kg",
    beras: "kg",
  };

  // default unit list
  const unitOptions = ["subur", "kg", "gram", "ton", "ikat", "karung", "liter"];

  // auto unit dari item
  $: if (!useCustomUnit) {
    unit = itemUnits[item] || "";
  }

  function formatDate(date) {
    return new Date(date).toLocaleString("id-ID");
  }

  function rupiah(n) {
    return new Intl.NumberFormat("id-ID").format(n);
  }

  function getSellerName(id) {
    const s = sellers.find((s) => s.id === id);
    return s ? s.name : "Tidak ditemukan";
  }

  function totalOf(list) {
    return list.reduce((sum, p) => sum + p.total, 0);
  }

  function groupData() {
    const map = {};

    for (const p of purchases) {
      let key = "";
      const date = new Date(p.tanggal);

      if (groupBy === "seller") key = getSellerName(p.sellerId);
      if (groupBy === "item") key = p.item;
      if (groupBy === "day") key = date.toLocaleDateString("id-ID");

      if (groupBy === "week") {
        const firstDay = new Date(date);
        firstDay.setDate(date.getDate() - date.getDay());
        key = `Minggu ${firstDay.toLocaleDateString("id-ID")}`;
      }

      if (groupBy === "month") {
        key = date.toLocaleString("id-ID", { month: "long", year: "numeric" });
      }

      if (groupBy === "year") key = date.getFullYear();

      if (!map[key]) map[key] = [];
      map[key].push(p);
    }

    return map;
  }

  let items = [];

  async function load() {
    const db = await getDB();
    sellers = db.sellers;

    // sort terbaru
    purchases = db.purchases.sort(
      (a, b) => new Date(b.tanggal) - new Date(a.tanggal),
    );

    items = db.items || [];
  }

  async function add() {
    const finalUnit = useCustomUnit ? customUnit : unit;

    if (!sellerId || !item || jumlah <= 0 || harga <= 0 || !finalUnit) return;

    const data = {
      id: crypto.randomUUID(),
      sellerId,
      item,
      unit: finalUnit,
      jumlah,
      harga,
      total: jumlah * harga,
      tanggal: new Date().toISOString(),
    };

    await insert("purchases", data);

    // reset
    jumlah = 0;
    harga = 100000;
    customUnit = "";
    useCustomUnit = false;

    load();
  }

  onMount(load);
</script>

{#if $showAddPurchases} 
  <AddPurchaseModal />
{/if}

<hr />

<!-- GROUPING -->
<select bind:value={groupBy}>
  <option value="none">Semua</option>
  <option value="seller">Per Penjual</option>
  <option value="item">Per Barang</option>
  <option value="day">Harian</option>
  <option value="week">Mingguan</option>
  <option value="month">Bulanan</option>
  <option value="year">Tahunan</option>
</select>

<!-- TABLE -->
{#if groupBy === "none"}
  <table border="1">
    <thead>
      <tr>
        <th>Nama</th>
        <th>Barang</th>
        <th>Jumlah</th>
        <th>Harga</th>
        <th>Total</th>
        <th>Tanggal</th>
      </tr>
    </thead>

    <tbody>
      {#each purchases as p}
        <tr>
          <td>{getSellerName(p.sellerId)}</td>
          <td>{p.item}</td>
          <td>{p.jumlah} {p.unit}</td>
          <td>Rp {rupiah(p.harga)}</td>
          <td>Rp {rupiah(p.total)}</td>
          <td>{formatDate(p.tanggal)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h4>Total: Rp {rupiah(totalOf(purchases))}</h4>
{:else}
  {#each Object.entries(groupData()) as [key, list]}
    <h4>
      {key} — Total: Rp {rupiah(totalOf(list))}
    </h4>

    <table border="1">
      <thead>
        <tr>
          <th>Nama</th>
          <th>Barang</th>
          <th>Jumlah</th>
          <th>Harga</th>
          <th>Total</th>
          <th>Tanggal</th>
        </tr>
      </thead>
      <tbody>
        {#each list as p}
          <tr>
            <td>{getSellerName(p.sellerId)}</td>
            <td>{p.item}</td>
            <td>{p.jumlah} {p.unit}</td>
            <td>Rp {rupiah(p.harga)}</td>
            <td>Rp {rupiah(p.total)}</td>
            <td>{formatDate(p.tanggal)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/each}
{/if}
