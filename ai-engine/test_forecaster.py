import pandas as pd
import urllib.parse
from sqlalchemy import create_engine
import datetime

print("Step 1: Connecting to DB...")
password = urllib.parse.quote_plus('*Reynaldo22')
engine = create_engine(f'mysql+pymysql://root:{password}@127.0.0.1:3307/inventory_db')
print("Step 1 DONE")

print("Step 2: Fetching data...")
query = """
SELECT kodeBarang, created_at as tanggal, jumlah_transaksi as qty
FROM transaction_details
WHERE idTransaksi LIKE 'INV-OUT-%%' OR idTransaksi LIKE 'MKL-OUT-%%'
"""
df = pd.read_sql(query, engine)
print(f"Data fetched: {len(df)} rows")
print("Step 2 DONE")

print("Step 3: statsmodels import...")
try:
    from statsmodels.tsa.holtwinters import SimpleExpSmoothing
    print("statsmodels imported")
except Exception as e:
    print("Error importing statsmodels:", e)

print("DONE")
