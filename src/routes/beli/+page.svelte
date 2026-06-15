<!-- /src/routes/beli/+page.svelte -->
<script>
  import Beli from "$pages/Beli.svelte";
</script>


<!-- <div class="tambah-beli">
  <button on:click={() => ($showAddPurchases = true)}>
    <Plus /> TAMBAH PEMBELIAN
  </button>
</div> -->

<Beli />


<style>
  .tambah-beli {
    position: fixed;
    bottom: 160px;
    right: 10px;
    z-index: 999;
  }

  .tambah-beli button {
    display: flex;
    align-items: center;
    border-radius: 20px;
    border: none;
    padding: 8px;
    background-color: orange;
  }
</style>
