<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportController extends Controller
{
    public function getMutasiReport(Request $request)
    {
        $startFilter = $request->get('start_date', now('Asia/Makassar')->subDays(30)->format('Y-m-d'));
        $endFilter = $request->get('end_date', now('Asia/Makassar')->format('Y-m-d'));

        $cleanStart = Carbon::parse($startFilter)->startOfDay()->format('Y-m-d H:i:s');
        $cleanEnd = Carbon::parse($endFilter)->endOfDay()->format('Y-m-d H:i:s');

        // Base query for transactions
        $baseQuery = function($types) use ($cleanStart, $cleanEnd) {
            $data = DB::table('transaction_details')
                ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
                ->whereIn('transactions.type', $types)
                ->where('transactions.status', 'completed')
                ->whereBetween('transactions.tanggal', [$cleanStart, $cleanEnd])
                ->select(
                    'transactions.idTransaksi',
                    'transactions.tanggal',
                    'transactions.entitas',
                    'transactions.sumber_tujuan',
                    'transaction_details.namaBarang',
                    'transaction_details.jumlah as qty',
                    'transaction_details.harga_satuan',
                    'transactions.totalTransaksi',
                    'transactions.keterangan'
                )
                ->orderBy('transactions.tanggal', 'asc')
                ->get();

            $grouped = [];
            foreach ($data as $row) {
                $id = $row->idTransaksi;
                if (!isset($grouped[$id])) {
                    $grouped[$id] = [
                        'idTransaksi' => $row->idTransaksi,
                        'tanggal' => $row->tanggal,
                        'entitas' => $row->entitas,
                        'sumber_tujuan' => $row->sumber_tujuan,
                        'keterangan' => $row->keterangan,
                        'items' => [],
                        'qty' => 0,
                        'total_nilai' => (float)$row->totalTransaksi, // Use totalTransaksi from table
                        'harga_satuan' => $row->harga_satuan, // store first item's price
                    ];
                }
                $grouped[$id]['items'][] = $row->namaBarang;
                $grouped[$id]['qty'] += $row->qty;
            }

            $result = [];
            foreach ($grouped as $g) {
                $itemCount = count($g['items']);
                $namaBarang = $itemCount > 1 ? $itemCount . " Jenis Barang" : $g['items'][0];
                
                $result[] = (object)[
                    'idTransaksi' => $g['idTransaksi'],
                    'tanggal' => $g['tanggal'],
                    'entitas' => $g['entitas'],
                    'sumber_tujuan' => $g['sumber_tujuan'],
                    'namaBarang' => $namaBarang,
                    'qty' => $g['qty'],
                    'harga_satuan' => $itemCount > 1 ? null : $g['harga_satuan'],
                    'total_nilai' => $g['total_nilai'],
                    'keterangan' => $g['keterangan']
                ];
            }
            return $result;
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
                'nama_barang' => $row->namaBarang,
                'qty' => (int) $row->qty,
                'harga_satuan' => (float) $row->harga_satuan,
                'total_nilai' => (float) $row->total_nilai,
                'keterangan' => $row->keterangan ?: 'Inbound / Makloon'
            ];
            $totalQtyIn += $row->qty;
            $totalNilaiIn += $row->total_nilai;
        }
        $inboundCount = count($inboundData);

        // 2. OUTBOUND (Keluar)
        $outboundRaw = $baseQuery(['OUT', 'MAKLOON_OUT']);
        $outboundData = [];
        $totalQtyOut = 0;
        $totalNilaiOut = 0;
        foreach ($outboundRaw as $row) {
            $isMakloonOut = strpos($row->idTransaksi, 'MKL-OUT') !== false;

            $outboundData[] = [
                'id_transaksi' => $row->idTransaksi,
                'tanggal' => Carbon::parse($row->tanggal)->format('d/m/Y'),
                'tujuan' => $row->entitas ?: $row->sumber_tujuan,
                'nama_barang' => $row->namaBarang,
                'qty' => (int) $row->qty,
                'harga_satuan' => (float) $row->harga_satuan,
                'total_nilai' => (float) $row->total_nilai,
                'keterangan' => $row->keterangan ?: 'Distribusi / Makloon'
            ];
            $totalQtyOut += $row->qty;
            if (!$isMakloonOut) {
                $totalNilaiOut += $row->total_nilai;
            }
        }
        $outboundCount = count($outboundData);

        // 3. RETURNS (Retur & Reject)
        $returnsRaw = $baseQuery(['RET']);
        $returnsData = [];
        $totalQtyRet = 0;
        $totalNilaiRet = 0;
        
        $retInQty = 0;
        $retInNilai = 0;
        $retOutQty = 0;
        $retOutNilai = 0;

        foreach ($returnsRaw as $row) {
            $isRetOut = strpos($row->idTransaksi, 'RET-OUT') !== false || strpos($row->sumber_tujuan, 'RET_OUT') !== false || $row->sumber_tujuan === 'Return ke Vendor';
            
            $returnsData[] = [
                'id_transaksi' => $row->idTransaksi,
                'tanggal' => Carbon::parse($row->tanggal)->format('d/m/Y'),
                'asal_retur' => $row->entitas ?: $row->sumber_tujuan,
                'nama_barang' => $row->namaBarang,
                'qty' => (int) $row->qty,
                'kondisi' => $row->sumber_tujuan,
                'estimasi_nilai' => (float) $row->total_nilai,
                'tindakan' => $row->keterangan ?: 'Retur'
            ];
            $totalQtyRet += $row->qty;
            $totalNilaiRet += $row->total_nilai;

            if ($isRetOut) {
                $retOutQty += $row->qty;
                $retOutNilai += $row->total_nilai;
            } else {
                $retInQty += $row->qty;
                $retInNilai += $row->total_nilai;
            }
        }
        $returnsCount = count($returnsData);

        // Sesuaikan nilai Inbound & Outbound berdasarkan logika Dashboard
        $totalQtyIn -= $retOutQty;
        $totalNilaiIn -= $retOutNilai;
        $totalQtyOut -= $retInQty;
        $totalNilaiOut -= $retInNilai;

        // 4. NET MUTASI STOK
        $netMutasiQty = $totalQtyIn - $totalQtyOut;
        $netMutasiNilai = $totalNilaiIn - $totalNilaiOut;

        return response()->json([
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
        ]);
    }
}
