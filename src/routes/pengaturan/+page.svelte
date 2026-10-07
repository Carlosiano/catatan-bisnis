<script lang="ts">
  import { hubungkanKeGoogleDrive, backupToGoogleDrive, restoreFromGoogleDrive } from "$lib/utils/googleDriveBackup";
  
  let googleToken = $state("");
  let statusSinc = $state("Belum Terhubung");

  async function prosesHubungkan() {
    statusSinc = "Membuka browser login...";
    try {
      // Jalankan fungsi dan tunggu umpan balik token otomatis lewat parameter callback
      await hubungkanKeGoogleDrive((token_didapat) => {
        googleToken = token_didapat;
        statusSinc = "✅ Terhubung Otomatis ke Google Drive";
      });
    } catch (e) {
      statusSinc = "❌ Gagal Terhubung";
    }
  }
</script>

<div class="cloud-section" style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px; margin: 20px auto;">
  <h4 style="margin: 0 0 6px 0;">☁️ Backup Cloud Gratis Otomatis</h4>
  
  <div style="background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; font-weight: 600;">
    Status: <span>{statusSinc}</span>
  </div>

  {#if !googleToken}
    <button onclick={prosesHubungkan} style="width: 100%; background: #4f46e5; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">
      🔗 Sinkronisasi Akun Google Otomatis
    </button>
  {:else}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <button onclick={() => backupToGoogleDrive(googleToken)} style="background: #2563eb; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">
        📤 Cadangkan Sekarang
      </button>

      <button onclick={() => restoreFromGoogleDrive(googleToken)} style="background: #ffffff; color: #dc2626; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">
        📥 Pulihkan Data
      </button>
    </div>
  {/if}
</div>