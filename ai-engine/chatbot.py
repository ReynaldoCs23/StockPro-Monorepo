from flask import Flask, request, jsonify
import pandas as pd
import requests
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
import traceback
import datetime

load_dotenv()

app = Flask(__name__)

# Konfigurasi API Gemini (SDK baru: google-genai)
API_KEY = os.environ.get("GEMINI_API_KEY")
# Model versi tetap (1.5 / 2.5) sudah dipensiunkan Google -> pakai alias "-latest"
# yang otomatis mengikuti versi Flash terbaru. Bisa diganti lewat .env (GEMINI_MODEL).
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
# Model cadangan jika model utama error/overload
GEMINI_FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest")
client = genai.Client(api_key=API_KEY)

# Konfigurasi API Backend Laravel
# PENTING: pakai port 8001 (server Laravel terpisah). `php artisan serve` di Windows hanya
# single-thread; jika AI memanggil balik port 8000 yang sedang menunggu jawaban AI -> deadlock.
# Host/IP backend Laravel diambil dari .env (API_TARGET_URL) agar tidak bentrok antara lokal & VPS.
# LARAVEL_API_URL tetap bisa diisi penuh di .env untuk override seluruh URL.
API_TARGET_URL = os.getenv('API_TARGET_URL', '127.0.0.1')
LARAVEL_API_PORT = os.getenv('LARAVEL_API_PORT', '8001')
LARAVEL_API_URL = os.getenv("LARAVEL_API_URL", f"http://{API_TARGET_URL}:{LARAVEL_API_PORT}/api/ai-data")
AI_API_KEY = os.environ.get("AI_API_KEY", "")

# Reuse koneksi TCP (keep-alive) agar setiap tool call lebih cepat
http = requests.Session()
if AI_API_KEY:
    http.headers.update({"Authorization": f"Bearer {AI_API_KEY}"})

# Cache sederhana in-memory (TTL detik) untuk data yang sering diminta
_cache = {}
CACHE_TTL = 30

def fetch_from_laravel(endpoint: str, params: dict = None, is_post: bool = False, json_data: dict = None, use_cache: bool = False):
    url = f"{LARAVEL_API_URL}/{endpoint}"
    cache_key = (endpoint, tuple(sorted((params or {}).items())))
    if use_cache and cache_key in _cache and time.time() - _cache[cache_key][0] < CACHE_TTL:
        return _cache[cache_key][1]
    try:
        if is_post:
            response = http.post(url, json=json_data, timeout=30)
        else:
            response = http.get(url, params=params, timeout=30)
        response.raise_for_status()
        result = response.json()
        if use_cache:
            _cache[cache_key] = (time.time(), result)
        return result
    except Exception as e:
        print(f"Error calling {url}: {e}")
        return None

# ==========================================
# 1. DEFINISI FUNGSI/ALAT UNTUK GEMINI
# ==========================================

def get_current_stock(search_item: str = "") -> str:
    """Ambil stok barang. Isi parameter search_item jika user mencari barang spesifik, biarkan kosong untuk semua."""
    try:
        data = fetch_from_laravel("stock", use_cache=True)
        if data is None:
            return "ERROR: Gagal mengambil data dari server. Sampaikan ke user bahwa data tidak dapat diakses saat ini (JANGAN bilang stok kosong)."
        if not data:
            return "Stok kosong/tidak ditemukan atau error API."
        df = pd.DataFrame(data)
        if search_item:
            df = df[df['nama'].str.contains(search_item, case=False, na=False)]
            if df.empty:
                return "Stok kosong/tidak ditemukan."
        return df.head(30).to_csv(index=False)
    except Exception as e:
        return f"Err API: {e}"

