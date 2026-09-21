# StockPro ERP - Sistem Manajemen Inventaris Cerdas

## Deskripsi Aplikasi (Application Detail)
**StockPro ERP** adalah sistem *Enterprise Resource Planning* dan manajemen inventaris berbasis web berskala penuh (*Full-Stack*) yang dirancang khusus untuk memenuhi kebutuhan operasional **PT Mara Jaya Dewi Sakti**. Aplikasi ini hadir dengan arsitektur *Monorepo* yang modern, menggabungkan ketangguhan **Laravel** di sisi *backend*, kecepatan dan reaktivitas **React + Vite** di sisi *frontend*, serta kecerdasan buatan (*Artificial Intelligence*) menggunakan **Google Gemini API + Python** sebagai otak analitik.

StockPro mengotomatisasi dan menyederhanakan alur kerja pergudangan yang rumit, mencakup pencatatan siklus barang (masuk, keluar, return, penyesuaian stok), produksi pihak ketiga (Makloon / *Bill of Materials*), hingga manajemen akses multi-role (Superadmin, Admin, Karyawan, Guest). Selain itu, sistem ini menonjol berkat kehadiran **AI Chatbot (SQL Agent)** dan **AI Forecasting** yang mampu mengubah data mentah menjadi wawasan bisnis (*business insights*) untuk mencegah kehabisan stok (*stockout*) dan mempermudah operasional harian.

## Fitur-Fitur Utama (Key Features)
1. **Manajemen Inventaris *Real-time***: Lacak pergerakan fisik stok barang secara presisi (Barang Masuk, Barang Keluar, Return, Penyesuaian Stok).
2. **AI Assistant (Chatbot SQL Agent)**: Asisten pintar berbasis bahasa natural yang mampu melakukan kueri SQL otomatis secara dinamis untuk menjawab pertanyaan rumit seputar database (misal: mencari supplier terlambat, menghitung total data, dll).
3. **AI Stock Forecasting**: Fitur peramalan berbasis mesin algoritma analitik untuk memprediksi kebutuhan stok di bulan-bulan berikutnya berdasarkan histori pergerakan barang (mencegah *dead-stock*).
4. **Modul Makloon (Subcontracting)**: Sistem komprehensif untuk melacak pengiriman bahan baku ke pabrik pihak ketiga dan penerimaan produk jadi berdasarkan resep BOM (*Bill of Materials*).
5. **Role-Based Access Control (RBAC)**: Pengaturan hak akses (Permissions) granular dan dinamis. Admin bisa mengunci atau membuka fitur tertentu secara spesifik (termasuk akses modul AI) per pengguna.
6. **Laporan & Export**: Cetak laporan PDF dengan *template* profesional perusahaan atau unduh data mutasi ke format CSV.
7. **Notifikasi *Real-Time***: Sistem peringatan *live* yang digerakkan oleh Laravel Reverb (WebSockets) untuk segera memberi notifikasi ketika stok mencapai batas minimum (*Low Stock Alert*).

## Minimum Requirements (Prasyarat Sistem Minimum)
Karena sistem ini terdiri dari 3 blok mesin (*engine*) yang berjalan bersamaan (Frontend, Backend, AI), pastikan *server* atau laptop Anda memenuhi spesifikasi berikut:
- **Sistem Operasi**: Windows 10/11, Linux (Ubuntu/Debian), atau macOS.
- **RAM**: Minimal 4 GB (Sangat disarankan 8 GB untuk kelancaran eksekusi Node.js & komputasi Python secara bersamaan).
- **Backend (PHP)**: 
  - PHP Versi 8.3 atau lebih baru.
  - Composer (Manajer dependensi PHP).
  - MySQL / MariaDB (Sangat disarankan).
- **Frontend (Node.js)**:
  - Node.js versi v18.x atau lebih tinggi.
  - NPM atau Yarn.
- **AI Engine (Python)**:
  - Python versi 3.10 atau lebih tinggi.
  - PIP (Manajer dependensi modul Python).
  - Koneksi Internet aktif (Wajib untuk menghubungi *cloud endpoint* Google Gemini API).

## Panduan Instalasi Menyeluruh (Full Installation Guide)

### 1. Setup Backend (Laravel)
Buka terminal dan arahkan ke folder `backend`:
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
```

### 2. Setup Frontend (React / Vite)
Buka terminal baru dan arahkan ke folder `frontend`:
```bash
cd frontend
npm install
```

### 3. Setup AI Engine (Python)
Buka terminal baru dan arahkan ke folder `ai-engine`:
```bash
cd ai-engine
python -m venv venv
venv\Scripts\activate      # Gunakan perintah ini khusus untuk Windows
pip install -r requirements.txt
```

### 4. Menjalankan Aplikasi (Running the Services)
Untuk menjalankan StockPro secara utuh saat tahap pengembangan, Anda perlu membiarkan **5 perintah berikut berjalan bersamaan** di tab terminal yang terpisah:
- **Terminal 1 (Backend API)**: `cd backend` lalu ketik `php artisan serve`
- **Terminal 2 (Frontend UI)**: `cd frontend` lalu ketik `npm run dev`
- **Terminal 3 (WebSockets)**: `cd backend` lalu ketik `php artisan reverb:start --port=8090`
- **Terminal 4 (Queue Worker)**: `cd backend` lalu ketik `php artisan queue:listen`
- **Terminal 5 (AI Engine)**: `cd ai-engine` lalu ketik `python chatbot.py`

*(Akses UI aplikasi melalui URL `http://localhost:5173` yang muncul di terminal Frontend).*

## Batasan Sistem (System Limitations)
Harap perhatikan beberapa batasan yang ada pada versi saat ini:
1. **Kecepatan Respons AI**: Karena Chatbot kini menggunakan arsitektur *SQL Agent*, AI membutuhkan waktu berpikir ekstra sekitar **3 hingga 5 detik** untuk merumuskan bahasa SQL, mengeksekusinya ke database Anda, lalu merangkai jawaban akhir.
2. **Ketergantungan Internet**: Modul AI tidak bisa berjalan secara *offline*. Meskipun database berada di *localhost*, engine Python memerlukan koneksi internet untuk memanggil Gemini API.
3. **Limitasi Akses Database oleh AI (Keamanan)**: Demi alasan keamanan data (*security guardrail*), AI hanya diizinkan secara ketat untuk melakukan perintah baca data (`SELECT`, `SHOW`, atau `DESCRIBE`). AI tidak memiliki hak (*blocked*) untuk menambah, mengubah, atau menghapus tabel inventaris Anda.
4. **Mata Uang Tunggal**: Saat ini seluruh valuasi stok dan metrik finansial dirancang hanya untuk menampung satu mata uang dasar, yaitu Rupiah (IDR).

## Kontributor & Lisensi
**Contributors:** 
- **Reynaldo Christianto Sarungallo** – Primary Full-Stack Engineer and System Architect

**License: Proprietary Software / Closed Source**
Semua kode, logika bisnis, dan arsitektur dalam repositori ini adalah milik eksklusif **PT Mara Jaya Dewi Sakti** dan ditujukan khusus untuk keperluan operasional internal perusahaan. Dilarang mendistribusikan, menyalin, mengubah, atau memperjualbelikan kode ini tanpa izin tertulis yang sah dari perwakilan hukum PT Mara Jaya Dewi Sakti.
