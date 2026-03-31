<script>
  import { onMount } from "svelte";
  import { getDB, insert } from "$lib/api";

  let items = [];
  let units = [];

  let itemName = "";
  let unitName = "";

  async function load() {
    const db = await getDB();
    items = db.items || [];
    units = db.units || [];
  }

  async function addItem() {
    if (!itemName) return;

    await insert("items", {
      id: crypto.randomUUID(),
      name: itemName.toLowerCase(),
      defaultUnitId: "",
    });

    itemName = "";
    load();
  }

  async function addUnit() {
    if (!unitName) return;

    await insert("units", {
      id: crypto.randomUUID(),
      name: unitName.toLowerCase(),
    });

    unitName = "";
    load();
  }

  async function deleteItem(id) {
    if (!confirm("Hapus barang ini?")) return;

    await fetch("http://localhost:3000/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "items", id }),
    });

    load();
  }
  async function deleteUnit(id) {
    if (!confirm("Hapus satuan ini?")) return;

    await fetch("http://localhost:3000/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "units", id }),
    });

    load();
  }

  async function setDefault(itemId, unitId) {
    try {
      const db = await getDB();

      db.items = db.items.map((i) => {
        if (i.id === itemId) {
          i.defaultUnitId = unitId;
        }
        return i;
      });

      const response = await fetch("http://localhost:3000/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(db),
      });

      if (response.ok) {
        load(); // Muat ulang data setelah berhasil simpan
      } else {
        console.error("Gagal menyimpan data");
      }
    } catch (error) {
      console.error("Terjadi kesalahan koneksi:", error);
    }
  }

  function getUnitName(id) {
    return units.find((u) => u.id === id)?.name || "-";
  }

  onMount(load);
</script>

<h3>Master Barang & Satuan</h3>

<!-- 🔥 TAMBAH BARANG -->
<h4>Tambah Barang</h4>
<input bind:value={itemName} placeholder="Nama barang (kopra)" />
<button on:click={addItem}>Tambah Barang</button>

<!-- 🔥 TAMBAH SATUAN -->
<h4>Tambah Satuan</h4>
<input bind:value={unitName} placeholder="Satuan (kg, subur)" />
<button on:click={addUnit}>Tambah Satuan</button>

<hr />

<!-- 🔥 LIST -->
<table border="1" cellpadding="6" style="width: 100%; text-align: left;">
  <thead>
    <tr>
      <th>Barang</th>
      <th>Default Satuan</th>
      <th>Set Default</th>
      <th>Aksi</th>
    </tr>
  </thead>
  <tbody>
    {#each items as item}
      <tr>
        <td>{item.name}</td>
        <td>{getUnitName(item.defaultUnitId)}</td>
        <td>
          <select on:change={(e) => setDefault(item.id, e.target.value)}>
            <option value="">Pilih</option>
            {#each units as u}
              <option value={u.id} selected={item.defaultUnitId === u.id}>{u.name}</option>
            {/each}
          </select>
        </td>
        <td>
          <button on:click={() => deleteItem(item.id)} style="color: red;">Hapus</button>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<h4>Daftar Satuan</h4>
<ul>
  {#each units as u}
    <li>
      {u.name} 
      <button on:click={() => deleteUnit(u.id)} style="color: red; margin-left: 10px;">x</button>
    </li>
  {/each}
</ul>