from flask import Flask, request, jsonify
import pandas as pd
import requests
import os
from dotenv import load_dotenv
import urllib.parse
import google.generativeai as genai
import traceback
import datetime

load_dotenv()

app = Flask(__name__)

# Konfigurasi API Gemini
API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

# Konfigurasi API Backend Laravel
LARAVEL_API_URL = "http://127.0.0.1:8000/api/ai-data"
AI_API_KEY = os.environ.get("AI_API_KEY", "")

def fetch_from_laravel(endpoint: str, params: dict = None, is_post: bool = False, json_data: dict = None):
    url = f"{LARAVEL_API_URL}/{endpoint}"
    headers = {"Authorization": f"Bearer {AI_API_KEY}"} if AI_API_KEY else {}
    try:
        if is_post:
            response = requests.post(url, headers=headers, json=json_data)
        else:
            response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error calling {url}: {e}")
        return None

# ==========================================
# 1. DEFINISI FUNGSI/ALAT UNTUK GEMINI
# ==========================================

def get_current_stock(search_item: str = "") -> str:
    """Ambil stok barang. Isi parameter search_item jika user mencari barang spesifik, biarkan kosong untuk semua."""
    try:
        data = fetch_from_laravel("stock")
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
    """Mengambil ringkasan keuangan BERSIH (NET) dalam format Rupiah untuk rentang tanggal tertentu (YYYY-MM-DD). Gunakan JIKA user bertanya seputar PROFIT, PEMASUKAN, PENGELUARAN, LABA, atau ARUS KAS."""
    try:
        data = fetch_from_laravel("financial", {"start_date": start_date, "end_date": end_date})
        if not data:
            return f"Tidak ada catatan dari {start_date} hingga {end_date}."
        
        penjualan_net = float(data.get('penjualan_distributor_net', 0))
        belanja_net = float(data.get('total_belanja_stok_net', 0))
        estimasi_laba = penjualan_net - belanja_net
        margin = round((estimasi_laba / penjualan_net) * 100, 1) if penjualan_net > 0 else 0

        summary = (
            f"Periode: {start_date} s.d {end_date}\n"
            f"Penjualan Distributor (Net, sudah dikurangi retur masuk): Rp {penjualan_net:,.2f}\n"
            f"Total Belanja Stok (Net, sudah dikurangi retur keluar): Rp {belanja_net:,.2f}\n"
            f"  - Pembelian dari Supplier: Rp {float(data.get('pembelian_supplier', 0)):,.2f}\n"
            f"  - Biaya Jasa Makloon: Rp {float(data.get('biaya_makloon', 0)):,.2f}\n"
            f"  - Bahan Baku Makloon: Rp {float(data.get('bahan_baku_makloon', 0)):,.2f}\n"
            f"  - Retur ke Supplier (pengurang): Rp {float(data.get('retur_ke_supplier', 0)):,.2f}\n"
            f"Retur dari Customer (pengurang penjualan): Rp {float(data.get('retur_dari_customer', 0)):,.2f}\n"
            f"Estimasi Laba Penjualan: Rp {estimasi_laba:,.2f}\n"
            f"Margin Laba: {margin}%"
        )
        return summary
    except Exception as e:
        return f"Error API: {e}"

def get_item_mutations(start_date: str, end_date: str) -> str:
    """Mengambil jumlah kuantitas barang masuk dan keluar dalam rentang tanggal (YYYY-MM-DD). Gunakan JIKA ditanya rincian BARANG TERJUAL, BARANG DIBELI, atau PERGERAKAN FISIK."""
    try:
        data = fetch_from_laravel("mutations", {"start_date": start_date, "end_date": end_date})
        if not data:
            return f"Tidak ada pergerakan barang dari {start_date} hingga {end_date}."
        df = pd.DataFrame(data)
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error API: {e}"

def get_database_schema() -> str:
    """Mengambil skema tabel dan kolom. Panggil HANYA JIKA pertanyaan tidak bisa dijawab oleh fungsi stok, keuangan, atau mutasi!"""
    try:
        data = fetch_from_laravel("schema")
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

model = genai.GenerativeModel(
    model_name='gemini-3.6-flash',
    tools=[get_current_stock, get_financial_summary, get_item_mutations, get_database_schema, execute_sql_query],
    system_instruction=system_instruction
)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({"error": "Bad Request: No question provided"}), 400

    question = data['question']
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # Context singkat hemat token
    context_msg = f"Tgl hari ini: {today_str}. Tanya: {question}"
    
    try:
        # Gunakan enable_automatic_function_calling agar Gemini mengeksekusi alat dan merangkai jawaban akhir secara otomatis!
        chat_session = model.start_chat(enable_automatic_function_calling=True)
        response = chat_session.send_message(context_msg)
        answer = response.text
    except Exception as e:
        print("Gemini API Error:")
        traceback.print_exc()
        answer = "Maaf, mesin AI gagal memproses permintaan atau menjalankan fungsi. Pastikan koneksi dan API stabil."
        
    return jsonify({"answer": answer})

if __name__ == '__main__':
    print("AI Chatbot Server (Flask + Gemini Function Calling) mulai berjalan di http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
