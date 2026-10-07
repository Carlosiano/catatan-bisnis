// src/lib/utils/googleDriveBackup.ts
import { BaseDirectory, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";

// 1. MASUKKAN KREDENSIAL BARU TIPE DESKTOP APP ANDA DI SINI
const CLIENT_ID = "514050760829-1qi0mk0ttugs1o5varlbg9rkc2avab20.apps.googleusercontent.com"; 
const CLIENT_SECRET = "MASUKKAN_CLIENT_SECRET_DESKTOP_ANDA_DI_SINI"; 

// const REDIRECT_URI = "http://localhost:1420/oauth-callback"; 
const REDIRECT_URI = "com.kalo.catatan_bisnis:/oauth2redirect";

export async function hubungkanKeGoogleDrive(onTokenReceived: (token: string) => void) {
  // Mendengarkan deep link untuk menangkap parameter '?code=' dari browser
  await onOpenUrl(async (urls) => {
    for (const url of urls) {
      if (url.startsWith("catatbisnis://")) {
        // Ubah skema kustom menjadi URL standar agar mudah dibaca oleh URLSearchParams
        const cleanUrl = url.replace("catatbisnis://oauth-callback", "http://localhost");
        const urlObj = new URL(cleanUrl);
        const code = urlObj.searchParams.get("code");
        
        if (code) {
          try {
            // Tukarkan 'code' menjadi Access Token resmi via API Google
            const response = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                code: code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code"
              })
            });
            
            const tokenData = await response.json();
            
            if (tokenData.access_token) {
              onTokenReceived(tokenData.access_token);
            } else {
              console.error("Token tidak ditemukan di respon Google:", tokenData);
            }
          } catch (err) {
            console.error("Gagal menukarkan kode OAuth:", err);
          }
        }
      }
    }
  });

  // UBAH: response_type diubah menjadi 'code' (Lolos dari Error 400 Google)
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/drive.appdata`;
  
  await openUrl(authUrl);
}

// 2. Fungsi BACKUP
export async function backupToGoogleDrive(token: string) {
  try {
    const dbName = "catat_barang.db";
    const fileData = await readFile(dbName, { dir: BaseDirectory.AppLocalData });

    const metadata = {
      name: "backup_catat_barang.db",
      parents: ["appDataFolder"]
    };

    const fileBlob = new Blob([fileData], { type: "application/x-sqlite3" });
    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", fileBlob);

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) throw new Error("Gagal mengunggah ke Google Drive");
    alert("☁️ Data pembukuan berhasil dicadangkan ke Google Drive Anda!");
  } catch (error) {
    console.error(error);
    alert("Proses backup gagal.");
  }
}

// 3. Fungsi RESTORE
export async function restoreFromGoogleDrive(token: string) {
  try {
    const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    
    if (!searchData.files || searchData.files.length === 0) {
      return alert("Tidak ditemukan file cadangan di Google Drive Anda.");
    }

    const fileId = searchData.files[0].id;
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const arrayBuffer = await downloadRes.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const dbName = "catat_barang.db";
    await writeFile(dbName, uint8Array, { dir: BaseDirectory.AppLocalData });

    alert("✅ Berhasil memulihkan data! Aplikasi akan dimuat ulang.");
    window.location.reload();
  } catch (error) {
    console.error(error);
    alert("Proses restore gagal.");
  }
}