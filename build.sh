#!/usr/bin/env bash
set -eu

# Warna terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 Memulai pengecekan dependensi...${NC}"

# 1. Pengecekan di folder CUSTOM PLUGIN (barcode-scanner)
PLUGIN_DIR="./barcode-scanner"

if [ -d "$PLUGIN_DIR" ]; then
    echo -e "${YELLOW}📦 Mengecek plugin: $PLUGIN_DIR${NC}"
    
    # Jalankan bun install jika node_modules plugin tidak ada
    if [ ! -d "$PLUGIN_DIR/node_modules" ]; then
        echo "   -> node_modules plugin tidak ditemukan. Menjalankan bun install..."
        (cd "$PLUGIN_DIR" && bun install)
    fi

    # Selalu jalankan build plugin agar file api-iife.js terbaru tersedia
    echo "   -> Membangun (build) plugin..."
    (cd "$PLUGIN_DIR" && bun run build)
else
    echo -e "${YELLOW}⚠️ Folder plugin $PLUGIN_DIR tidak ditemukan. Skip.${NC}"
fi

# 2. Pengecekan di ROOT PROJECT
echo -e "${YELLOW}📦 Mengecek project utama...${NC}"
if [ ! -d "node_modules" ]; then
    echo "   -> node_modules root tidak ditemukan. Menjalankan bun install..."
    bun install
fi

# 3. Proses Build Android
echo -e "${BLUE}🚀 Memulai Build Tauri Android (ARM64)...${NC}"
cargo tauri android build --target aarch64 --config ./src-tauri/tauri.conf.release.json

# 4. Verifikasi Hasil
APK_PATH="src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk"

if [ -f "$APK_PATH" ]; then
    echo -e "${GREEN}✅ APK Berhasil dibuat!${NC}"
    echo -e "${BLUE}🕒 Selesai pada:${NC} $(date +'%H:%M:%S')"
else
    echo -e "${RED}❌ Build selesai tapi APK tidak ditemukan.${NC}"
    exit 1
fi
