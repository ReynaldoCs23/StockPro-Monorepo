from flask import Flask, request, jsonify
import pandas as pd
from sqlalchemy import create_engine
import urllib.parse
import google.generativeai as genai
import traceback
import datetime

app = Flask(__name__)

# Konfigurasi API Gemini
API_KEY = "AQ.Ab8RN6IVDyEYexNH3IxPtJphFQSjwk1KlBjUKXDX_m2BFAIgMQ"
genai.configure(api_key=API_KEY)

# Konfigurasi Database (sama seperti forecaster.py)
password = urllib.parse.quote_plus('*Reynaldo22')
engine = create_engine(f'mysql+pymysql://root:{password}@127.0.0.1:3307/inventory_db')


# ==========================================
# 1. DEFINISI FUNGSI/ALAT UNTUK GEMINI
# ==========================================

def get_current_stock(search_item: str = "") -> str:
    """Ambil stok barang. Isi parameter search_item jika user mencari barang spesifik, biarkan kosong untuk semua."""
    try:
        where_clause = f"WHERE nama LIKE '%{search_item}%'" if search_item else ""
        query = f"SELECT kodeBarang, nama, kategori, stok FROM items {where_clause} LIMIT 30"
        df = pd.read_sql(query, engine)
        if df.empty:
            return "Stok kosong/tidak ditemukan."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Err DB: {e}"

def get_financial_summary(start_date: str, end_date: str) -> str:
    """Mengambil total nilai transaksi (pemasukan dan pengeluaran) dalam format Rupiah untuk rentang tanggal tertentu (YYYY-MM-DD). Gunakan JIKA user bertanya seputar PROFIT, PEMASUKAN, atau PENGELUARAN."""
    try:
        query = f"""
        SELECT 
            CASE 
                WHEN type = 'IN' THEN 'Pengeluaran Uang (Pembelian Stok)'
                WHEN type = 'OUT' THEN 'Pemasukan Uang (Penjualan Distributor)'
                WHEN type = 'MAKLOON_IN' THEN 'Pengeluaran Uang (Biaya Jasa Makloon)'
                WHEN type = 'MAKLOON_OUT' THEN 'Pengeluaran Uang (Bahan Baku Makloon)'
                WHEN type = 'RET' THEN 'Pemasukan Uang (Pengembalian Dana Return)'
                ELSE type 
            END as kategori_keuangan, 
            SUM(totalTransaksi) as total_nilai_rp 
        FROM transactions 
        WHERE DATE(tanggal) BETWEEN '{start_date}' AND '{end_date}' AND status = 'completed' 
        GROUP BY type
        """
        df = pd.read_sql(query, engine)
        if df.empty or df['total_nilai_rp'].isnull().all():
            return f"Tidak ada catatan dari {start_date} hingga {end_date}."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error database: {e}"

def get_item_mutations(start_date: str, end_date: str) -> str:
    """Mengambil jumlah kuantitas barang masuk dan keluar dalam rentang tanggal (YYYY-MM-DD). Gunakan JIKA ditanya rincian BARANG TERJUAL, BARANG DIBELI, atau PERGERAKAN FISIK."""
    try:
        query = f"""
        SELECT d.namaBarang, 
            CASE 
                WHEN t.type = 'IN' THEN 'Masuk (Stok Bertambah)'
                WHEN t.type = 'OUT' THEN 'Keluar Terjual (Stok Berkurang)'
                WHEN t.type = 'RET' THEN 'Return (Stok Berkurang)'
                WHEN t.type = 'MAKLOON_OUT' THEN 'Makloon Keluar (Stok Berkurang)'
                WHEN t.type = 'MAKLOON_IN' THEN 'Makloon Masuk (Stok Bertambah)'
                ELSE t.type 
            END as jenis_pergerakan, 
            SUM(d.jumlah) as total_qty 
        FROM transaction_details d 
        JOIN transactions t ON t.idTransaksi = d.idTransaksi 
        WHERE DATE(t.tanggal) BETWEEN '{start_date}' AND '{end_date}' AND t.status = 'completed'
        GROUP BY d.namaBarang, t.type
        """
        df = pd.read_sql(query, engine)
        if df.empty:
            return f"Tidak ada pergerakan barang dari {start_date} hingga {end_date}."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error database: {e}"

def get_database_schema() -> str:
    """Mengambil skema tabel dan kolom. Panggil HANYA JIKA pertanyaan tidak bisa dijawab oleh fungsi stok, keuangan, atau mutasi!"""
    try:
        query = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'inventory_db' AND TABLE_NAME != 'migrations'"
        df = pd.read_sql(query, engine)
        if df.empty:
            return "Skema kosong."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error database: {e}"

def execute_sql_query(query: str) -> str:
    """Mengeksekusi query MySQL dinamis (HANYA SELECT). Panggil setelah Anda mendapat skema, dan HANYA JIKA fungsi stok/keuangan/mutasi tidak bisa digunakan."""
    safe_query = query.strip().upper()
    if not (safe_query.startswith("SELECT") or safe_query.startswith("SHOW") or safe_query.startswith("DESCRIBE")):
         return "Error: Security block! Hanya diperbolehkan perintah SELECT, SHOW, atau DESCRIBE demi keamanan data."
    
    try:
        df = pd.read_sql(query, engine)
        if df.empty:
            return "Query berhasil, tapi hasilnya kosong."
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
