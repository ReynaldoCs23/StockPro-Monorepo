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
        $cacheTTL = 60 * 5; // Cache for 5 minutes

        $dashboardData = \Illuminate\Support\Facades\Cache::remember($cacheKey, $cacheTTL, function () use ($cleanStart, $cleanEnd, $startFilter, $endFilter) {
            // --- DYNAMIC DASHBOARD ANALYTICS CLOSURES ---
            $durationDays = \Carbon\Carbon::parse($startFilter)->diffInDays(\Carbon\Carbon::parse($endFilter)) + 1;
            $prevStartDate = \Carbon\Carbon::parse($startFilter)->subDays($durationDays)->format('Y-m-d');
            $prevEndDate = \Carbon\Carbon::parse($endFilter)->subDays($durationDays)->format('Y-m-d');

            $getQtyMasuk = function($start, $end) {
                return (int) DB::table('transaction_details')
                    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                    ->whereBetween('transactions.tanggal', [$start, $end])
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
                    ->value(DB::raw("
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'INV-OUT%' THEN totalTransaksi ELSE 0 END), 0) 
                        +
                        COALESCE(SUM(CASE WHEN idTransaksi LIKE 'MKL-OUT%' THEN totalTransaksi ELSE 0 END), 0) 
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
            $estimatedProfit = $profitAnalytics['grand_total_profit'];

            // 4. Data Grafik Arus Kas & Laba Harian
            $dailyTotals = DB::table('transactions')
                ->select(
                    DB::raw('DATE(tanggal) as date'),
                    DB::raw("SUM(CASE WHEN idTransaksi LIKE 'INV-OUT%' THEN totalTransaksi ELSE 0 END) + SUM(CASE WHEN idTransaksi LIKE 'MKL-OUT%' THEN totalTransaksi ELSE 0 END) - SUM(CASE WHEN idTransaksi LIKE 'RET-IN%' THEN totalTransaksi ELSE 0 END) as net_daily_revenue"),
                    DB::raw("SUM(CASE WHEN idTransaksi LIKE 'INV-IN%' THEN totalTransaksi ELSE 0 END) + SUM(CASE WHEN idTransaksi LIKE 'MKL-IN%' THEN totalTransaksi ELSE 0 END) - SUM(CASE WHEN idTransaksi LIKE 'RET-OUT%' THEN totalTransaksi ELSE 0 END) as pengeluaran_vendor")
                )
                ->whereBetween('tanggal', [$cleanStart, $cleanEnd])
                ->groupBy('date')
                ->get()
                ->keyBy('date');

            $dailyAnalytics = DB::table('transaction_details')
                ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                ->leftJoin('item_batches', function($join) {
                    $join->on('item_batches.kodeBarang', '=', 'transaction_details.kodeBarang');
                })
                ->leftJoin('transaction_batch_details', function($join) {
                    $join->on('transaction_batch_details.idTransaksi', '=', 'transactions.idTransaksi')
                         ->on('transaction_batch_details.id_batch', '=', 'item_batches.id_batch');
                })
                ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
                ->select(
                    DB::raw('DATE(transactions.tanggal) as date'),
                    DB::raw("
                        SUM(
                            CASE 
                                WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                    ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                                WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                    -ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                                ELSE 0 
                            END
                        ) as net_daily_cogs
                    ")
                )
                ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                ->whereRaw('(item_batches.kodeBarang = transaction_details.kodeBarang OR item_batches.id_batch IS NULL)')
                ->groupBy('date')
                ->get()
                ->keyBy('date');

            $chartData = [];
            $period = \Carbon\CarbonPeriod::create($cleanStart, $cleanEnd);
            foreach ($period as $date) {
                $dateStr = $date->toDateString();
                $dTotal = $dailyTotals->get($dateStr);
                $daily = $dailyAnalytics->get($dateStr);
                
                $pemasukan = $dTotal ? (float)$dTotal->net_daily_revenue : 0;
                $cogs = $daily ? (float)$daily->net_daily_cogs : 0;
                $pengeluaran = $dTotal ? (float)$dTotal->pengeluaran_vendor : 0;
                $net_daily_profit = $pemasukan - $cogs;
                
                $chartData[] = [
                    'Tanggal' => $dateStr,
                    'Hari' => $date->format('d'),
                    'Pemasukan' => $pemasukan,
                    'Pengeluaran' => $pengeluaran,
                    'net_daily_revenue' => $pemasukan,
                    'net_daily_cogs' => $cogs,
                    'net_daily_profit' => $net_daily_profit,
                ];
            }

            // 5. Profit per Kategori & Donut Chart (derived from centralized source)
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
                    DB::raw('SUM(transaction_details.jumlah) as total_sold')
                )
                ->where('transactions.type', 'OUT')
                ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                ->groupBy('items.kodeBarang', 'items.nama', 'items.stok')
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
            $stokDibooking = DB::table('items')->sum('stok_booking');

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
        // Calculate Net Revenue and Net COGS per category directly in SQL
        $analytics = DB::table('transaction_details')
            ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
            ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
            ->leftJoin('transaction_batch_details', 'transactions.idTransaksi', '=', 'transaction_batch_details.idTransaksi')
            ->leftJoin('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
            ->select(
                DB::raw('COALESCE(NULLIF(items.kategori, ""), "Lainnya") as kategori'),
                // Net Revenue = SUM(OUT Revenue) - SUM(RET Revenue)
                // Note: We use qty_diambil / jumlah fallback carefully to avoid duplicate row inflation if multiple batches exist. 
                // Since revenue is tied to the detail row, we allocate it proportionally to the batch qty to prevent inflation.
                DB::raw("
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * transaction_details.harga_satuan)
                            ELSE 0 
                        END
                    ) as revenue_out,
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * transaction_details.harga_satuan)
                            ELSE 0 
                        END
                    ) as revenue_ret,
                    SUM(
                        CASE 
                            WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                                ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                            WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                                -ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                            ELSE 0 
                        END
                    ) as net_cogs
                ")
            )
            ->whereIn('transactions.type', ['OUT', 'RET'])
            ->where(function($q) {
                $q->where('transactions.sumber_tujuan', 'LIKE', '%Penjualan%')
                  ->orWhere('transactions.sumber_tujuan', 'LIKE', '%RET_IN%');
            })
            ->where('transactions.sumber_tujuan', 'NOT LIKE', '%Makloon%')
            ->whereRaw('(item_batches.kodeBarang = transaction_details.kodeBarang OR item_batches.id_batch IS NULL)')
            ->whereBetween('transactions.tanggal', [$startBound, $endBound])
            ->groupBy('kategori')
            ->get();

        $byCategory = [];
        $grandRevenue = 0;
        $grandCogs = 0;

        foreach ($analytics as $row) {
            $cat = $row->kategori;
            // Calculate Net Revenue
            $netRevenue = (float)$row->revenue_out - (float)$row->revenue_ret;
            $netCogs = (float)$row->net_cogs; // Already handled deductions in SQL
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

        $grandProfit = round($grandRevenue - $grandCogs, 2);
        
        // Phase 3: Division by Zero Prevention for Margin
        $grandMargin = $grandRevenue > 0 ? round(($grandProfit / $grandRevenue) * 100, 2) : 0;

        return [
            'grand_total_revenue' => $grandRevenue,
            'grand_total_cogs' => $grandCogs,
            'grand_total_profit' => $grandProfit,
            'grand_total_margin' => $grandMargin,
            'by_category' => collect(array_values($byCategory)),
        ];
    }
}