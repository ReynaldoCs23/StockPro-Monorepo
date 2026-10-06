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
        $result = (array)($data[0] ?? []);

        // Laba memakai sumber yang SAMA dengan Dashboard (Penjualan DPP - HPP FIFO)
        $profit = app(DashboardController::class)->getProfitAnalyticsBase($start_date, $end_date);
        $result['penjualan_dpp'] = round($profit['grand_total_revenue'], 2);
        $result['hpp_terjual'] = round($profit['grand_total_cogs'], 2);
        $result['laba_bersih'] = round($profit['grand_total_revenue'] - $profit['grand_total_cogs'], 2);
        $result['margin_persen'] = $profit['grand_total_revenue'] != 0
            ? round(($result['laba_bersih'] / $profit['grand_total_revenue']) * 100, 2)
            : 0;
        $result['laba_per_produk'] = collect($profit['by_category'])->sortByDesc('profit')->take(10)->values();

        return response()->json($result);
    }

    public function getMutations(Request $request) {
        $this->checkAuth($request);
        $start_date = $request->input('start_date');
        $end_date = $request->input('end_date');
        $search_item = $request->input('search_item');

        $query = "
        SELECT d.namaBarang, 
            CASE 
                WHEN t.type = 'IN' THEN 'Masuk'
                WHEN t.type = 'OUT' THEN 'Keluar'
                WHEN t.type = 'RET' THEN 'Return'
                WHEN t.type = 'MAKLOON_OUT' THEN 'Mkl_Out'
                WHEN t.type = 'MAKLOON_IN' THEN 'Mkl_In'
                ELSE t.type 
            END as jenis, 
            SUM(d.jumlah) as total_qty 
        FROM transaction_details d 
        JOIN transactions t ON t.idTransaksi = d.idTransaksi 
        WHERE DATE(t.tanggal) BETWEEN ? AND ? AND t.status = 'completed'
        ";
        
        $bindings = [$start_date, $end_date];
        
        if (!empty($search_item)) {
            $query .= " AND d.namaBarang LIKE ? ";
            $bindings[] = '%' . $search_item . '%';
        }

        $query .= " GROUP BY d.namaBarang, t.type ORDER BY total_qty DESC LIMIT 50";

        $data = DB::select($query, $bindings);
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
