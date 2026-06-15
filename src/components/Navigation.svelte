<script>
  // Import page store bawaan SvelteKit (BUKAN lib/stores buatan sendiri)
  import { page } from "$app/stores";
  import {
    Banknote,
    BanknoteArrowDown,
    HandCoins,
    House,
    PackagePlus,
    ShoppingCart,
    Truck,
  } from "lucide-svelte";

  const menus = [
    { name: "Home", path: "/", icon: House },
    // { name: 'Pemasok', path: '/sellers', icon: Truck},
    { name: "Beli", path: "/beli", icon: ShoppingCart },
    { name: "Terima", path: "/terima", icon: BanknoteArrowDown },
    { name: "DP/Panjar", path: "/panjar", icon: HandCoins },
    // { name: "Utang", path: "/utang", icon: Banknote },
    // { name: "Items", path: "/item", icon: PackagePlus },
  ];

  // Fungsi helper untuk cek apakah link sedang aktif
  $: isActive = (path) => {
    if (path === "/" && $page.url.pathname === "/") return true;
    if (path !== "/" && $page.url.pathname.startsWith(path)) return true;
    return false;
  };
</script>

<div class="container">
  <nav class="nav-menu">
    {#each menus as menu}
      <a href={menu.path} class="nav-item" class:selected={isActive(menu.path)}>
        {#if menu.icon}
          <svelte:component
            this={menu.icon}
            size={24}
            color={isActive(menu.path) ? "#3b82f6" : "#666"}
            strokeWidth={2}
          />
        {/if}
        <span>{menu.name}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  .container {
    width: 100%;
    background: white;
    border-top: 1px solid #eee;
    /* z-index: 100; */
  }

  .nav-menu {
    display: flex;
    justify-content: space-around;
    padding: 8px 0;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-decoration: none; /* Menghapus garis bawah link */
    color: #666;
    font-size: 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    flex: 1;
  }

  .nav-item.selected {
    color: #3b82f6;
    font-weight: bold;
  }
</style>
