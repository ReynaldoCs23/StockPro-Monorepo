import pandas as pd
from sqlalchemy import create_engine
from statsmodels.tsa.holtwinters import SimpleExpSmoothing
import datetime

# 1. Akses Database (Sesuaikan port dan kredensial lokal)
import urllib.parse
password = urllib.parse.quote_plus('*Reynaldo22')
engine = create_engine(f'mysql+pymysql://root:{password}@127.0.0.1:3307/inventory_db')

# 2. Ekstraksi Histori Pergerakan Barang
query = """
SELECT kodeBarang, created_at as tanggal, jumlah_transaksi as qty
FROM transaction_details
WHERE idTransaksi LIKE 'INV-OUT-%%' OR idTransaksi LIKE 'MKL-OUT-%%'
"""
df = pd.read_sql(query, engine)
df['tanggal'] = pd.to_datetime(df['tanggal'])

hasil_proyeksi = []
barang_unik = df['kodeBarang'].unique()

# 3. Transformasi Deret Waktu & Kalkulasi AI
for barang in barang_unik:
    df_barang = df[df['kodeBarang'] == barang].copy()
    df_barang.set_index('tanggal', inplace=True)

    # Rangkum total kuantitas per bulan (ME = Month End)
    df_bulanan = df_barang['qty'].resample('ME').sum().fillna(0)

    # Analisis mensyaratkan minimal 2 bulan siklus histori transaksi
    if len(df_bulanan) >= 2:
        model = SimpleExpSmoothing(df_bulanan, initialization_method="estimated").fit()
        prediksi = model.forecast(1) 

        bulan_depan = prediksi.index[0].strftime('%Y-%m-01')
        estimasi = max(0, int(round(prediksi.iloc[0])))

        hasil_proyeksi.append({
            'kodeBarang': barang,
            'periode_target': bulan_depan,
            'estimasi_qty': estimasi,
            'updated_at': datetime.datetime.now()
        })

# 4. Injeksi Hasil ke Database
if hasil_proyeksi:
    df_hasil = pd.DataFrame(hasil_proyeksi)
    with engine.begin() as conn:
        conn.exec_driver_sql("TRUNCATE TABLE product_projections")
    df_hasil.to_sql('product_projections', con=engine, if_exists='append', index=False)
    print(f"Mesin selesai beroperasi. Proyeksi {len(hasil_proyeksi)} barang diperbarui.")
else:
    print("Volume data historis belum mencukupi untuk algoritma peramalan.")