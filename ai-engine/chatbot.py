from flask import Flask, request, jsonify
import pandas as pd
from sqlalchemy import create_engine
import urllib.parse
import google.generativeai as genai
import traceback

app = Flask(__name__)

# Konfigurasi API Gemini
API_KEY = "AQ.Ab8RN6IVDyEYexNH3IxPtJphFQSjwk1KlBjUKXDX_m2BFAIgMQ"
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-3.5-flash')

# Konfigurasi Database (sama seperti forecaster.py)
password = urllib.parse.quote_plus('*Reynaldo22')
engine = create_engine(f'mysql+pymysql://root:{password}@127.0.0.1:3307/inventory_db')

def get_db_context():
    try:
        # 1. Ambil data barang dari database (Master Data & Stok)
        query_items = "SELECT kodeBarang, nama, kategori, tipeBarang, stok FROM items"
        df_items = pd.read_sql(query_items, engine)
        context = "Referensi Data Barang di Database saat ini (format CSV):\n" + df_items.to_csv(index=False)
        
        # 2. Rekap Nilai Transaksi (Keuangan/Pengeluaran/Pemasukan) Hari Ini
        query_finance = "SELECT type as jenis_transaksi, SUM(totalTransaksi) as total_nilai_rp FROM transactions WHERE DATE(tanggal) = CURDATE() AND status != 'draft' GROUP BY type"
        df_finance = pd.read_sql(query_finance, engine)
        if not df_finance.empty:
            context += "\n\nRekap Total Nilai Keuangan (Pengeluaran/Pemasukan) Hari Ini (format CSV):\n" + df_finance.to_csv(index=False)
        else:
            context += "\n\nCatatan: Belum ada pengeluaran/pemasukan keuangan yang tercatat hari ini."
            
        # 3. Rekap Mutasi Barang (Masuk/Keluar) Hari Ini
        query_mutation = """
        SELECT d.namaBarang, t.type as jenis_pergerakan, SUM(d.jumlah) as total_qty 
        FROM transaction_details d 
        JOIN transactions t ON t.idTransaksi = d.idTransaksi 
        WHERE DATE(t.tanggal) = CURDATE() AND t.status != 'draft'
        GROUP BY d.namaBarang, t.type
        """
        df_mutation = pd.read_sql(query_mutation, engine)
        if not df_mutation.empty:
            context += "\n\nRekap Mutasi Kuantitas (Barang Keluar/Masuk) Hari Ini (format CSV):\n" + df_mutation.to_csv(index=False)
            
        return context
    except Exception as e:
        print("Database error:", e)
        return "Tidak dapat mengambil data stok dan transaksi dari database saat ini."

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({"error": "Bad Request: No question provided"}), 400

    question = data['question']
    
    # 1. Ambil Konteks Database (RAG)
    db_context = get_db_context()
    
    # 2. Buat Prompt Cerdas
    prompt = f"""
Anda adalah Asisten AI untuk aplikasi StockPro milik PT Mara Jaya Dewi Sakti.
Tugas Anda adalah menjawab pertanyaan user dengan ramah, profesional, dan menggunakan bahasa Indonesia.

{db_context}

Aturan:
1. Jawab pertanyaan user berdasarkan data CSV di atas. 
2. Jika ditanya stok barang, cari nama barang yang mendekati dan sebutkan sisa stoknya.
3. Jangan sebutkan bahwa Anda membaca file CSV, bertingkahlah seolah-olah Anda bisa melihat sistem secara langsung.
4. Jika user bertanya hal di luar data di atas, jawab sesuai pengetahuan umum Anda atau berikan panduan fungsional aplikasi.

Pertanyaan User:
"{question}"

Jawab:
"""
    try:
        # 3. Panggil Gemini API
        response = model.generate_content(prompt)
        answer = response.text
    except Exception as e:
        print("Gemini API Error:")
        traceback.print_exc()
        answer = "Maaf, mesin AI (Gemini) gagal merespon. Pastikan API Key valid atau koneksi internet stabil."
        
    return jsonify({"answer": answer})

if __name__ == '__main__':
    print("AI Chatbot Server (Flask + Gemini) mulai berjalan di http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
