<script lang="ts">
  import { getGoogleAuthToken, backupToGoogleDrive, restoreFromGoogleDrive } from "$lib/utils/googleDriveBackup";
  
  let googleToken = $state("");
  let statusSinc = $state("Belum Terhubung");

  async function hubungkanGoogle() {
    try {
      googleToken = await getGoogleAuthToken();
      statusSinc = "Terhubung ke Google Drive";
    } catch (e) {
      statusSinc = "Gagal Terhubung";
    }
  }
</script>

<div class="cloud-section" style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px; margin: 20px auto;">
  <h4 style="margin: 0 0 6px 0; color: #0f172a;">☁️ Backup Cloud Gratis (Google Drive)</h4>
  <p style="font-size: 12.5px; color: #64748b; margin-bottom: 14px;">
    Simpan data secara mandiri dan aman ke akun Google Drive Anda tanpa biaya langganan server.
  </p>

  <div style="background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; font-weight: 600;">
    Status: <span style="color: {googleToken ? '#10b981' : '#ef4444'}">{statusSinc}</span>
  </div>

  {#if !googleToken}
    <button 
      onclick={hubungkanGoogle}
      style="width: 100%; background: #0f172a; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;"
    >
      🔑 Hubungkan Akun Google
    </button>
  {:else}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <button 
        onclick={() => backupToGoogleDrive(googleToken)}
        style="background: #2563eb; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;"
      >
        📤 Cadangkan Sekarang
      </button>

      <button 
        onclick={() => restoreFromGoogleDrive(googleToken)}
        style="background: #ffffff; color: #dc2626; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;"
      >
        📥 Pulihkan Data (Restore)
      </button>
    </div>
  {/if}
</div>