def get_financial_summary(start_date: str, end_date: str) -> str:
    """Mengambil ringkasan keuangan (laba bersih, margin, penjualan, belanja stok, retur, laba per produk) untuk rentang tanggal (YYYY-MM-DD). Gunakan JIKA user bertanya seputar PROFIT, LABA, MARGIN, PEMASUKAN, PENGELUARAN, KEUANGAN, atau ARUS KAS."""
    try:
        data = fetch_from_laravel("financial", {"start_date": start_date, "end_date": end_date})
        if data is None:
            return "ERROR: Gagal mengambil data dari server. Sampaikan ke user bahwa data tidak dapat diakses saat ini (JANGAN bilang datanya kosong)."

        f = lambda k: float(data.get(k, 0) or 0)
        produk = "\n".join(
            f"  - {p['name']}: penjualan {fmt_rp(float(p['revenue']))}, HPP {fmt_rp(float(p['cogs']))}, laba {fmt_rp(float(p['profit']))}"
            for p in data.get('laba_per_produk', [])
        ) or "  (tidak ada penjualan)"

        summary = (
            f"Periode: {start_date} s.d {end_date}\n"
            f"[LABA - angka resmi, sama dengan Dashboard]\n"
            f"Penjualan Bersih (DPP, tanpa PPN): {fmt_rp(f('penjualan_dpp'))}\n"
            f"HPP Barang Terjual (FIFO): {fmt_rp(f('hpp_terjual'))}\n"
            f"LABA BERSIH: {fmt_rp(f('laba_bersih'))}\n"
            f"Margin Laba: {f('margin_persen')}%\n"
            f"Laba per produk:\n{produk}\n"
            f"[ARUS KAS - termasuk PPN, BUKAN laba]\n"
            f"Penjualan Distributor (net retur): {fmt_rp(f('penjualan_distributor_net'))}\n"
            f"Total Belanja Stok (net retur): {fmt_rp(f('total_belanja_stok_net'))}\n"
            f"  - Pembelian Supplier: {fmt_rp(f('pembelian_supplier'))}\n"
            f"  - Biaya Jasa Makloon: {fmt_rp(f('biaya_makloon'))}\n"
            f"  - Bahan Baku Makloon: {fmt_rp(f('bahan_baku_makloon'))}\n"
            f"  - Retur ke Supplier: {fmt_rp(f('retur_ke_supplier'))}\n"
            f"Retur dari Customer: {fmt_rp(f('retur_dari_customer'))}"
        )
        return summary
    except Exception as e:
        return f"Error API: {e}"

def fmt_id(n) -> str:
    """Format angka gaya Indonesia: 68403 -> 68.403 (bilangan bulat), desimal pakai koma."""
    try:
        x = float(n)
    except (TypeError, ValueError):
        return str(n)
    if x.is_integer():
        return f"{int(x):,}".replace(",", ".")
    return f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def fmt_rp(n) -> str:
    """Rupiah gaya faktur, selalu 2 desimal: 87918258 -> "Rp 87.918.258,00"; negatif -> "-Rp 33.768.851,00"."""
    try:
        x = float(n or 0)
    except (TypeError, ValueError):
        return f"Rp {n}"
    s = f"{abs(x):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-Rp {s}" if x < 0 else f"Rp {s}"

