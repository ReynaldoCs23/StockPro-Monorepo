<?php

namespace App\Http\Controllers;

use App\Services\MutasiReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends Controller
{
    use \App\Traits\HasSystemLogs;

    public function getMutasiReport(Request $request, MutasiReportService $service)
    {
        $startFilter = $request->get('start_date', now('Asia/Makassar')->subDays(30)->format('Y-m-d'));
        $endFilter = $request->get('end_date', now('Asia/Makassar')->format('Y-m-d'));

        // v4: + rincian Subtotal/DPP/PPN/Total di akhir tiap bagian
        $cacheKey = "report_mutasi_v4_{$startFilter}_{$endFilter}";
        $responseData = Cache::remember($cacheKey, 300, fn () => $service->build($startFilter, $endFilter));

        $this->writeLog(auth()->user()->namaLengkap ?? 'System', 'READ', 'reports', "Mencetak/Mengakses Laporan Mutasi periode {$startFilter} s.d {$endFilter}");

        return response()->json($responseData);
    }
}
