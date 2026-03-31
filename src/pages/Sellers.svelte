<script>
  import { onMount } from 'svelte';
  import { getDB, insert } from '$lib/api';

  let sellers = [];
  let name = $state('');

  async function load() {
    const db = await getDB();
    sellers = db.sellers;
  }

  async function add() {
    const data = {
      id: crypto.randomUUID(),
      name
    };

    await insert('sellers', data);

    name = '';
    load();
  }

  onMount(load);

</script>

<h3>Nama Penjual</h3>

<input bind:value={name} />
<button on:click={add}>Tambah</button>

<ul>
  {#each sellers as s}
    <li>{s.name}</li>
  {/each}
</ul>