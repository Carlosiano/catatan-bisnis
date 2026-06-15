<script>
  let amount = 0;
  let debts = [];

  function addDebt() {
    debts = [...debts, {
      id: crypto.randomUUID(),
      amount,
      status: 'belum_lunas'
    }];
  }
</script>

<h3>Utang</h3>

<input type="number" bind:value={amount} />
<button on:click={addDebt}>Tambah</button>

<ul>
  {#each debts as d}
    <li>
      Rp {d.amount} - {d.status}
    </li>
  {/each}
</ul>