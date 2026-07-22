<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class DashboardController extends Controller {
    public function index(Request $request) {
        // Robust parsing regardless of what the frontend sends
        $startFilter = $request->get('start_date', now('Asia/Makassar')->subDays(30));
        $endFilter = $request->get('end_date', now('Asia/Makassar'));

        $cleanStart = \Carbon\Carbon::parse($startFilter)->format('Y-m-d');
        $cleanEnd = \Carbon\Carbon::parse($endFilter)->format('Y-m-d');

        $cacheKey = "dashboard_analytics_{$cleanStart}_{$cleanEnd}";

        // Cache dihapus agar data 100% real-time
        $dashboardData = call_user_func(function () use ($cleanStart, $cleanEnd, $startFilter, $endFilter) {
            // --- DYNAMIC DASHBOARD ANALYTICS CLOSURES ---
            $durationDays = \Carbon\Carbon::parse($startFilter)->diffInDays(\Carbon\Carbon::parse($endFilter)) + 1;
            $prevStartDate = \Carbon\Carbon::parse($startFilter)->subDays($durationDays)->format('Y-m-d');
            $prevEndDate = \Carbon\Carbon::parse($endFilter)->subDays($durationDays)->format('Y-m-d');

            $getQtyMasuk = function($start, $end) {
                return (int) DB::table('transaction_details')
                    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                    ->whereBetween('transactions.tanggal', [$start, $end])
                    ->where('transactions.status', 'completed')
                    ->value(DB::raw("
                        COALESCE(SUM(CASE WHEN transactions.idTransaksi LIKE 'INV-IN%' THEN transaction_details.jumlah ELSE 0 END), 0)
                        +
                        COALESCE(SUM(CASE WHEN transactions.idTransaksi LIKE 'MKL-IN%' THEN transaction_details.jumlah ELSE 0 END), 0)
                        -
                        COALESCE(SUM(CASE WHEN transactions.idTransaksi LIKE 'RET-OUT%' THEN transaction_details.jumlah ELSE 0 END), 0)
                    "));
            };

            $getQtyKeluar = function($start, $end) {
                return (int) DB::table('transaction_details')
                    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                    ->whereBetween('transactions.tanggal', [$start, $end])
                    ->where('transactions.status', 'completed')
                    ->value(DB::raw("
                        COALESCE(SUM(CASE WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN transaction_details.jumlah ELSE 0 END), 0)
                        +
                        COALESCE(SUM(CASE WHEN transactions.idTransaksi LIKE 'MKL-OUT%' THEN transaction_details.jumlah ELSE 0 END), 0)
                        -
                        COALESCE(SUM(CASE WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN transaction_details.jumlah ELSE 0 END), 0)
                    "));
            };

            $getVendorExpense = function($start, $end) {
                return (float) DB::table('transactions')
                    ->whereBetween('tanggal', [$start, $end])
                    ->where('status', 'completed')
                    ->value(DB::raw("
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-IN%' THEN totalTransaksi ELSE 0 END), 0) 
                        +
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'MKL-IN%' THEN totalTransaksi ELSE 0 END), 0)
                        - 
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-OUT%' THEN totalTransaksi ELSE 0 END), 0)
                    "));
            };

            $getDistributorSales = function($start, $end) {
                return (float) DB::table('transactions')
                    ->whereBetween('tanggal', [$start, $end])
                    ->where('status', 'completed')
                    ->value(DB::raw("
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-OUT%' THEN totalTransaksi ELSE 0 END), 0) 
                        - 
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-IN%' THEN totalTransaksi ELSE 0 END), 0)
                    "));
            };

            $calculateMetric = function($currentTotal, $previousTotal) {
                $percentage = ($previousTotal > 0) ? (($currentTotal - $previousTotal) / $previousTotal) * 100 : (($currentTotal > 0) ? 100 : 0);
                return [
                    'value' => (float)$currentTotal,
                    'percentage' => round($percentage, 1),
                    'trend' => $percentage >= 0 ? 'up' : 'down',
                ];
            };

            $metricBarangMasuk = $calculateMetric($getQtyMasuk($cleanStart, $cleanEnd), $getQtyMasuk($prevStartDate, $prevEndDate));
            $metricBarangKeluar = $calculateMetric($getQtyKeluar($cleanStart, $cleanEnd), $getQtyKeluar($prevStartDate, $prevEndDate));
            $metricPengeluaranVendor = $calculateMetric($getVendorExpense($cleanStart, $cleanEnd), $getVendorExpense($prevStartDate, $prevEndDate));
            $metricPenjualanDistributor = $calculateMetric($getDistributorSales($cleanStart, $cleanEnd), $getDistributorSales($prevStartDate, $prevEndDate));

            // Retro-compatibility variables
            $vendorExpense = $metricPengeluaranVendor['value'];
            $distributorSales = $metricPenjualanDistributor['value'];

            // 3. Centralized Profit Analytics (Single Source of Truth)
            $profitAnalytics = $this->getProfitAnalyticsBase($cleanStart, $cleanEnd);
            
            // Laba = Total Penjualan Dasar (DPP) - Total HPP FIFO
            $baseRevenue = $profitAnalytics['grand_total_revenue'];
            $estimatedProfit = $baseRevenue - $profitAnalytics['grand_total_cogs'];
            
            $profitAnalytics['grand_total_profit'] = $estimatedProfit; 
            
            // Re-calculate Margin safely to prevent Division by Zero using DPP
            $profitAnalytics['grand_margin_percentage'] = $baseRevenue != 0 
                ? round(($estimatedProfit / $baseRevenue) * 100, 2) 
                : 0;

            // 4. Data Grafik Arus Kas & Laba Harian
            $dailyTotals = DB::table('transactions')
                ->select(
                    DB::raw('DATE(tanggal) as date'),
                    DB::raw("COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-OUT%' THEN totalTransaksi ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-IN%' THEN totalTransaksi ELSE 0 END), 0) as net_daily_revenue"),
                    DB::raw("COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-IN%' THEN totalTransaksi ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN idTransaksi LIKE 'MKL-IN%' THEN totalTransaksi ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN idTransaksi LIKE 'RET-OUT%' THEN totalTransaksi ELSE 0 END), 0) as pengeluaran_vendor")
                )
                ->where('status', 'completed')
                ->whereBetween('tanggal', [$cleanStart, $cleanEnd])
                ->groupBy('date')
                ->get()
                ->keyBy('date');

            $batchAggQuery = DB::table('transaction_batch_details')
                ->join('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
                ->select(
                    'transaction_batch_details.idTransaksi',
                    'item_batches.kodeBarang',
                    DB::raw('SUM(transaction_batch_details.qty_diambil) as total_qty_diambil'),
                    DB::raw('SUM(transaction_batch_details.qty_diambil * item_batches.harga_modal_satuan) as total_cogs_batch')
                )
                ->groupBy('transaction_batch_details.idTransaksi', 'item_batches.kodeBarang');

            $dailyAnalytics = DB::table('transaction_details')
                ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
                ->leftJoinSub($batchAggQuery, 'batch_agg', function ($join) {
                    $join->on('transaction_details.idTransaksi', '=', 'batch_agg.idTransaksi')
                         ->on('transaction_details.kodeBarang', '=', 'batch_agg.kodeBarang');
                })
                ->select(
                    DB::raw('DATE(transactions.tanggal) as date'),
                    DB::raw("
                        SUM(
                            CASE 
                                WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                    ABS(transaction_details.jumlah * transaction_details.harga_satuan)
                                WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                    -ABS(transaction_details.jumlah * transaction_details.harga_satuan)
                                ELSE 0 
                            END
                        ) as net_daily_base_revenue
                    "),
                    DB::raw("
                        SUM(
                            CASE 
                                WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                    ABS(COALESCE(batch_agg.total_cogs_batch, transaction_details.jumlah * items.hargaBeli, 0))
                                WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                    -ABS(COALESCE(batch_agg.total_cogs_batch, transaction_details.jumlah * items.hargaBeli, 0))
                                ELSE 0 
                            END
                        ) as net_daily_cogs
                    ")
                )
                ->where('transactions.status', 'completed')
                ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                ->groupBy('date')
                ->get()
                ->keyBy('date');

            $chartData = [];
            $period = \Carbon\CarbonPeriod::create($cleanStart, $cleanEnd);
            foreach ($period as $date) {
                $dateStr = $date->toDateString();
                $dTotal = $dailyTotals->get($dateStr);
                $daily = $dailyAnalytics->get($dateStr);
                
                $pemasukan_gross = $dTotal ? (float)$dTotal->net_daily_revenue : 0; // Tetap pakai gross untuk grafik arus kas
                $pemasukan_base = $daily ? (float)$daily->net_daily_base_revenue : 0; // DPP
                $cogs = $daily ? (float)$daily->net_daily_cogs : 0;
                $pengeluaran = $dTotal ? (float)$dTotal->pengeluaran_vendor : 0;
                $net_daily_profit = $pemasukan_base - $cogs; // Laba murni tanpa PPN
                
                $chartData[] = [
                    'Tanggal' => $dateStr,
                    'Hari' => $date->format('d'),
                    'Pemasukan' => $pemasukan_gross,
                    'Pengeluaran' => $pengeluaran,
                    'net_daily_revenue' => $pemasukan_base,
                    'net_daily_cogs' => $cogs,
                    'net_daily_profit' => $net_daily_profit,
                ];
            }

            // 5. Profit per Produk & Donut Chart (derived from centralized source)
            $categoryProfitData = collect($profitAnalytics['by_category'])->sortByDesc('profit')->values();
            $maxProfit = $categoryProfitData->count() > 0 ? $categoryProfitData->max('profit') : 1;

            // 6. Profit Contribution with Percentages (for Donut Chart)
            $totalProfit = $profitAnalytics['grand_total_profit'];
            $profitDonut = $categoryProfitData->map(function ($item) use ($totalProfit) {
                return [
                    'name' => $item['name'],
                    'profit' => $item['profit'],
                    'percentage' => $totalProfit > 0 ? round(($item['profit'] / $totalProfit) * 100, 1) : 0,
                ];
            })->values();

            // 7. Top 5 VIP Customers (by revenue)
            $vipCustomers = DB::table('transactions')
                ->leftJoin('customers', 'transactions.entitas', '=', 'customers.nama')
                ->leftJoin('transaction_details', 'transactions.idTransaksi', '=', 'transaction_details.idTransaksi')
                ->select(
                    'transactions.entitas as customer',
                    'customers.penanggung_jawab as pic',
                    DB::raw('COUNT(DISTINCT transactions.idTransaksi) as total_trx'),
                    DB::raw("SUM(CASE WHEN transactions.type = 'OUT' THEN transaction_details.jumlah * transaction_details.harga_satuan ELSE 0 END) - SUM(CASE WHEN transactions.type = 'RET' AND transactions.sumber_tujuan LIKE '%RET_IN%' THEN transaction_details.jumlah * transaction_details.harga_satuan ELSE 0 END) as revenue"),
                    DB::raw("SUM(CASE WHEN transactions.type = 'OUT' THEN transaction_details.jumlah ELSE 0 END) as volume_out"),
                    DB::raw("SUM(CASE WHEN transactions.type = 'RET' AND transactions.sumber_tujuan LIKE '%RET_IN%' THEN transaction_details.jumlah ELSE 0 END) as volume_ret")
                )
                ->whereIn('transactions.type', ['OUT', 'RET'])
                ->where(function($q) {
                    $q->where('transactions.sumber_tujuan', 'LIKE', '%Penjualan%')
                      ->orWhere('transactions.sumber_tujuan', 'LIKE', '%RET_IN_RETURN_CUSTOMER%');
                })
                ->where('transactions.sumber_tujuan', 'NOT LIKE', '%Makloon%')
                ->where('transactions.status', 'completed')
                ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                ->whereNotNull('transactions.entitas')
                ->groupBy('transactions.entitas', 'customers.penanggung_jawab')
                ->havingRaw("SUM(CASE WHEN transactions.type = 'OUT' THEN transaction_details.jumlah * transaction_details.harga_satuan ELSE 0 END) - SUM(CASE WHEN transactions.type = 'RET' AND transactions.sumber_tujuan LIKE '%RET_IN%' THEN transaction_details.jumlah * transaction_details.harga_satuan ELSE 0 END) > 0")
                ->orderByDesc('revenue')
                ->limit(5)
                ->get()
                ->map(function ($row, $idx) {
                    return [
                        'rank' => $idx + 1,
                        'customer' => $row->customer,
                        'pic' => $row->pic ?: '-',
                        'volume' => (int)($row->volume_out - $row->volume_ret),
                        'revenue' => (float)$row->revenue,
                    ];
                });

            // 8. Fast-Moving & Slow-Moving Items
            $dayCount = max(1, \Carbon\Carbon::parse($cleanStart)->diffInDays(\Carbon\Carbon::parse($cleanEnd)));

            $fastMoving = DB::table('transaction_details')
                ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                ->join('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
                ->select(
                    'items.kodeBarang', 'items.nama as namaBarang', 'items.stok',
                    DB::raw("SUM(CASE WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN transaction_details.jumlah ELSE 0 END) - SUM(CASE WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN transaction_details.jumlah ELSE 0 END) as total_sold")
                )
                ->whereIn('transactions.type', ['OUT', 'RET'])
                ->where(function($q) {
                    $q->where('transactions.sumber_tujuan', 'LIKE', '%Penjualan%')
                      ->orWhere('transactions.sumber_tujuan', 'LIKE', '%RET_IN%');
                })
                ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                ->where('transactions.status', 'completed')
                ->groupBy('items.kodeBarang', 'items.nama', 'items.stok')
                ->havingRaw("SUM(CASE WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN transaction_details.jumlah ELSE 0 END) - SUM(CASE WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN transaction_details.jumlah ELSE 0 END) > 0")
                ->orderByDesc('total_sold')
                ->limit(5)
                ->get()
                ->map(function ($item) use ($dayCount) {
                    return [
                        'kodeBarang' => $item->kodeBarang,
                        'namaBarang' => $item->namaBarang,
                        'stok' => (int)$item->stok,
                        'total_sold' => (int)$item->total_sold,
                        'avg_sold_per_day' => round($item->total_sold / $dayCount, 1),
                    ];
                });

            // Slow-moving: items with stock > 0 but lowest/no outbound in period (Produk Jadi only)
            $slowMoving = DB::table('items')
                ->select('kodeBarang', 'nama as namaBarang', 'stok', 'last_sold_at')
                ->where('stok', '>', 0)
                ->whereRaw('LOWER(tipeBarang) = ?', ['produk jadi'])
                ->orderByRaw('last_sold_at IS NULL DESC, last_sold_at ASC')
                ->limit(5)
                ->get()
                ->map(function ($item) {
                    $daysStagnant = $item->last_sold_at ? \Carbon\Carbon::parse($item->last_sold_at)->diffInDays(\Carbon\Carbon::now()) : 999;
                    return [
                        'kodeBarang' => $item->kodeBarang,
                        'namaBarang' => $item->namaBarang,
                        'stok' => (int)$item->stok,
                        'days_stagnant' => (int)$daysStagnant,
                    ];
                });

            // 9. Critical Stock Items (Stok < minStok)
            $criticalStockItems = DB::table('items')
                ->select('kodeBarang', 'nama as namaBarang', 'stok')
                ->whereColumn('stok', '<', 'minStok')
                ->orderBy('stok', 'asc')
                ->limit(5)
                ->get();

            // 10. Additional Metrics (WoW Trends removed, using dynamic metrics)
            $stokDibooking = DB::table('transaction_details')
                ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                ->whereIn('transactions.type', ['OUT', 'MAKLOON_OUT'])
                ->whereIn('transactions.status', ['scheduled', 'pending', 'booked']) // Cover multiple possibilities
                ->sum('transaction_details.jumlah');

            $deadStock = DB::table('items')
                ->leftJoin(DB::raw('(SELECT transaction_details.kodeBarang FROM transaction_details JOIN transactions ON transaction_details.idTransaksi = transactions.idTransaksi WHERE transactions.type = "OUT" AND transactions.tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY transaction_details.kodeBarang) as recent_out'), 'items.kodeBarang', '=', 'recent_out.kodeBarang')
                ->select('items.kodeBarang', 'items.nama as namaBarang', 'items.stok')
                ->where('items.stok', '>', 0)
                ->whereNull('recent_out.kodeBarang')
                ->limit(5)
                ->get();

            return [
                'barangMasuk' => $metricBarangMasuk,
                'barangKeluar' => $metricBarangKeluar,
                'pengeluaranVendor' => $metricPengeluaranVendor,
                'penjualanDistributor' => $metricPenjualanDistributor,
                'labaBersih' => (float)$estimatedProfit,
                'totalRevenue' => $profitAnalytics['grand_total_revenue'],
                'totalCogs' => $profitAnalytics['grand_total_cogs'],
                'totalProfit' => $profitAnalytics['grand_total_profit'],
                'grand_margin_percentage' => $profitAnalytics['grand_margin_percentage'],
                'chartData' => $chartData,
                'categoryProfitArray' => $categoryProfitData->toArray(),
                'maxProfit' => (float)$maxProfit,
                'profitDonut' => $profitDonut->toArray(),
                'vipCustomers' => $vipCustomers->toArray(),
                'fastMoving' => $fastMoving->toArray(),
                'slowMoving' => $slowMoving->toArray(),
                'critical_stock_items' => $criticalStockItems->toArray(),
                // Keeping for backwards compatibility if needed elsewhere
                'trendMasuk' => $metricBarangMasuk['percentage'],
                'trendKeluar' => $metricBarangKeluar['percentage'],
                'trendVendor' => $metricPengeluaranVendor['percentage'],
                'trendSales' => $metricPenjualanDistributor['percentage'],
                'stokDibooking' => (int)$stokDibooking,
                'deadStock' => $deadStock->toArray(),
            ];
        });

        return response()->json($dashboardData);
    }

    /**
     * Centralized Profit Calculation - Single Source of Truth
     * All profit widgets MUST derive from this method.
     */
    private function getProfitAnalyticsBase($startBound, $endBound)
    {
        $batchAggQuery = DB::table('transaction_batch_details')
            ->join('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
            ->select(
                'transaction_batch_details.idTransaksi',
                'item_batches.kodeBarang',
                DB::raw('SUM(transaction_batch_details.qty_diambil) as total_qty_diambil'),
                DB::raw('SUM(transaction_batch_details.qty_diambil * item_batches.harga_modal_satuan) as total_cogs_batch')
            )
            ->groupBy('transaction_batch_details.idTransaksi', 'item_batches.kodeBarang');

        // Calculate Net Revenue and Net COGS per category directly in SQL
        $analytics = DB::table('transaction_details')
            ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
            ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
            ->leftJoinSub($batchAggQuery, 'batch_agg', function ($join) {
                $join->on('transaction_details.idTransaksi', '=', 'batch_agg.idTransaksi')
                     ->on('transaction_details.kodeBarang', '=', 'batch_agg.kodeBarang');
            })
            ->select(
                DB::raw('COALESCE(NULLIF(items.nama, ""), "Unknown Product") as kategori'),
                // Net Revenue = SUM(OUT Revenue) - SUM(RET Revenue)
                DB::raw("
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                ABS(transaction_details.jumlah * transaction_details.harga_satuan)
                            ELSE 0 
                        END
                    ) as revenue_out,
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                ABS(transaction_details.jumlah * transaction_details.harga_satuan)
                            ELSE 0 
                        END
                    ) as revenue_ret,
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                ABS(COALESCE(batch_agg.total_cogs_batch, transaction_details.jumlah * items.hargaBeli, 0))
                            ELSE 0 
                        END
                    ) as cogs_out,
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                ABS(COALESCE(batch_agg.total_cogs_batch, transaction_details.jumlah * items.hargaBeli, 0))
                            ELSE 0 
                        END
                    ) as cogs_ret
                ")
            )
            ->whereIn('transactions.type', ['OUT', 'RET'])
            ->where(function($q) {
                $q->where('transactions.sumber_tujuan', 'LIKE', '%Penjualan%')
                  ->orWhere('transactions.sumber_tujuan', 'LIKE', '%RET_IN%');
            })
            ->where('transactions.sumber_tujuan', 'NOT LIKE', '%Makloon%')
            ->whereBetween('transactions.tanggal', [$startBound, $endBound])
            ->where('transactions.status', 'completed')
            ->groupBy('transaction_details.kodeBarang', 'items.nama')
            ->get();

        $byCategory = [];
        $grandRevenue = 0;
        $grandCogs = 0;

        foreach ($analytics as $row) {
            $cat = $row->kategori;
            // Net Sales (Penjualan Bersih): Gross Sales - Total Retur Customer
            $netRevenue = (float)$row->revenue_out - (float)$row->revenue_ret;
            // Net HPP (HPP Bersih): Gross HPP DIKURANGI Total HPP retur
            $netCogs = (float)$row->cogs_out - (float)$row->cogs_ret;
            // Net Profit
            $profit = $netRevenue - $netCogs;

            $byCategory[] = [
                'name' => $cat,
                'revenue' => round($netRevenue, 2),
                'cogs' => round($netCogs, 2),
                'profit' => round($profit, 2)
            ];

            $grandRevenue += $netRevenue;
            $grandCogs += $netCogs;
        }

        // Net Profit (Laba Bersih): Net Sales - Net HPP
        $grandProfit = round($grandRevenue - $grandCogs, 2);
        
        // Margin: (Net Profit / Net Sales) * 100
        $grandMargin = (float)$grandRevenue > 0 ? round(((float)$grandProfit / (float)$grandRevenue) * 100, 2) : 0;

        return [
            'by_category' => $byCategory,
            'grand_total_revenue' => $grandRevenue,
            'grand_total_cogs' => $grandCogs,
            'grand_total_profit' => $grandProfit,
            'grand_margin_percentage' => $grandMargin
        ];
    }
}