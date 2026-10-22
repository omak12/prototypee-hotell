# Blue Sky Hotel – Prototipe Web

Prototipe aplikasi mobile **Blue Sky Hotel** (reservasi kamar, mode Tamu & Admin) versi web. Dibuat dengan HTML, CSS, dan JavaScript murni, tanpa framework dan tanpa build step.

## Fitur

**Mode Tamu:** Login → Katalog kamar (cari + tanggal) → Komparasi → Formulir Reservasi (validasi, total otomatis) → Status & E-Voucher (QR code, cetak).

**Mode Admin:** Dashboard (okupansi, pendapatan, pending) → Daftar Reservasi (filter) → Ubah Status (Terkonfirmasi / Checked-In / Checked-Out / Batal) → Kelola Data Kamar (tambah, edit, maintenance, nonaktifkan).

Login demo: isi email & kata sandi apa saja, lalu pilih tab **Tamu** atau **Admin**.

> Data tersimpan di `localStorage` browser (tanpa backend). Untuk reset, jalankan `localStorage.clear()` di console. QR code memakai library dari CDN, jadi butuh internet.

## Struktur

Semua file berada di satu folder (tanpa subfolder):

```
index.html
style.css
app.js
logo.png
favicon.png
standard.jpg
vip.jpg
```

## Jalankan di komputer

Buka `index.html` langsung di browser, atau jalankan server lokal:

```bash
npx serve .
# atau
python3 -m http.server 8000
```

## Upload ke GitHub

```bash
git init
git add .
git commit -m "Blue Sky Hotel prototype web"
git branch -M main
git remote add origin https://github.com/USERNAME/bluesky-hotel.git
git push -u origin main
```

## Deploy ke Vercel

1. Buka https://vercel.com dan masuk dengan akun GitHub.
2. Klik **Add New… → Project**, lalu pilih repositori `bluesky-hotel`.
3. Biarkan **Framework Preset = Other**, kosongkan Build Command dan Output Directory.
4. Klik **Deploy**. Setiap `git push` berikutnya akan otomatis ter-deploy.
