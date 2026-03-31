<script>
  import { page } from '$lib/stores';

  const menus = [
    { name: 'Dashboard', key: 'dashboard' },
    { name: 'Pemasok/Penjual', key: 'sellers' },
    { name: 'Pembelian', key: 'purchases' },
    { name: 'Utang', key: 'debts' },
    { name: 'Produksi', key: 'production' },
    { name: 'Penerimaan', key: 'income' }
  ];
</script>

<div class="sidebar">
  <h2>Kopra App</h2>

  {#each menus as menu}
    <div 
      class:selected={$page === menu.key}
      on:click={() => page.set(menu.key)}
    >
      {menu.name}
    </div>
  {/each}
</div>

<style>
.sidebar {
  width: 200px;
  background: #1e293b;
  color: white;
  padding: 16px;
}

.sidebar div {
  padding: 10px;
  cursor: pointer;
}

.sidebar div:hover {
  background: #334155;
}

.selected {
  background: #475569;
}
</style>