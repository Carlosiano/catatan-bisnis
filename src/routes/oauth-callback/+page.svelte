<script lang="ts">
  import { onMount } from "svelte";

  onMount(() => {
    // Ambil parameter query URL (?code=XXXXXXXX)
    const searchParams = window.location.search;
    
    if (searchParams) {
      // Alihkan peramban menuju deep link kustom internal aplikasi Tauri kita
      const deepLinkUrl = `catatbisnis://oauth-callback${searchParams}`;
      window.location.href = deepLinkUrl;

      // Tutup tab browser otomatis demi kenyamanan petani
      setTimeout(() => {
        window.close();
      }, 1200);
    }
  });
</script>

<div style="text-align: center; font-family: sans-serif; padding-top: 60px; color: #1e293b;">
  <h2 style="color: #10b981;">🔑 Koneksi Berhasil Terbuka!</h2>
  <p style="font-size: 14px; color: #64748b;">Sedang mengamankan token ke aplikasi Catat Bisnis Anda...</p>
  <div style="margin: 20px auto; width: 30px; height: 30px; border: 3px solid #e2e8f0; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite;"></div>
</div>

<style>
  @keyframes spin { to { transform: rotate(360deg); } }
</style>