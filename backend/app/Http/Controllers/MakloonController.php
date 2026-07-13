<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\MakloonOrder;
use App\Services\MakloonService;
use Illuminate\Support\Str;
use App\Traits\HasSystemLogs;

class MakloonController extends Controller
{
    use HasSystemLogs;
    protected $makloonService;
    protected $idGenerator;

    public function __construct(MakloonService $makloonService, \App\Services\IdGeneratorService $idGenerator)
    {
        $this->makloonService = $makloonService;
        $this->idGenerator = $idGenerator;
    }

    public function index()
    {
        try {
            $orders = MakloonOrder::with(['vendor', 'product'])->orderBy('created_at', 'desc')->get();
            return response()->json($orders);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'id_vendor' => 'required|string',
            'kode_produk' => 'required|string',
            'target_qty' => 'required|integer|min:1'
        ]);

        try {
            $woNumber = $this->idGenerator->generateMakloonWoNumber();
            
            $order = MakloonOrder::create([
                'wo_number' => $woNumber,
                'id_vendor' => $request->id_vendor,
                'kode_produk' => $request->kode_produk,
                'target_qty' => $request->target_qty,
                'status' => 'Pending'
            ]);

            return response()->json(['message' => 'Makloon Order berhasil dibuat', 'data' => $order], 201);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function send(Request $request, $id)
    {
        try {
            $order = MakloonOrder::findOrFail($id);
            $this->makloonService->sendToVendor($order);
            
            // TASK 2: Inject Dynamic Logging for Makloon Out
            $transaction = \App\Models\Transaction::with('details')->where('type', 'MAKLOON_OUT')
                ->where('keterangan', 'like', "%{$order->wo_number}%")
                ->orderBy('created_at', 'desc')->first();
                
            if ($transaction) {
                $summary = collect($transaction->details)->map(function ($item) { 
                    return $item->namaBarang . ' (' . $item->jumlah . ')'; 
                })->implode(', ');
                
                $logDesc = sprintf("Makloon Keluar (Kirim Bahan Baku): %s - %s", $transaction->idTransaksi, $summary);
                $logUser = $request->log_user ?? (auth()->user() ? (auth()->user()->namaLengkap ?? auth()->user()->username) : 'System');
                
                $this->writeLog($logUser, 'CREATE', 'transactions', $logDesc);
            }
            
            return response()->json(['message' => 'Bahan baku berhasil dikirim ke vendor']);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function receive(Request $request, $id)
    {
        $request->validate([
            'received_qty' => 'required|numeric|min:1',
            'harga_satuan' => 'nullable|numeric|min:0',
            'pajak_persen' => 'nullable|numeric|min:0',
            'pajak_nominal' => 'nullable|numeric|min:0',
            'total_transaksi' => 'nullable|numeric|min:0',
            'lokasi_tujuan' => 'required|string',
        ]);

        try {
            $order = MakloonOrder::findOrFail($id);
            $this->makloonService->receiveFromVendor($order, $request->received_qty, [
                'harga_satuan' => $request->input('harga_satuan', 0),
                'pajak_persen' => $request->input('pajak_persen', 0),
                'pajak_nominal' => $request->input('pajak_nominal', 0),
                'total_transaksi' => $request->input('total_transaksi', 0),
                'lokasi_tujuan' => $request->input('lokasi_tujuan'),
            ]);
            
            // TASK 3: Inject Dynamic Logging for Makloon In
            $transaction = \App\Models\Transaction::with('details')->where('type', 'MAKLOON_IN')
                ->where('target_kode_barang', $order->kode_produk)
                ->where('keterangan', 'like', "%{$order->wo_number}%")
                ->orderBy('created_at', 'desc')->first();
                
            if ($transaction) {
                $summary = collect($transaction->details)->map(function ($item) { 
                    return $item->namaBarang . ' (' . $item->jumlah . ')'; 
                })->implode(', ');
                
                $logDesc = sprintf("Makloon Masuk (Terima Barang Jadi): %s - %s", $transaction->idTransaksi, $summary);
                $logUser = $request->log_user ?? (auth()->user() ? (auth()->user()->namaLengkap ?? auth()->user()->username) : 'System');
                
                $this->writeLog($logUser, 'CREATE', 'transactions', $logDesc);
            }
            
            return response()->json(['message' => 'Barang jadi berhasil diterima dari vendor']);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }
}
