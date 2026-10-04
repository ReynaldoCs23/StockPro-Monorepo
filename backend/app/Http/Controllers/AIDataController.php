<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AIDataController extends Controller
{
    // Cek keamanan sederhana (internal use)
    private function checkAuth(Request $request) {
        $token = $request->header('Authorization');
        // Jika token tidak cocok dengan env, tolak.
        if (env('AI_API_KEY') && $token !== 'Bearer ' . env('AI_API_KEY')) {
            abort(401, 'Unauthorized AI Access');
        }
    }

    public function getStock(Request $request) {
        $this->checkAuth($request);
        $data = DB::table('items')->where('stok', '>', 0)->get();
        return response()->json($data);
    }

    public function getFinancial(Request $request) {
        $this->checkAuth($request);
        $start_date = $request->input('start_date');
        $end_date = $request->input('end_date');

        $query = "
        SELECT 
            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-OUT%%' THEN totalTransaksi ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-IN%%' THEN totalTransaksi ELSE 0 END), 0)
            as penjualan_distributor_net,

            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-IN%%' THEN totalTransaksi ELSE 0 END), 0)
            + COALESCE(SUM(CASE WHEN idTransaksi LIKE 'MKL-IN%%' THEN totalTransaksi ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-OUT%%' THEN totalTransaksi ELSE 0 END), 0)
            as total_belanja_stok_net,

            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-IN%%' THEN totalTransaksi ELSE 0 END), 0)
            as pembelian_supplier,

            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'MKL-IN%%' THEN totalTransaksi ELSE 0 END), 0)
            as biaya_makloon,

            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'MKL-OUT%%' THEN totalTransaksi ELSE 0 END), 0)
            as bahan_baku_makloon,

            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-IN%%' THEN totalTransaksi ELSE 0 END), 0)
            as retur_dari_customer,

            COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-OUT%%' THEN totalTransaksi ELSE 0 END), 0)
            as retur_ke_supplier
        FROM transactions 
        WHERE DATE(tanggal) BETWEEN ? AND ? AND status = 'completed'
        ";

        $data = DB::select($query, [$start_date, $end_date]);
        return response()->json($data[0] ?? []);
    }

    public function getMutations(Request $request) {
        $this->checkAuth($request);
        $start_date = $request->input('start_date');
        $end_date = $request->input('end_date');

        $query = "
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
        WHERE DATE(t.tanggal) BETWEEN ? AND ? AND t.status = 'completed'
        GROUP BY d.namaBarang, t.type
        ";

        $data = DB::select($query, [$start_date, $end_date]);
        return response()->json($data);
    }

    public function getSchema(Request $request) {
        $this->checkAuth($request);
        $query = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME != 'migrations'";
        $data = DB::select($query, [env('DB_DATABASE', 'inventory_db')]);
        return response()->json($data);
    }

    public function executeQuery(Request $request) {
        $this->checkAuth($request);
        $sql = $request->input('query');
        
        // HANYA BOLEH SELECT UNTUK KEAMANAN
        if (strtoupper(substr(trim($sql), 0, 6)) !== 'SELECT') {
            abort(403, 'Hanya query SELECT yang diizinkan');
        }

        try {
            $data = DB::select($sql);
            return response()->json($data);
        } catch (\Exception $e) {
            abort(400, $e->getMessage());
        }
    }
}
