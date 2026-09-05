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

def get_database_schema() -> str:
    """Mengambil skema (daftar tabel dan kolom beserta tipe datanya) dari database inventaris. Selalu panggil fungsi ini pertama kali jika Anda belum tahu struktur tabelnya untuk membuat query yang valid!"""
    try:
        query = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'inventory_db' AND TABLE_NAME != 'migrations'"
        df = pd.read_sql(query, engine)
        if df.empty:
            return "Skema kosong atau database tidak ditemukan."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error database: {e}"

def execute_sql_query(query: str) -> str:
    """Mengeksekusi query MySQL ke database dan mengembalikan hasilnya dalam format CSV. HANYA UNTUK SELECT. DILARANG KERAS mengeksekusi DELETE, UPDATE, DROP, atau INSERT."""
    # Simple safety guardrail
    safe_query = query.strip().upper()
    if not (safe_query.startswith("SELECT") or safe_query.startswith("SHOW") or safe_query.startswith("DESCRIBE")):
         return "Error: Security block! Hanya diperbolehkan perintah SELECT, SHOW, atau DESCRIBE demi keamanan data."
    
    try:
        df = pd.read_sql(query, engine)
        if df.empty:
            return "Query berhasil dieksekusi, tapi hasilnya kosong (tidak ada data)."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error eksekusi query (mungkin ada salah syntax kolom/tabel): {e}"

# Inisialisasi Model dengan Tools
system_instruction = """
Anda adalah AI Data Analyst & Asisten Operasional (Agentic AI) untuk aplikasi StockPro milik PT Mara Jaya Dewi Sakti.
Anda memiliki akses ke database via eksekusi SQL Dinamis!

LANGKAH KERJA WAJIB JIKA DITANYA DATA:
1. Panggil fungsi `get_database_schema()` TERLEBIH DAHULU untuk memahami struktur, nama tabel, dan nama kolom yang ada di database.
2. Buat query MySQL yang sesuai, lalu panggil fungsi `execute_sql_query(query)` untuk mendapatkan datanya.
3. Rangkai jawaban akhir yang mudah dibaca berdasarkan data yang Anda dapatkan.

ATURAN PENTING:
- DILARANG KERAS menggunakan format matematika LaTeX (seperti `\frac`, `\text`, atau tanda `$`). Gunakan teks biasa.
- Jawab dengan bahasa Indonesia yang natural, ramah, dan ringkas.
- JANGAN tampilkan syntax SQL mentah kepada user. User hanya butuh jawaban akhirnya.
- Jika pengguna bingung letak suatu menu, arahkan ke: Dashboard, AI Assistant, Kalender Transaksi, Inventory (Masuk, Keluar, Return, Adjustment, Makloon), Master Data, atau System Logs.
"""

model = genai.GenerativeModel(
    model_name='gemini-3.5-flash',
    tools=[get_database_schema, execute_sql_query],
    system_instruction=system_instruction
)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({"error": "Bad Request: No question provided"}), 400

    question = data['question']
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # Bungkus pertanyaan dengan konteks hari ini agar AI tahu tanggal berapa sekarang
    context_msg = f"INFORMASI SISTEM: Hari ini adalah {today_str}. Jika pengguna menanyakan 'hari ini', 'minggu ini', atau 'kemarin', hitung tanggalnya berdasarkan {today_str}. \n\nPertanyaan Pengguna: \"{question}\""
    
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
