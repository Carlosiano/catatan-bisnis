<script>
  //   let { children } = $props();
  import Header from "$components/Header.svelte";
  import Navigation from "$components/Navigation.svelte";
  import { onMount } from "svelte";
  import "../app.css";

  onMount(() => {
    window.addEventListener("online", async () => {
      console.log("Internet terhubung! Memulai sinkronisasi...");
      await processSyncQueue();
    });
  });

  async function processSyncQueue() {
    const db = await Database.load("sqlite:pembelian.db");
    const queue = await db.select("SELECT * FROM sync_queue");

    for (const item of queue) {
      try {
        // Kirim ke API PocketBase/Supabase Anda
        // await sendToPocketBase(JSON.parse(item.payload));

        // Jika sukses, hapus dari antrean lokal
        await db.execute("DELETE FROM sync_queue WHERE id = $1", [item.id]);
      } catch (err) {
        break; // Berhenti jika gagal (mungkin internet putus lagi)
      }
    }
  }
</script>

<div class="app">
  <!-- <Header /> -->
   <div class="notif"></div>

  <div class="main">
    <slot />
  </div>

  <Navigation />
  <div class="android-nav"></div>
</div>

<!-- {@render children?.()} -->

<svelte:head>
  <style>
    body {
      width: 100%;
      /* width: 384px; */
      height: 100vh;
      /* height: 853px; */
      margin: 0;
      padding: 0;
      /* overflow: hidden; */
      user-select: none;
      /* background-color: yellow; */
      font-family: Roboto;
      box-sizing: border-box;
    }
    a,
    img {
      -webkit-user-drag: none;
      -khtml-user-drag: none;
      -moz-user-drag: none;
      -o-user-drag: none;
      user-drag: none;

      user-select: none; /* opsional: agar teksnya juga tidak bisa diseleksi */
    }
    /* Hilangkan efek klik dan drag */
    * {
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    :focus {
      outline: none;
    }

    a,
    img {
      -webkit-user-drag: none;
      user-drag: none;
    }
  </style>
</svelte:head>

<style>
  .app {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    flex-direction: column;
    position: relative;
  }

  .main {
    flex: 1;
    /* padding: 16px; */
    background: #f5f5f5;
    /* background: red; */
    /* height: 100%; */
    overflow: auto;
    position: relative;
    /* overflow: hidden; */
  }

  .notif {
    height: 33px;
    /* background-color: black; */
  }

  .android-nav {
    height: 38px;
    background-color: black;
  }

  .tambah-beli {
    position: fixed;
    bottom: 60px;
    right: 10px;
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
