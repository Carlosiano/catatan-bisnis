<script>
  let kelapa = 0;
  let kopra = 0;
  let data = [];

  function add() {
    data = [...data, {
      id: crypto.randomUUID(),
      kelapa,
      kopra
    }];
  }
</script>

<h3>Produksi</h3>

<input type="number" bind:value={kelapa} placeholder="Total kelapa" />
<input type="number" bind:value={kopra} placeholder="Kg kopra" />

<button on:click={add}>Simpan</button>

<ul>
  {#each data as d}
    <li>{d.kelapa} → {d.kopra} Kg</li>
  {/each}
</ul>