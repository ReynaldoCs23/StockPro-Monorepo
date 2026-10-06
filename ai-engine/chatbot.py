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
LARAVEL_API_URL = os.environ.get("LARAVEL_API_URL", "http://127.0.0.1:8001/api/ai-data")
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
            f"  - {p['name']}: penjualan Rp {float(p['revenue']):,.0f}, HPP Rp {float(p['cogs']):,.0f}, laba Rp {float(p['profit']):,.0f}"
            for p in data.get('laba_per_produk', [])
        ) or "  (tidak ada penjualan)"

        summary = (
            f"Periode: {start_date} s.d {end_date}\n"
            f"[LABA - angka resmi, sama dengan Dashboard]\n"
            f"Penjualan Bersih (DPP, tanpa PPN): Rp {f('penjualan_dpp'):,.0f}\n"
            f"HPP Barang Terjual (FIFO): Rp {f('hpp_terjual'):,.0f}\n"
            f"LABA BERSIH: Rp {f('laba_bersih'):,.0f}\n"
            f"Margin Laba: {f('margin_persen')}%\n"
            f"Laba per produk:\n{produk}\n"
            f"[ARUS KAS - termasuk PPN, BUKAN laba]\n"
            f"Penjualan Distributor (net retur): Rp {f('penjualan_distributor_net'):,.0f}\n"
            f"Total Belanja Stok (net retur): Rp {f('total_belanja_stok_net'):,.0f}\n"
            f"  - Pembelian Supplier: Rp {f('pembelian_supplier'):,.0f}\n"
            f"  - Biaya Jasa Makloon: Rp {f('biaya_makloon'):,.0f}\n"
            f"  - Bahan Baku Makloon: Rp {f('bahan_baku_makloon'):,.0f}\n"
            f"  - Retur ke Supplier: Rp {f('retur_ke_supplier'):,.0f}\n"
            f"Retur dari Customer: Rp {f('retur_dari_customer'):,.0f}"
        )
        return summary
    except Exception as e:
        return f"Error API: {e}"

def get_item_mutations(start_date: str, end_date: str, search_item: str = "") -> str:
    """Mengambil riwayat mutasi barang masuk/keluar/retur/makloon (maksimal 50 barang teratas) untuk rentang tanggal (YYYY-MM-DD). Isi search_item HANYA JIKA user mencari mutasi barang spesifik."""
    try:
        data = fetch_from_laravel("mutations", {"start_date": start_date, "end_date": end_date, "search_item": search_item})
        if data is None:
            return "ERROR: Gagal mengambil data dari server. Sampaikan ke user bahwa data tidak dapat diakses saat ini (JANGAN bilang datanya kosong)."
        if not data:
            return f"Tidak ada mutasi dari {start_date} hingga {end_date}."
        df = pd.DataFrame(data)
        return df.to_csv(index=False)
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

PANDUAN MEMBERIKAN INSIGHT (PENTING!):
- Jangan hanya membacakan ulang data mentah (angka/tabel). 
- Selalu berikan **Business Insight** atau analisis lanjutan dari data yang Anda temukan berdasarkan konteks bisnis distribusi PT Mara Jaya Dewi Sakti.
- Contoh: Jika ada barang yang sering keluar, sebutkan barang tersebut sebagai "Best Seller" dan rekomendasikan restock.
- Contoh: Jika melihat tren pengeluaran membengkak, berikan peringatan atau opini ringkas.
- Hubungkan titik-titik data untuk membentuk narasi yang berguna bagi pemilik bisnis.

ATURAN FORMATTING:
- Gunakan bahasa Indonesia yang profesional, ringkas, namun berwawasan.
- Gunakan poin-poin (bullet points) agar mudah dibaca.
- JANGAN gunakan format matematika LaTeX ($ atau \frac). 
- JANGAN pernah menampilkan query SQL kepada pengguna.
"""

TOOLS = [get_current_stock, get_financial_summary, get_item_mutations, get_database_schema, execute_sql_query]

def build_config(model_name: str) -> types.GenerateContentConfig:
    cfg = dict(
        system_instruction=system_instruction,
        tools=TOOLS,  # SDK baru otomatis menjalankan fungsi Python (automatic function calling)
        automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=5),
        temperature=0.3,
        max_output_tokens=2048,
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
        
    return jsonify({"answer": answer})

if __name__ == '__main__':
    print(f"AI Chatbot Server (Flask + Gemini {GEMINI_MODEL}) mulai berjalan di http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
