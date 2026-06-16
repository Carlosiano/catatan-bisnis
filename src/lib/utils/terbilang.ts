export function angkaKeTerbilang(angka: number): string {
  if (isNaN(angka) || angka === undefined || angka === null || angka <= 0) return "";
  
  const kata = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";

  if (angka < 12) {
    hasil = kata[angka];
  } else if (angka < 20) {
    hasil = angkaKeTerbilang(angka - 10) + " Belas";
  } else if (angka < 100) {
    hasil = angkaKeTerbilang(Math.floor(angka / 10)) + " Puluh " + angkaKeTerbilang(angka % 10);
  } else if (angka < 200) {
    hasil = "Seratus " + angkaKeTerbilang(angka - 100);
  } else if (angka < 1000) {
    hasil = angkaKeTerbilang(Math.floor(angka / 100)) + " Ratus " + angkaKeTerbilang(angka % 100);
  } else if (angka < 2000) {
    hasil = "Seribu " + angkaKeTerbilang(angka - 1000);
  } else if (angka < 1000000) {
    hasil = angkaKeTerbilang(Math.floor(angka / 1000)) + " Ribu " + angkaKeTerbilang(angka % 1000);
  } else if (angka < 1000000000) {
    hasil = angkaKeTerbilang(Math.floor(angka / 1000000)) + " Juta " + angkaKeTerbilang(angka % 1000000);
  } else if (angka < 1000000000000) {
    hasil = angkaKeTerbilang(Math.floor(angka / 1000000000)) + " Milyar " + angkaKeTerbilang(angka % 1000000000);
  }

  return hasil.replace(/\s+/g, " ").trim();
}