def get_item_mutations(start_date: str, end_date: str, search_item: str = "") -> str:
    """Mengambil mutasi barang masuk/keluar/retur per barang untuk rentang tanggal (YYYY-MM-DD), dihitung dengan modul Laporan Mutasi (angka identik). Berisi SEMUA barang (termasuk dari transaksi multi-item), satuan dasar, jenis (Barang Fisik / Jasa/Non-Stok), info konversi box, serta ringkasan total & nilai Rp. Isi search_item HANYA JIKA user mencari barang spesifik."""
    try:
        data = fetch_from_laravel("mutations", {"start_date": start_date, "end_date": end_date, "search_item": search_item})
        if data is None:
            return "ERROR: Gagal mengambil data dari server. Sampaikan ke user bahwa data tidak dapat diakses saat ini (JANGAN bilang datanya kosong)."
        barang = data.get("per_barang", []) if isinstance(data, dict) else []
        r = data.get("ringkasan", {}) if isinstance(data, dict) else {}
        if not barang:
            return f"Tidak ada mutasi dari {start_date} hingga {end_date}."

        m, k, rt = r.get("masuk", {}), r.get("keluar", {}), r.get("retur", {})
        lines = [
            f"SUMBER: {data.get('sumber')} | Periode {data['periode']['start']} s.d {data['periode']['end']}",
            "[RINGKASAN TOTAL - wajib sama dengan Laporan Mutasi]",
            f"Masuk: {fmt_id(m.get('transaksi'))} transaksi, {fmt_id(m.get('qty_barang_fisik'))} unit barang fisik (lintas satuan), nilai {fmt_rp(m.get('nilai_rp'))}",
            f"Keluar: {fmt_id(k.get('transaksi'))} transaksi, {fmt_id(k.get('qty_barang_fisik'))} unit barang fisik + {fmt_id(k.get('qty_jasa'))} unit jasa (non-stok), nilai {fmt_rp(k.get('nilai_rp'))}",
            f"Retur: {fmt_id(rt.get('kasus'))} kasus, {fmt_id(rt.get('qty'))} unit, nilai {fmt_rp(rt.get('nilai_rp'))}",
            f"Catatan: {r.get('catatan')}",
        ]
        rk = data.get("rekonsiliasi") or {}
        ps, pj, pk = rk.get("persediaan", {}), rk.get("penjualan", {}), rk.get("pajak", {})
        if ps:
            lines += [
                "[REKONSILIASI - pakai angka ini untuk analisis nilai; JANGAN mengurangkan nilai faktur keluar dari nilai faktur masuk]",
                f"Persediaan (tanpa PPN, buku batch FIFO): saldo awal {fmt_rp(ps.get('saldo_awal'))}, masuk {fmt_rp(ps.get('total_masuk'))}, keluar {fmt_rp(ps.get('total_keluar'))}, saldo akhir {fmt_rp(ps.get('saldo_akhir'))}, perubahan {fmt_rp(ps.get('perubahan'))}",
                f"  rincian masuk: " + ", ".join(f"{k} {fmt_rp(v)}" for k, v in (ps.get('masuk') or {}).items() if float(v or 0) != 0),
                f"  rincian keluar: " + ", ".join(f"{k} {fmt_rp(v)}" for k, v in (ps.get('keluar') or {}).items() if float(v or 0) != 0),
                f"Penjualan barang {fmt_rp(pj.get('penjualan_barang'))}, retur penjualan {fmt_rp(pj.get('retur_penjualan'))}, HPP bersih {fmt_rp(pj.get('hpp_bersih'))}, laba kotor barang {fmt_rp(pj.get('laba_kotor_barang'))} (margin {pj.get('margin_barang_persen')}%)",
                f"Penjualan jasa {fmt_rp(pj.get('penjualan_jasa'))}; laba kotor total {fmt_rp(pj.get('laba_kotor_total'))} (sama dengan Dashboard)",
                f"PPN keluaran {fmt_rp(pk.get('ppn_keluaran'))}, PPN masukan {fmt_rp(pk.get('ppn_masukan'))}, PPN kurang(+)/lebih(-) bayar {fmt_rp(pk.get('ppn_kurang_bayar'))}",
            ]
            if float(rk.get('selisih_data_batch') or 0) != 0:
                lines.append(f"PERHATIAN: selisih data batch {fmt_rp(rk.get('selisih_data_batch'))} - sebutkan di Catatan Data.")
        if data.get("filter_barang"):
            lines.append(f"(Daftar per barang difilter: '{data['filter_barang']}'; ringkasan total tetap untuk seluruh periode.)")
        lines.append("[PER BARANG - qty dalam satuan dasar; jangan jumlahkan lintas satuan]")
        lines.append("jenis;kode;nama_barang;satuan;masuk;keluar;retur;net;trx_masuk;trx_keluar;trx_retur;konversi")
        for b in barang:
            lines.append(";".join([
                b.get("jenis", ""), b.get("kode_barang", ""), b.get("nama_barang", ""), str(b.get("satuan", "")).lower(),
                fmt_id(b.get("masuk")), fmt_id(b.get("keluar")), fmt_id(b.get("retur")), fmt_id(b.get("net")),
                fmt_id(b.get("trx_masuk")), fmt_id(b.get("trx_keluar")), fmt_id(b.get("trx_retur")), b.get("konversi") or "-",
            ]))
        return "\n".join(lines)
    except Exception as e:
        return f"Error API: {e}"

def get_database_schema() -> str:
    """Mengambil skema tabel dan kolom. Panggil HANYA JIKA pertanyaan tidak bisa dijawab oleh fungsi stok, keuangan, atau mutasi!"""
    try:
        data = fetch_from_laravel("schema", use_cache=True)
        if not data:
            return "Skema kosong."
        df = pd.DataFrame(data)
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error API: {e}"

def execute_sql_query(query: str) -> str:
    """Mengeksekusi query MySQL dinamis (HANYA SELECT). Panggil setelah Anda mendapat skema, dan HANYA JIKA fungsi stok/keuangan/mutasi tidak bisa digunakan."""
    safe_query = query.strip().upper()
    if not (safe_query.startswith("SELECT") or safe_query.startswith("SHOW") or safe_query.startswith("DESCRIBE")):
         return "Error: Security block! Hanya diperbolehkan perintah SELECT, SHOW, atau DESCRIBE demi keamanan data."
    
    try:
        data = fetch_from_laravel("query", is_post=True, json_data={"query": query})
        if not data:
            return "Query berhasil, tapi hasilnya kosong."
        df = pd.DataFrame(data)
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error eksekusi query: {e}"

