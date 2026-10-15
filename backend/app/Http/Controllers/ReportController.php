<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportController extends Controller
{
    use \App\Traits\HasSystemLogs;

    public function getMutasiReport(Request $request)
    {
        $startFilter = $request->get('start_date', now('Asia/Makassar')->subDays(30)->format('Y-m-d'));
        $endFilter = $request->get('end_date', now('Asia/Makassar')->format('Y-m-d'));

        $cleanStart = Carbon::parse($startFilter)->startOfDay()->format('Y-m-d H:i:s');
        $cleanEnd = Carbon::parse($endFilter)->endOfDay()->format('Y-m-d H:i:s');

        $cacheKey = "report_mutasi_{$cleanStart}_{$cleanEnd}";
        $responseData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 300, function () use ($cleanStart, $cleanEnd, $startFilter, $endFilter) {
            // Base query — grouping dilakukan 100% di MySQL, bukan di PHP (hemat RAM)
            $baseQuery = function($types) use ($cleanStart, $cleanEnd) {
                return DB::table('transaction_details')
                    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                    ->whereIn('transactions.type', $types)
                    ->where('transactions.status', 'completed')
                    ->whereNull('transactions.deleted_at')
                    ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                    ->select(
                        'transactions.idTransaksi',
                        'transactions.tanggal',
                        'transactions.entitas',
                        'transactions.sumber_tujuan',
                        'transactions.totalTransaksi as total_nilai',
                        'transactions.keterangan',
                        DB::raw('SUM(transaction_details.jumlah) as qty'),
                        DB::raw('COUNT(transaction_details.id) as item_count'),
                        DB::raw('CASE WHEN COUNT(transaction_details.id) = 1 THEN MAX(transaction_details.namaBarang) ELSE CONCAT(COUNT(transaction_details.id), " Jenis Barang") END as namaBarang'),
                        DB::raw('CASE WHEN COUNT(transaction_details.id) = 1 THEN MAX(transaction_details.harga_satuan) ELSE NULL END as harga_satuan')
                    )
                    ->groupBy(
                        'transactions.idTransaksi',
                        'transactions.tanggal',
                        'transactions.entitas',
                        'transactions.sumber_tujuan',
                        'transactions.totalTransaksi',
                        'transactions.keterangan'
                    )
                    ->orderBy('transactions.tanggal', 'asc')
                    ->get()
                    ->all();
            };

            // 1. INBOUND (Masuk)
            $inboundRaw = $baseQuery(['IN', 'MAKLOON_IN']);
            $inboundData = [];
            $totalQtyIn = 0;
            $totalNilaiIn = 0;
            foreach ($inboundRaw as $row) {
                $inboundData[] = [
                    'id_transaksi' => $row->idTransaksi,
                    'tanggal' => Carbon::parse($row->tanggal)->format('d/m/Y'),
                    'sumber' => $row->entitas ?: $row->sumber_tujuan,
                    'keterangan' => $row->keterangan ?: 'Barang Masuk',
                    'qty' => (float) $row->qty,
                    'harga_satuan' => $row->harga_satuan ? (float) $row->harga_satuan : null,
                    'total_nilai' => (float) $row->total_nilai,
                    'nama_barang' => $row->namaBarang
                ];
                $totalQtyIn += (float) $row->qty;
                $totalNilaiIn += (float) $row->total_nilai;
            }
            $inboundCount = count($inboundData);

            // 2. OUTBOUND (Keluar)
            $outboundRaw = $baseQuery(['OUT', 'MAKLOON_OUT']);
            $outboundData = [];
            $totalQtyOut = 0;
            $totalNilaiOut = 0;
            foreach ($outboundRaw as $row) {
                $outboundData[] = [
                    'id_transaksi' => $row->idTransaksi,
                    'tanggal' => Carbon::parse($row->tanggal)->format('d/m/Y'),
                    'tujuan' => $row->entitas ?: $row->sumber_tujuan,
                    'keterangan' => $row->keterangan ?: 'Barang Keluar',
                    'qty' => (float) $row->qty,
                    'harga_satuan' => $row->harga_satuan ? (float) $row->harga_satuan : null,
                    'total_nilai' => (float) $row->total_nilai,
                    'nama_barang' => $row->namaBarang
                ];
                $totalQtyOut += (float) $row->qty;
                $totalNilaiOut += (float) $row->total_nilai;
            }
            $outboundCount = count($outboundData);

            $returnsRaw = $baseQuery(['RET']);
            $returnsData = [];
            $totalQtyRet = 0;
            $totalNilaiRet = 0;
            foreach ($returnsRaw as $row) {
                $isRetIn = str_contains($row->idTransaksi, 'RET-IN');
                $isPengembalianGalon = ($row->sumber_tujuan === 'pengembalian_galon');
                
                $tipeReturn = $isRetIn ? 'Return Inbound' : 'Return Outbound';
                if ($isPengembalianGalon) {
                    $tipeReturn = 'Pengembalian Galon (Kosong)';
                }

                $returnsData[] = [
                    'id_transaksi' => $row->idTransaksi,
                    'tanggal' => Carbon::parse($row->tanggal)->format('d/m/Y'),
                    'tipe' => $tipeReturn,
                    'asal_retur' => $row->entitas ?: '-',
                    'kondisi' => 'Sesuai SOP Retur',
                    'tindakan' => $row->keterangan ?: 'Return Barang',
                    'qty' => (float) $row->qty,
                    'estimasi_nilai' => (float) $row->total_nilai,
                    'nama_barang' => $row->namaBarang
                ];
                
                // HANYA hitung RET-IN dan BUKAN pengembalian galon
                if ($isRetIn && !$isPengembalianGalon) {
                    $totalQtyRet += (float) $row->qty;
                    $totalNilaiRet += (float) $row->total_nilai;
                }
            }
            $returnsCount = count($returnsData);

            // NET TOTALS
            // Berdasarkan instruksi user: Inbound - Outbound - Total Retur
            $netMutasiQty = $totalQtyIn - $totalQtyOut - $totalQtyRet;
            $netMutasiNilai = $totalNilaiIn - $totalNilaiOut - $totalNilaiRet;

            return [
                'periode' => [
                    'start' => Carbon::parse($startFilter)->format('d/m/Y'),
                    'end' => Carbon::parse($endFilter)->format('d/m/Y')
                ],
                'summary' => [
                    'inbound' => [
                        'qty' => $totalQtyIn,
                        'nilai' => $totalNilaiIn,
                        'count' => $inboundCount
                    ],
                    'outbound' => [
                        'qty' => $totalQtyOut,
                        'nilai' => $totalNilaiOut,
                        'count' => $outboundCount
                    ],
                    'returns' => [
                        'qty' => $totalQtyRet,
                        'nilai' => $totalNilaiRet,
                        'count' => $returnsCount
                    ],
                    'net' => [
                        'qty' => $netMutasiQty,
                        'nilai' => $netMutasiNilai,
                        'status' => $netMutasiQty >= 0 ? 'Surplus' : 'Defisit'
                    ]
                ],
                'inbound_data' => $inboundData,
                'outbound_data' => $outboundData,
                'returns_data' => $returnsData
            ];
        });

        $this->writeLog(auth()->user()->namaLengkap ?? 'System', 'READ', 'reports', "Mencetak/Mengakses Laporan Mutasi periode {$startFilter} s.d {$endFilter}");

        return response()->json($responseData);
    }
}
