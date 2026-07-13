# StockPro Operational & Technical Guidebook

## Section 1: Feature Walkthrough (Panduan Fitur Operasional)

### Master Data Management
The Master Data module serves as the foundational data repository for the entire system. Accurate management of this section is critical for transactional integrity.
*   **Items (Barang):** Governs the inventory catalog. Registration requires defining the unit of measurement (`satuan`), categorization, and pricing structure (`hargaBeli` and `hargaJual`). Initial stock entries automatically generate the first batch record.
*   **Categories & Units:** Categorical classifications and units (e.g., Pcs, Kg) standardizing product metrics.
*   **Partners & Locations:** Management of Suppliers and Customers, alongside storage identifiers (`lokasi_rak`), to establish supply chain endpoints and internal warehousing semantics.

### Standard Transactions (Barang Masuk & Barang Keluar)
*   **Inbound (Barang Masuk - `INV-IN`):** Records incoming stock from Suppliers. Executing an inbound transaction registers a new `item_batches` record utilizing FIFO (First-In-First-Out) methodology for strict cost tracking.
*   **Outbound (Barang Keluar - `INV-OUT`):** Processes distribution to Customers. The system automatically depletes the oldest available batches (FIFO) to accurately calculate the Cost of Goods Sold (COGS).

### Returns Workflow (Barang Return)
The return module utilizes a strict **Net Deduction** logic. It does not facilitate direct physical item replacements.
*   **Return Out (`RET-OUT`):** Returning defective items back to the Supplier deducts directly from the **Vendor Expense** metric.
*   **Return In (`RET-IN`):** Receiving returned items from Customers reduces the **Distributor Revenue** metric.
*   *Financial Impact:* These adjustments automatically synchronize with the Dashboard analytics to ensure the Net Profit and COGS valuations remain completely accurate without requiring manual journal entries.

### Dashboard Financial Analytics
The Dashboard provides real-time financial aggregation based on transactional data:
*   **Net Revenue (Pendapatan Bersih):** Calculated as `Total INV-OUT` minus `Total RET-IN`.
*   **Net Expense (Pengeluaran Vendor):** Calculated as `Total INV-IN` minus `Total RET-OUT`.
*   **Daily Profit & Net Cashflow:** Derived continuously by deducting COGS (based on precise batch retrieval logic) from the Net Revenue, presented through aggregated charts.

---

## Section 2: Roles & Permissions (Manajemen Hak Akses)

The system enforces strict Role-Based Access Control (RBAC) managed via Laravel's robust middleware architecture.

*   **Superadmin & Admin:** 
    Granted absolute system privileges. Possesses full CRUD (Create, Read, Update, Delete) rights across all operational modules, Financial Reports, and User Management configurations.
*   **Karyawan (Staff):**
    Authorized strictly for daily operational workflows. Can execute and modify Master Data, Inbound/Outbound Transactions, Returns, and Makloon orders. Access to Financial Analytics, System Logs, and User Management is explicitly denied.
*   **Guest (Tamu):**
    A restricted entity provisioned with zero default permissions. Primarily utilized for view-only or severely constrained external interactions.

---

## Section 3: Troubleshooting (Pemecahan Masalah Sistem)

### 1. 403 Forbidden on Login
**Symptom:** Users successfully authenticate but receive a `403 Forbidden` response preventing system access.
**Resolution:** This indicates the account's strict `masaBerlaku` (expiration date) has lapsed. Administrators must extend the `masaBerlaku` parameter within the User Management module to restore access.

### 2. Missing System Logs (Timezone Mismatch)
**Symptom:** Operations performed today are not visible in the system logs or dashboard analytics until the following day.
**Resolution:** This is caused by timezone discrepancies between the server (e.g., UTC+8 / WITA) and the client browser (e.g., UTC+7 / WIB). Adjust the date filter parameters to cross the midnight boundary to retrieve the expected records.

### 3. Negative Profit Margins
**Symptom:** The Dashboard indicates a negative profit despite high sales volume.
**Resolution:** The profit engine relies heavily on accurate pricing matrices. Ensure the `hargaJual` (Selling Price) strictly exceeds the `hargaBeli` / `harga_modal_satuan` (Capital Cost) within the active item batches. Retroactive adjustments to Master Data will not fix previously closed batches.

---

## Section 4: Data Dictionary & API Documentation (Kamus Data & Spesifikasi API)

### Critical Database Structures

**Table: `transactions`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `idTransaksi` | VARCHAR (PK) | Unique identifier (e.g., `INV-IN-2026...`, `RET-OUT-2026...`). |
| `type` | ENUM | Categorizes the transaction (`IN`, `OUT`, `RET`). |
| `sumber_tujuan` | VARCHAR | Relates to the Customer or Supplier ID. |
| `totalTransaksi` | DECIMAL | Total gross monetary value of the transaction. |

**Table: `transaction_details`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `idTransaksi` | VARCHAR (FK) | Maps to the parent `transactions` table. |
| `kodeBarang` | VARCHAR (FK) | Maps to the `items` catalog. |
| `jumlah` | INTEGER | Quantity of the item processed. |
| `harga_satuan` | DECIMAL | The exact price locked at the time of the transaction. |

### API Endpoint Overview
All protected endpoints require a Sanctum Bearer Token.

*   **Authentication:**
    *   `POST /api/login`: Authenticates user credentials and returns a token.
    *   `POST /api/logout`: Revokes the active token.
*   **Transactions:**
    *   `GET /api/transactions`: Retrieves paginated history of all stock movements.
    *   `POST /api/transaction/{type}`: Submits a new transaction payload. Valid types are `masuk`, `keluar`, `return_in`, `return_out`. Payload strictly requires an array of `items` including `kodeBarang` and `jumlah`.
*   **Master Data:**
    *   `POST /api/{table}`: Generic endpoint to create master records (e.g., `/api/items`, `/api/suppliers`). Governed by dynamic `check.table.permission` middleware.