# Prompt yang Ditingkatkan untuk Insight Bisnis
system_instruction = """
Anda adalah AI Data & Business Analyst untuk aplikasi StockPro.

KONTEKS PERUSAHAAN:
- **PT Mara Jaya Dewi Sakti** adalah perusahaan swasta di Singaraja, Bali, yang bergerak di bidang teknologi informasi dan manajemen sistem informasi.
  - **Bidang Usaha:** Konsultasi manajemen sistem informasi, pengembangan aplikasi, dan rantai pasok (supply chain management).
  - **Sejarah:** Perusahaan ini didirikan dan aktif sejak tahun 2004.
  - **Kerja Sama:** PT Mara Jaya Dewi Sakti pernah bekerja sama dengan PDAM Buleleng untuk mendirikan dan membentuk perusahaan air minum di Singaraja, Bali.
- **StockPro** adalah aplikasi manajemen stok (Inventory Management System) tingkat lanjut yang digunakan oleh perusahaan untuk melacak barang masuk (dari supplier/makloon), barang keluar (ke distributor/customer), serta retur barang.

STRATEGI UTAMA:
1. Prioritas Alat: Gunakan get_current_stock, get_financial_summary, atau get_item_mutations.
2. JIKA terpaksa, gunakan get_database_schema lalu execute_sql_query.
3. Untuk pertanyaan "mutasi keuangan"/"laporan keuangan", panggil get_financial_summary DAN get_item_mutations.

ATURAN AKURASI (WAJIB):
- Untuk LABA dan MARGIN, gunakan HANYA angka "LABA BERSIH" dan "Margin Laba" dari get_financial_summary (Penjualan DPP - HPP FIFO, sama dengan Dashboard).
- JANGAN PERNAH menghitung laba sendiri dengan cara Penjualan - Belanja Stok. Belanja stok adalah arus kas, bukan biaya barang terjual.
- Tampilkan angka persis seperti yang diberikan alat, jangan dibulatkan atau dikarang.
- Jika alat mengembalikan "ERROR", katakan data gagal diakses, BUKAN data kosong.

AKURASI ANALISIS MUTASI (WAJIB):
- Gunakan HANYA data dari hasil alat/query database. Jangan mengarang angka. Jika data tidak ada atau tidak lengkap, tulis di "Catatan Data".
- Untuk mutasi barang, panggil get_item_mutations. Angkanya dihitung dengan modul "Laporan Mutasi" yang sama; tampilkan total masuk, total keluar, dan nilai persis seperti di bagian RINGKASAN TOTAL. Jika Anda memakai sumber lain (mis. execute_sql_query) dan angkanya berbeda dari ringkasan tersebut, sebutkan perbedaannya di "Catatan Data".
- Barang berjenis "Jasa/Non-Stok" (mis. Jasa SIPEMA ONLINE) BUKAN stok fisik: tampilkan terpisah dari barang fisik, jangan dijumlahkan ke total unit barang, dan jangan menyimpulkan "adopsi", "pemanfaatan", "permintaan", atau "pertumbuhan" dari angka jasa tanpa data pendukung. Cukup laporkan angka dan nilainya.
- Jangan menjumlahkan satuan yang berbeda (galon, unit, pcs, box, karton, laporan) menjadi satu angka. Tampilkan net mutasi per barang beserta satuannya.
- Qty selalu dalam satuan dasar barang. Untuk barang yang dibeli per box, sebutkan konversinya bila relevan (lihat kolom konversi, mis. "dibeli 1.380 box x 12 pcs"). Konversi HANYA berlaku untuk barang pada baris yang kolom konversinya terisi; jangan menempelkannya ke barang lain.
- Sertakan SEMUA barang pada periode tersebut di tabel Ringkasan (termasuk barang dari transaksi dengan banyak produk). Jangan memotong daftar menjadi "item teratas".
- Laporan mutasi hanya mencakup periode berjalan, tidak memuat saldo awal stok; jangan menyimpulkan posisi stok akhir dari angka mutasi saja.

PANDUAN INSIGHT:
- Jangan hanya membacakan ulang data mentah. Berikan insight bisnis yang relevan untuk distribusi PT Mara Jaya Dewi Sakti, misalnya barang dengan perputaran tertinggi, bahan baku yang menumpuk tanpa keluaran, atau ketidakseimbangan masuk-keluar per barang.
- Setiap insight harus didukung angka dari data. Bila hanya dugaan, tandai sebagai dugaan.
- Jangan mengaitkan angka dengan wilayah, pelanggan, atau penyebab yang tidak tercantum di data.
- Nilai rupiah negatif ditulis "-Rp 33.768.851,00" (tanda minus sebelum "Rp").

FORMAT OUTPUT (WAJIB):
- Selalu jawab dalam Bahasa Indonesia dengan markdown yang valid. Jangan gunakan HTML, jangan mengulang pertanyaan user, jangan memakai emoji, jangan memakai LaTeX ($ atau \\frac), jangan menampilkan query SQL.
- Untuk analisis data, gunakan struktur ini:
  1. Satu kalimat pembuka singkat (tanpa heading).
  2. "## Ringkasan" berisi tabel markdown. Untuk mutasi: kolom | Nama Barang | Satuan | Masuk | Keluar | Net |, barang fisik dahulu, lalu jasa/non-stok di tabel terpisah atau baris yang ditandai "(jasa)". Sertakan juga total nilai masuk, keluar, dan saldo dalam Rupiah.
  3. "## Insight Bisnis" berisi poin bernomor.
  4. "## Rekomendasi" berisi poin singkat.
  5. "## Catatan Data" berisi batasan data atau hal yang perlu dicek, dan diakhiri kalimat: "Angka perlu diverifikasi terhadap Laporan Mutasi sebelum dipakai untuk keputusan penting."
- Untuk pertanyaan singkat yang bukan analisis (mis. sapaan, definisi), jawab ringkas tanpa struktur di atas.
- Tabel markdown: baris header, baris separator (| --- | --- |), dan baris data ditulis berurutan TANPA baris kosong di antaranya; setiap baris tabel di baris tersendiri (jangan menyambung dengan "||"). Beri satu baris kosong sebelum dan sesudah tabel. Kolom angka boleh rata kanan (| ---: |).
- Angka memakai format Indonesia: titik sebagai pemisah ribuan (68.403) dan rupiah SELALU dengan dua desimal seperti faktur: "Rp 87.918.258,00" (koma desimal, contoh lain "Rp 720.720,00"). Tulis nilai rupiah persis seperti data alat. Satuan (pcs, unit, box, laporan) ditulis di kolom Satuan tersendiri, bukan digabung dengan angka.
"""

