import pandas as pd
import urllib.parse
from sqlalchemy import create_engine
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

print("Step 1: Connecting to DB...")
db_user = os.getenv("DB_USER", "root")
password = urllib.parse.quote_plus(os.getenv("DB_PASS", ""))
db_host = os.getenv("DB_HOST", "127.0.0.1")
db_port = os.getenv("DB_PORT", "3307")
db_name = os.getenv("DB_NAME", "inventory_db")
engine = create_engine(f'mysql+pymysql://{db_user}:{password}@{db_host}:{db_port}/{db_name}')
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
