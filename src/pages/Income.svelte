<script>
  import { onMount } from 'svelte';
  import { getDB, insert } from '$lib/api';

  let incomes = [];

  let item = $state('kopra');
  let jumlah = $state(0);
  let harga = $state(0);

  let unit = $state('kg');

  let items = $state([]);


  const itemUnits = {
    kopra: 'kg',
    kelapa: 'subur',
    mente: 'kg'
  };

  // auto unit
  $effect(() => unit = items.find(i => i.name === item)?.unit || '')

  function rupiah(n) {
    return new Intl.NumberFormat('id-ID').format(n || 0);
  }

  function formatDate(date) {
    return new Date(date).toLocaleString('id-ID');
  }

  function totalOf(list) {
    return list.reduce((sum, i) => sum + (i.total || 0), 0);
  }

  // 🔥 GROUP BY ITEM (AMAN)
let grouped = $state({});
let totalGlobal = $state(0);

function compute() {
  const map = {};

  for (const i of incomes) {
    const key = i.item || 'lainnya';

    if (!map[key]) map[key] = [];
    map[key].push(i);
  }

  grouped = map;

  totalGlobal = Object.values(map)
    .reduce((sum, list) => {
      return sum + list.reduce((s, x) => s + Number(x.total || 0), 0);
    }, 0);
}

  async function load() {
    const db = await getDB();

    incomes = (db.incomes || []).sort(
      (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
    );


    items = db.items || [];

    compute();
  }

  async function add() {
    if (jumlah <= 0 || harga <= 0) return;

    const data = {
      id: crypto.randomUUID(),
      item,
      jumlah,
      unit,
      harga,
      total: jumlah * harga,
      tanggal: new Date().toISOString()
    };

    await insert('incomes', data);

    jumlah = 0;
    harga = 0;

    await load();
  }

  onMount(load);
</script>

<h3>Penjualan</h3>

<!-- 🔥 TOGGLE ITEM -->
<div style="display:flex; gap:8px; margin-bottom:10px;">
  {#each items as i}
    <button
      onclick={() => item = i.name}
      style="
        padding:8px 12px;
        border-radius:8px;
        border:none;
        cursor:pointer;
        background:{item === i.name ? '#16a34a' : '#e5e7eb'};
        color:{item === i.name ? 'white' : 'black'};
      "
    >
      {i.name}
    </button>
  {/each}
</div>

<!-- INPUT -->
<div style="display:flex; gap:10px; margin-bottom:10px;">
  <input 
    type="number" 
    bind:value={jumlah} 
    placeholder={`Jumlah (${unit})`} 
  />

  <input 
    type="number" 
    bind:value={harga} 
    placeholder={`Harga per ${unit}`} 
  />
</div>

<p><b>Total: Rp {rupiah(jumlah * harga)}</b></p>

<button onclick={add}>Tambah</button>

<hr />

<!-- 🔍 DEBUG -->
<p>Jumlah data: {incomes.length}</p>
<!-- <p>Total debug: {getTotalGlobal()}</p> -->

<!-- EMPTY -->
{#if incomes.length === 0}
  <p>Belum ada data penjualan</p>
{/if}

<!-- 🔥 GROUPED VIEW -->
{#each Object.entries(grouped) as [key, list]}
  <h4 style="color:#16a34a;">
    {key.toUpperCase()} — Total: Rp {rupiah(totalOf(list))}
  </h4>

  <table border="1" cellpadding="6" style="margin-bottom:10px;">
    <thead>
      <tr>
        <th>Jumlah</th>
        <th>Harga</th>
        <th>Total</th>
        <th>Tanggal</th>
      </tr>
    </thead>

    <tbody>
      {#each list as i}
        <tr>
          <td>{i.jumlah} {i.unit}</td>
          <td>Rp {rupiah(i.harga)}</td>
          <td>Rp {rupiah(i.total)}</td>
          <td>{formatDate(i.tanggal)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/each}

<!-- 🔥 TOTAL GLOBAL -->
<h2 style="margin-top:20px;">
  Total Semua Penjualan: Rp {rupiah(totalGlobal)}
</h2>