TOOLS = [get_current_stock, get_financial_summary, get_item_mutations, get_database_schema, execute_sql_query]

def build_config(model_name: str) -> types.GenerateContentConfig:
    cfg = dict(
        system_instruction=system_instruction,
        tools=TOOLS,  # SDK baru otomatis menjalankan fungsi Python (automatic function calling)
        automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=5),
        temperature=0.3,
        max_output_tokens=4096,
    )
    # Kurangi "thinking" agar respons jauh lebih cepat & hemat token
    if model_name.startswith("gemini-2.5"):
        cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    else:
        cfg["thinking_config"] = types.ThinkingConfig(thinking_level="low")
    return types.GenerateContentConfig(**cfg)

def ask_gemini(model_name: str, message: str):
    chat_session = client.chats.create(model=model_name, config=build_config(model_name))
    return chat_session.send_message(message)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({"error": "Bad Request: No question provided"}), 400

    question = data['question']
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # Context singkat hemat token
    context_msg = f"Tgl hari ini: {today_str}. Tanya: {question}"
    
    answer = None
    for model_name in dict.fromkeys([GEMINI_MODEL, GEMINI_FALLBACK_MODEL]):
        try:
            started = time.time()
            response = ask_gemini(model_name, context_msg)
            answer = response.text or "Maaf, AI tidak menghasilkan jawaban. Coba perjelas pertanyaan Anda."
            usage = response.usage_metadata
            if usage:
                print(f"[AI] {model_name} | {time.time() - started:.1f}s | tokens in={usage.prompt_token_count} out={usage.candidates_token_count} total={usage.total_token_count}")
            break
        except Exception:
            print(f"Gemini API Error ({model_name}):")
            traceback.print_exc()

    if answer is None:
        answer = "Maaf, mesin AI gagal memproses permintaan atau menjalankan fungsi. Pastikan koneksi dan API stabil."
    # Catatan: dulu ada regex yang menyisipkan baris kosong sebelum SETIAP baris tabel sehingga tabel
    # pecah menjadi paragraf. Normalisasi markdown kini dilakukan di frontend (normalizeAiMarkdown).

    return jsonify({"answer": answer})

if __name__ == '__main__':
    # Host/port bind server Flask diambil dari .env (default sama seperti sebelumnya)
    AI_ENGINE_HOST = os.getenv('AI_ENGINE_HOST', '127.0.0.1')
    AI_ENGINE_PORT = int(os.getenv('AI_ENGINE_PORT', '5000'))
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'true').lower() in ('1', 'true', 'yes')
    print(f"AI Chatbot Server (Flask + Gemini {GEMINI_MODEL}) mulai berjalan di http://{AI_ENGINE_HOST}:{AI_ENGINE_PORT} ...")
    app.run(host=AI_ENGINE_HOST, port=AI_ENGINE_PORT, debug=FLASK_DEBUG)
