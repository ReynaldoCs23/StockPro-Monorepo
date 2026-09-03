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

def get_current_stock() -> str:
    """Mengambil data seluruh barang dan sisa stok saat ini dari database. Gunakan jika user bertanya seputar stok barang."""
    try:
        query = "SELECT kodeBarang, nama, kategori, tipeBarang, stok FROM items"
        df = pd.read_sql(query, engine)
        if df.empty:
            return "Data stok kosong."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error database: {e}"

def get_financial_summary(start_date: str, end_date: str) -> str:
    """Mengambil total nilai transaksi (pemasukan dan pengeluaran) dalam format Rupiah untuk rentang tanggal tertentu. Parameter harus berformat YYYY-MM-DD. Gunakan fungsi ini untuk menghitung profit, keuntungan, pemasukan, atau pengeluaran."""
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
            return f"Tidak ada catatan pemasukan/pengeluaran dari {start_date} hingga {end_date}."
        return df.to_csv(index=False)
    except Exception as e:
        return f"Error database: {e}"

def get_item_mutations(start_date: str, end_date: str) -> str:
    """Mengambil jumlah kuantitas barang yang masuk dan keluar dalam rentang tanggal tertentu. Parameter harus berformat YYYY-MM-DD. Gunakan jika ditanya rincian barang terjual, barang yang dibeli, atau pergerakan fisik barang."""
    try:
        query = f"""
        SELECT d.namaBarang, 
            CASE 
                WHEN t.type = 'IN' THEN 'Barang Masuk (Stok Bertambah)'
                WHEN t.type = 'OUT' THEN 'Barang Keluar Terjual (Stok Berkurang)'
                WHEN t.type = 'RET' THEN 'Barang Return (Stok Berkurang)'
                WHEN t.type = 'MAKLOON_OUT' THEN 'Bahan Baku Makloon Keluar (Stok Berkurang)'
                WHEN t.type = 'MAKLOON_IN' THEN 'Barang Jadi Makloon Masuk (Stok Bertambah)'
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

# Inisialisasi Model dengan Tools
system_instruction = """
Anda adalah Asisten AI untuk aplikasi StockPro milik PT Mara Jaya Dewi Sakti.
Anda memiliki akses ke berbagai alat (tools) pencarian database.
Setiap kali user bertanya tentang stok, keuangan, atau pergerakan barang, Anda WAJIB memanggil alat yang sesuai untuk mendapatkan angkanya terlebih dahulu!
Jawab dengan ramah, rapi (gunakan markdown bullet points jika perlu), dan dalam bahasa Indonesia.

PENTING UNTUK FORMATTING:
DILARANG KERAS menggunakan format matematika LaTeX (seperti `\frac`, `\text`, atau tanda `$`). Jika Anda harus menulis rumus, gunakan format teks biasa yang mudah dibaca (contoh: "Keuntungan Bersih / Total Pemasukan x 100%").

Jika pertanyaan di luar konteks inventaris, atau jika Anda ingin menyarankan pengguna menggunakan aplikasi, arahkan mereka HANYA ke menu-menu resmi yang ada di StockPro berikut ini:
- Dashboard
- AI Assistant
- Kalender Transaksi
- Inventory (terdiri dari sub-menu: Barang Masuk, Barang Keluar, Barang Return, Penyesuaian Stok, Makloon)
- Master Data (terdiri dari sub-menu: Master Barang, Kategori Barang, Master Satuan, Lokasi Rak, Data Supplier, Data Pelanggan, Manajemen User)
- System Logs
- Notifikasi Stok (tombol lonceng di kanan atas)
- Semua Aktivitas
Jangan mengarang menu lain yang tidak ada di daftar atas.
"""

model = genai.GenerativeModel(
    model_name='gemini-3.5-flash',
    tools=[get_current_stock, get_financial_summary, get_item_mutations],
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
