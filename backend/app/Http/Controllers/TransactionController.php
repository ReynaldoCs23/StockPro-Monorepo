<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Traits\HasSystemLogs;
use App\Events\StokUpdated;

class TransactionController extends Controller {
    use HasSystemLogs;

    public function index(Request $request)
    {
        $category = $request->query('category', 'inbound'); // inbound, outbound, return
        $filter = $request->query('filter');

        $startDate = $request->get('start_date', Carbon::today('Asia/Makassar')->subMonth()->format('Y-m-d'));
        $endDate = $request->get('end_date', Carbon::today('Asia/Makassar')->format('Y-m-d'));

        $query = DB::table('transactions');
        
        if ($request->query('recent_only') !== 'true') {
            if (!empty($startDate)) {
                $parsedStart = \Carbon\Carbon::parse($startDate)->format('Y-m-d');
                $query->whereDate('transactions.tanggal', '>=', $parsedStart);
            }
            if (!empty($endDate)) {
                $parsedEnd = \Carbon\Carbon::parse($endDate)->format('Y-m-d');
                $query->whereDate('transactions.tanggal', '<=', $parsedEnd);
            }
        }

        $query->leftJoin('transaction_details', 'transactions.idTransaksi', '=', 'transaction_details.idTransaksi')
            ->select(
                'transactions.*',
                DB::raw('COALESCE(SUM(transaction_details.jumlah), 0) as jumlah'),
                DB::raw('COUNT(transaction_details.id) as total_item')
            )
            ->groupBy(
                'transactions.idTransaksi', 'transactions.type', 'transactions.tanggal', 
                'transactions.sumber_tujuan', 'transactions.entitas', 'transactions.totalTransaksi',
                'transactions.pajak_persen', 'transactions.pajak_nominal',
                'transactions.idReferensi', 'transactions.keterangan', 'transactions.created_at', 
                'transactions.updated_at'
            )
            ->orderBy('transactions.created_at', 'desc');

        // ENFORCE STRICT CATEGORY SEGREGATION
        if ($category === 'inbound') {
            $query->where(function($q) {
                $q->whereIn('transactions.type', ['IN', 'MAKLOON_IN'])
                  ->orWhere('transactions.idTransaksi', 'LIKE', 'INV-IN%')
                  ->orWhere('transactions.idTransaksi', 'LIKE', 'MKL-IN%');
            })->where('transactions.type', '!=', 'RET')
              ->where('transactions.idTransaksi', 'NOT LIKE', 'RET%');
        } elseif ($category === 'outbound') {
            $query->where(function($q) {
                $q->whereIn('transactions.type', ['OUT', 'MAKLOON_OUT'])
                  ->orWhere('transactions.idTransaksi', 'LIKE', 'INV-OUT%')
                  ->orWhere('transactions.idTransaksi', 'LIKE', 'MKL-OUT%');
            })->where('transactions.type', '!=', 'RET')
              ->where('transactions.idTransaksi', 'NOT LIKE', 'RET%');
        } elseif ($category === 'return') {
            $query->where(function($q) {
                $q->where('transactions.type', 'RET')
                  ->orWhere('transactions.idTransaksi', 'LIKE', 'RET%');
            });
        }

        // APPLY OPTIONAL SUB-FILTERS
        if (!empty($filter) && $filter !== 'all') {
            if ($category === 'inbound') {
                if ($filter === 'supplier') {
                    $query->where('transactions.idTransaksi', 'LIKE', 'INV-IN%');
                } elseif ($filter === 'makloon') {
                    $query->where('transactions.idTransaksi', 'LIKE', 'MKL-IN%');
                }
            } elseif ($category === 'outbound') {
                if ($filter === 'customer') {
                    $query->where('transactions.idTransaksi', 'LIKE', 'INV-OUT%');
                } elseif ($filter === 'makloon') {
                    $query->where('transactions.idTransaksi', 'LIKE', 'MKL-OUT%');
                }
            } elseif ($category === 'return') {
                if ($filter === 'MASUK') {
                    $query->where(function($q) {
                        $q->where('transactions.sumber_tujuan', 'LIKE', 'RET_IN%')
                          ->orWhere('transactions.idTransaksi', 'LIKE', 'RET-IN%')
                          ->orWhere('transactions.sumber_tujuan', '=', 'Return dari Customer');
                    });
                } elseif ($filter === 'KELUAR') {
                    $query->where(function($q) {
                        $q->where('transactions.sumber_tujuan', 'LIKE', 'RET_OUT%')
                          ->orWhere('transactions.idTransaksi', 'LIKE', 'RET-OUT%')
                          ->orWhere('transactions.sumber_tujuan', '=', 'Return ke Vendor');
                    });
                }
            } else {
                $query->where('transactions.type', $filter);
            }
        }

        if ($request->query('recent_only') === 'true') {
            $query->where('transactions.tanggal', '>=', now()->subDays(7));
        }

        $companyProfile = \App\Models\CompanyProfile::first();

        $paginator = $query->paginate(10);
        
        // --- BULK LOAD DATA TO PREVENT N+1 QUERY PROBLEM ---
        $transactionIds = collect($paginator->items())->pluck('idTransaksi')->toArray();
        $allDetails = DB::table('transaction_details')
            ->whereIn('idTransaksi', $transactionIds)
            ->get()
            ->groupBy('idTransaksi');

        $allBatchesInbound = collect();
        if ($category === 'inbound') {
            $allBatchesInbound = DB::table('item_batches')
                ->whereIn('idTransaksi_masuk', $transactionIds)
                ->get()
                ->groupBy(function($item) {
                    return $item->idTransaksi_masuk . '_' . $item->kodeBarang;
                });
        }

        $allMasterItems = collect();
        if ($category === 'outbound' || $category === 'return') {
            $itemCodes = DB::table('transaction_details')
                ->whereIn('idTransaksi', $transactionIds)
                ->pluck('kodeBarang')->unique()->toArray();
            $allMasterItems = DB::table('items')->whereIn('kodeBarang', $itemCodes)->get()->keyBy('kodeBarang');
        }

        $allRefTransactions = collect();
        $allRefDetails = collect();
        $allBatchTraces = collect();
        $allOriginalInbounds = collect();
        if ($category === 'return') {
            $refIds = collect($paginator->items())->pluck('idReferensi')->filter()->unique()->toArray();
            if (!empty($refIds)) {
                $allRefTransactions = DB::table('transactions')->whereIn('idTransaksi', $refIds)->get()->keyBy('idTransaksi');
                $allRefDetails = DB::table('transaction_details')->whereIn('idTransaksi', $refIds)->get()->groupBy('idTransaksi');
            }

            // For tracking original vendor/customer if entityName is null
            $traceIds = collect($paginator->items())->map(fn($t) => $t->idReferensi ?: $t->idTransaksi)->unique()->toArray();
            if (!empty($traceIds)) {
                $allBatchTraces = DB::table('transaction_batch_details')->whereIn('idTransaksi', $traceIds)->get()->keyBy('idTransaksi');
                $batchIds = $allBatchTraces->pluck('id_batch')->filter()->unique()->toArray();
                if (!empty($batchIds)) {
                    $batches = DB::table('item_batches')->whereIn('id_batch', $batchIds)->get();
                    $inboundIds = $batches->pluck('idTransaksi_masuk')->filter()->unique()->toArray();
                    if (!empty($inboundIds)) {
                        $allOriginalInbounds = DB::table('transactions')->whereIn('idTransaksi', $inboundIds)->get()->keyBy('idTransaksi');
                    }
                    $allBatchTraces = $allBatchTraces->map(function($trace) use ($batches) {
                        $trace->batch = $batches->firstWhere('id_batch', $trace->id_batch);
                        return $trace;
                    });
                }
            }
        }
        // --- END BULK LOAD ---

        $paginator->getCollection()->transform(function($t) use ($category, $companyProfile, $allDetails, $allBatchesInbound, $allMasterItems, $allRefTransactions, $allRefDetails, $allBatchTraces, $allOriginalInbounds) {
            $items = $allDetails->get($t->idTransaksi, collect());
            
            if ($category === 'inbound') {
                $items = $items->map(function($item) use ($t, $allBatchesInbound) {
                    $key = $t->idTransaksi . '_' . $item->kodeBarang;
                    $batch = $allBatchesInbound->get($key)?->first();
                    $item->lokasi_asal = $batch ? $batch->lokasi_rak : '';
                    return $item;
                });
                $t->sumber = $t->sumber_tujuan;
                $t->namaSupplier = $t->entitas;
            } elseif ($category === 'outbound') {
                $items = $items->map(function($item) use ($allMasterItems) {
                    if (floatval($item->harga_satuan) == 0) {
                        $master = $allMasterItems->get($item->kodeBarang);
                        $item->harga_satuan = $master->hargaJual ?? 0;
                    }
                    return $item;
                });
                $t->tujuan = $t->sumber_tujuan;
                $t->namaPembeli = $t->entitas;
            } elseif ($category === 'return') {
                // Attach master item names and prices
                $items = $items->map(function($item) use ($allMasterItems) {
                    $master = $allMasterItems->get($item->kodeBarang);
                    $item->item_nama = $master->nama ?? null;
                    $item->hargaJual = $master->hargaJual ?? null;
                    $item->hargaBeli = $master->hargaBeli ?? null;
                    return $item;
                });
                
                $entityName = $t->entitas;
                $resolvedParty = null;

                if ($t->idReferensi) {
                    $refTrx = $allRefTransactions->get($t->idReferensi);
                    if ($refTrx) {
                        $entityName = $entityName ?: $refTrx->entitas;
                        $t->original_id = $refTrx->idTransaksi;
                        $t->originalTotal = $refTrx->totalTransaksi;
                        $t->pajak_persen = $refTrx->pajak_persen;

                        $refDetails = $allRefDetails->get($t->idReferensi, collect())->keyBy('kodeBarang');
                        
                        $returnSubtotal = 0;
                        $items = $items->map(function($item) use ($refDetails, &$returnSubtotal) {
                            if ($refDetails->has($item->kodeBarang)) {
                                $item->harga_satuan = $refDetails->get($item->kodeBarang)->harga_satuan;
                            } else {
                                $item->harga_satuan = $item->harga_satuan ?: ($item->hargaJual ?: ($item->hargaBeli ?: 0));
                            }
                            $returnSubtotal += ($item->jumlah * $item->harga_satuan);
                            return $item;
                        });

                        $t->returnSubtotal = $returnSubtotal;
                        $t->returnTax = $returnSubtotal * ($t->pajak_persen / 100);
                        $t->returnGrandTotal = $t->returnSubtotal + $t->returnTax;
                    }
                }

                if ($entityName) {
                    $resolvedParty = ['nama' => $entityName];
                } else {
                    $firstItem = $items->first();
                    if ($firstItem) {
                        $traceId = $t->idReferensi ?: $t->idTransaksi;
                        $batchTrace = $allBatchTraces->get($traceId);
                        if ($batchTrace && isset($batchTrace->batch) && $batchTrace->batch->idTransaksi_masuk) {
                            $originalInbound = $allOriginalInbounds->get($batchTrace->batch->idTransaksi_masuk);
                            if ($originalInbound && $originalInbound->entitas) {
                                $entityName = $originalInbound->entitas;
                                $resolvedParty = ['nama' => $entityName];
                            }
                        }
                    }
                }

                $t->entitas = $entityName;
                $t->jenisReturn = $t->sumber_tujuan;
                $t->resolved_party = $resolvedParty ? (object) $resolvedParty : null;
            }

            $isi_transaksi_detail = $items->map(function($item) {
                $nama = $item->namaBarang ?? $item->item_nama ?? '-';
                return $nama . ' (' . $item->jumlah . ')';
            })->implode(', ');

            return [...(array)$t, 'items' => $items, 'isi_transaksi_detail' => $isi_transaksi_detail, 'company_profile' => $companyProfile];
        });

        return response()->json($paginator);
    }

    public function makloonReferences()
    {
        $used = DB::table('transactions')
            ->where('type', 'IN')
            ->whereNotNull('idReferensi')
            ->where('idReferensi', 'like', 'MKL-OUT%')
            ->pluck('idReferensi');

        $refs = \App\Models\Transaction::with('targetItem', 'details')
            ->where('type', 'OUT')
            ->where('idTransaksi', 'like', 'MKL-OUT%')
            ->whereNotNull('target_kode_barang')
            ->whereNotIn('idTransaksi', $used)
            ->orderBy('tanggal', 'desc')
            ->get();

        return response()->json($refs);
    }

    public function store(Request $request, $type) {
        if (in_array($type, ['IN', 'OUT', 'RET'])) {
            $request->validate([
                'items' => 'required|array|min:1',
                'items.*.kodeBarang' => 'required|string',
                'items.*.jumlah' => 'required|numeric|min:0.01',
                'items.*.lokasi_asal' => 'nullable|string',
                'items.*.lokasi_tujuan' => 'nullable|string',
            ]);
        }

        // Validate RET_IN qty_to_return does not exceed original sale qty
        if ($type === 'RET' && $request->idReferensi) {
            $retJenis = $request->jenisReturn ?? ($request->sumber_tujuan ?? '');
            if (str_starts_with($retJenis, 'RET_IN_RETURN_CUSTOMER') || str_starts_with($retJenis, 'RET_OUT')) {
                $refDetails = DB::table('transaction_details')
                    ->where('idTransaksi', $request->idReferensi)->get()->keyBy('kodeBarang');
                foreach ($request->items as $item) {
                    $refItem = $refDetails->get($item['kodeBarang']);
                    if ($refItem && $item['jumlah'] > $refItem->jumlah) {
                        return response()->json([
                            'status' => 'error',
                            'message' => "Qty return untuk {$item['kodeBarang']} ({$item['jumlah']}) melebihi qty asli ({$refItem->jumlah})."
                        ], 400);
                    }
                }
            }
        }

        // Validate OUT / RET_OUT Stock Availability
        if ($type === 'OUT' || (isset($request->jenisReturn) && str_starts_with($request->jenisReturn, 'RET_OUT'))) {
            foreach ($request->items as $item) {
                $itemMaster = DB::table('items')->where('kodeBarang', $item['kodeBarang'])->first();
                if ($itemMaster) {
                    $satuanTransaksi = $item['satuan_transaksi'] ?? null;
                    $multiplier = 1;
                    if ($satuanTransaksi && $satuanTransaksi === $itemMaster->satuan_besar) {
                        $multiplier = max(1, intval($itemMaster->rasio_konversi ?? 1));
                    }
                    $jumlahTransaksi = intval($item['jumlah_transaksi'] ?? $item['jumlah']);
                    $requested_qty = isset($item['jumlah_transaksi']) ? $jumlahTransaksi * $multiplier : intval($item['jumlah']);
                    
                    $available_stock = $itemMaster->stok - ($itemMaster->stok_booking ?? 0);
                    if ($requested_qty > $available_stock) {
                        return response()->json([
                            'status' => 'error',
                            'message' => 'Insufficient stock'
                        ], 400);
                    }
                }
            }
        }

        DB::beginTransaction();
        try {
            $payload = $request->except(['log_user', 'log_detail']);
            
            $payload['tanggal'] = !empty($request->tanggal) 
                ? \Carbon\Carbon::parse($request->tanggal)->format('Y-m-d') 
                : \Carbon\Carbon::now('Asia/Makassar')->format('Y-m-d');
            
            // Cek apakah ini mode Edit (idTransaksi sudah ada)
            $existing = null;
            if (isset($payload['idTransaksi'])) {
                $existing = DB::table('transactions')->where('idTransaksi', $payload['idTransaksi'])->first();
            }

            if ($existing) {
                // Wajib revert stok lama agar tidak double counting
                $this->revertTransaction($payload['idTransaksi']);
                $payload['created_at'] = $existing->created_at;
            } else {
                $idGenerator = new \App\Services\IdGeneratorService();
                $returnType = $payload['jenisReturn'] ?? null;

                // Determine if this is a Makloon transaction BEFORE generating ID
                $isMakloon = str_contains(strtolower($payload['tujuan'] ?? ''), 'makloon') || 
                             str_contains(strtolower($payload['sumber'] ?? ''), 'makloon');

                if ($isMakloon) {
                    $makloonType = ($type === 'IN') ? 'MAKLOON_IN' : 'MAKLOON_OUT';
                    $generatedId = $idGenerator->generateTransactionId($makloonType);
                } else {
                    $generatedId = $idGenerator->generateTransactionId($type, $returnType);
                }

                $payload['idTransaksi'] = $generatedId;
            }
            
            $this->applyTransaction($type, $payload); 
            
            $itemSummary = collect($request->items)->map(function ($item) { 
                $qty = $item['jumlah_transaksi'] ?? $item['jumlah'] ?? 0;
                $nama = $item['namaBarang'] ?? 'Unknown Item';
                return $nama . ' (' . $qty . ')'; 
            })->implode(', ');
            
            $actionWord = $existing ? 'Update' : 'Input';
            $typeDesc = $type === 'IN' ? 'Kedatangan Barang' : ($type === 'OUT' ? 'Pengeluaran Barang' : 'Return Barang');
            $customLogDetail = "{$actionWord} {$typeDesc}: {$payload['idTransaksi']} - " . $itemSummary;

            $this->writeLog($request->log_user, $existing ? 'UPDATE' : 'CREATE', 'transactions', $customLogDetail);
            DB::commit();
            \Illuminate\Support\Facades\Cache::flush();
            event(new StokUpdated("Update dari Transaksi"));

            $transaction = \App\Models\Transaction::find($payload['idTransaksi']);
            if ($transaction) {
                try {
                    $transaction->load(['vendor', 'distributor', 'details.batch.item', 'originalTransaction']);
                } catch (\Exception $e) {
                    // Ignore missing relation exceptions to avoid breaking the creation flow
                }
            }

            return response()->json($transaction ?? ['status' => 'success']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function storeProduksi(Request $request) {
        DB::beginTransaction();
        try {
            $idGenerator = new \App\Services\IdGeneratorService();
            
            $inbound = $request->inbound;
            if (!isset($inbound['idTransaksi'])) {
                $inbound['idTransaksi'] = $idGenerator->generateTransactionId('IN');
            }
            $this->applyTransaction('IN', $inbound);
            
            foreach ($request->outbound as $outPayload) {
                if (!isset($outPayload['idTransaksi'])) {
                    $outPayload['idTransaksi'] = $idGenerator->generateTransactionId('OUT');
                }
                $this->applyTransaction('OUT', $outPayload);
            }
            $qty = $request->inbound['items'][0]['jumlah'] ?? 0;
            $name = $request->inbound['items'][0]['namaBarang'] ?? 'Unknown';
            $this->writeLog($request->log_user, 'CREATE', 'produksi', "Eksekusi Produksi: {$qty} {$name}");
            DB::commit();
            \Illuminate\Support\Facades\Cache::flush();
            event(new StokUpdated("Update dari Produksi BOM"));

            $transaction = \App\Models\Transaction::find($inbound['idTransaksi']);
            if ($transaction) {
                try {
                    $transaction->load(['vendor', 'distributor', 'details.batch.item', 'originalTransaction']);
                } catch (\Exception $e) { }
            }

            return response()->json($transaction ?? ['status' => 'success']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function updateTransaction(Request $request, $type, $id) {
        DB::beginTransaction();
        try {
            $payload = $request->except(['log_user', 'log_detail']);
            $this->revertTransaction($id);
            $this->applyTransaction($type, $payload);
            
            $itemSummary = collect($request->items)->map(function ($item) { 
                $qty = $item['jumlah_transaksi'] ?? $item['jumlah'] ?? 0;
                $nama = $item['namaBarang'] ?? 'Unknown Item';
                return $nama . ' (' . $qty . ')'; 
            })->implode(', ');

            $typeDesc = $type === 'IN' ? 'Kedatangan Barang' : ($type === 'OUT' ? 'Pengeluaran Barang' : 'Return Barang');
            $customLogDetail = "Update {$typeDesc}: {$id} - " . $itemSummary;

            $this->writeLog($request->log_user, 'UPDATE', 'transactions', $customLogDetail);
            DB::commit();
            \Illuminate\Support\Facades\Cache::flush();
            event(new StokUpdated("Update dari Transaksi"));
            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function destroy(Request $request, $type, $id) {
        DB::beginTransaction();
        try {
            $this->revertTransaction($id);
            $this->writeLog($request->log_user, 'DELETE', 'transactions', $request->log_detail ?? "Hapus Transaksi $id");
            DB::commit();
            \Illuminate\Support\Facades\Cache::flush();
            event(new StokUpdated("Update dari Transaksi"));
            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function executeScheduledTransaction(Request $request, $id) {
        DB::beginTransaction();
        try {
            $trx = DB::table('transactions')->where('idTransaksi', $id)->first();
            if (!$trx || $trx->status !== 'scheduled') {
                throw new \Exception("Transaksi tidak ditemukan atau bukan berstatus scheduled.");
            }

            $details = DB::table('transaction_details')->where('idTransaksi', $id)->get();
            
            $retJenis = $trx->sumber_tujuan ?? '';
            if ($trx->type === 'OUT' || ($trx->type === 'RET' && str_starts_with($retJenis, 'RET_OUT'))) {
                $batchDetails = DB::table('transaction_batch_details')->where('idTransaksi', $id)->get();
                foreach ($batchDetails as $bDetail) {
                    DB::table('item_batches')->where('id_batch', $bDetail->id_batch)->decrement('qty_booking', $bDetail->qty_diambil);
                    DB::table('item_batches')->where('id_batch', $bDetail->id_batch)->decrement('qty_sisa', $bDetail->qty_diambil);
                }
            }

            foreach ($details as $detail) {
                if ($trx->type === 'OUT') {
                    DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok_booking', $detail->jumlah);
                    DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok', $detail->jumlah, ['last_sold_at' => Carbon::now()]);
                } elseif ($trx->type === 'IN') {
                    \App\Models\ItemBatch::create([
                        'id_batch' => 'BCH-' . $trx->idTransaksi . '-' . uniqid(),
                        'kodeBarang' => $detail->kodeBarang,
                        'idTransaksi_masuk' => $trx->idTransaksi,
                        'tanggal_masuk' => Carbon::now()->format('Y-m-d H:i:s'), // Use current time since it's executing now
                        'qty_awal' => $detail->jumlah,
                        'qty_sisa' => $detail->jumlah,
                        'qty_booking' => 0,
                        'harga_modal_satuan' => $detail->harga_satuan,
                        'idLokasi' => $detail->lokasi_tujuan ?? null,
                        'lokasi_rak' => $detail->lokasi_asal ?? '-',
                    ]);
                    DB::table('items')->where('kodeBarang', $detail->kodeBarang)->increment('stok', $detail->jumlah);
                } elseif ($trx->type === 'RET') {
                    $retJenis = $trx->sumber_tujuan ?? '';
                    if (str_starts_with($retJenis, 'RET_OUT')) {
                        DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok_booking', $detail->jumlah);
                        DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok', $detail->jumlah);
                    } elseif (str_starts_with($retJenis, 'RET_IN')) {
                        \App\Models\ItemBatch::create([
                            'id_batch' => 'BCH-' . $trx->idTransaksi . '-' . uniqid(),
                            'kodeBarang' => $detail->kodeBarang,
                            'idTransaksi_masuk' => $trx->idTransaksi,
                            'tanggal_masuk' => Carbon::now()->format('Y-m-d H:i:s'),
                            'qty_awal' => $detail->jumlah,
                            'qty_sisa' => $detail->jumlah,
                            'qty_booking' => 0,
                            'harga_modal_satuan' => $detail->harga_satuan,
                            'idLokasi' => $detail->lokasi_tujuan ?? null,
                            'lokasi_rak' => $detail->lokasi_asal ?? '-',
                        ]);
                        DB::table('items')->where('kodeBarang', $detail->kodeBarang)->increment('stok', $detail->jumlah);
                    }
                }
            }

            DB::table('transactions')
                ->where('idTransaksi', $id)
                ->update([
                    'status' => 'completed',
                    'execution_date' => Carbon::now()->format('Y-m-d')
                ]);

            $this->writeLog($request->log_user, 'UPDATE', 'transactions', "Eksekusi manual transaksi terjadwal $id");
            DB::commit();
            \Illuminate\Support\Facades\Cache::flush();
            event(new StokUpdated("Update dari Eksekusi Manual Transaksi"));
            return response()->json(['status' => 'success', 'message' => 'Transaksi berhasil dieksekusi.']);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    // ========================================================
    // LOGIKA INTI DATABASE: DIUBAH KE MULTI-ITEM
    // ========================================================
    private function applyTransaction($type, $payload) {
        $jenisReturnOrTujuan = $payload['jenisReturn'] ?? ($payload['sumber_tujuan'] ?? ($payload['tujuan'] ?? ($payload['sumber'] ?? null)));

        $isScheduled = Carbon::parse($payload['tanggal'])->startOfDay()->gt(Carbon::today());
        $status = $isScheduled ? 'scheduled' : 'completed';
        $execution_date = $isScheduled ? Carbon::parse($payload['tanggal'])->format('Y-m-d') : null;

        // 1. Simpan Header ke tabel transactions
        DB::table('transactions')->insert([
            'idTransaksi' => $payload['idTransaksi'],
            'type' => $type,
            'status' => $status,
            'execution_date' => $execution_date,
            'tanggal' => $payload['tanggal'],
            'sumber_tujuan' => $jenisReturnOrTujuan,
            'entitas' => $payload['namaSupplier'] ?? ($payload['namaPembeli'] ?? null),
            'totalTransaksi' => $payload['totalTransaksi'] ?? 0,
            'pajak_persen' => $payload['pajak_persen'] ?? 0,
            'pajak_nominal' => $payload['pajak_nominal'] ?? 0,
            'idReferensi' => $payload['idReferensi'] ?? null,
            'target_kode_barang' => $payload['target_kode_barang'] ?? null,
            'keterangan' => $payload['keterangan'] ?? null,
            'created_at' => $payload['created_at'] ?? Carbon::now(),
            'updated_at' => Carbon::now()
        ]);

        // 2. Simpan Detail
        $calculatedSubtotal = 0;

        foreach ($payload['items'] as $index => $item) {
            // TASK 3: Server-side UoM enforcement — recalculate real_qty from jumlah_transaksi
            // Pessimistic Locking: Lock the item row to prevent race conditions (stok minus)
            $itemMaster = DB::table('items')->where('kodeBarang', $item['kodeBarang'])->lockForUpdate()->first();
            $satuanTransaksi = $item['satuan_transaksi'] ?? null;
            $multiplier = 1;
            if ($itemMaster && $satuanTransaksi && $satuanTransaksi === $itemMaster->satuan_besar) {
                $multiplier = max(1, intval($itemMaster->rasio_konversi ?? 1));
            }
            $jumlahTransaksi = intval($item['jumlah_transaksi'] ?? $item['jumlah']);
            $realQty = ($item['jumlah_transaksi'] ?? null) !== null
                ? $jumlahTransaksi * $multiplier
                : intval($item['jumlah']); // fallback: trust frontend if no jumlah_transaksi

            // === ABSOLUTE DATA MUTATOR ===
            // 1. Force satuan_transaksi from Master Item if empty
            $satuanTransaksi = $satuanTransaksi ?: ($itemMaster->satuan_dasar ?? 'Pcs');

            // 2. Force jumlah_transaksi to strictly mirror realQty
            $jumlahTransaksi = $realQty;

            // 3. Absolute Location Logic for Makloon
            $entitas = $payload['namaSupplier'] ?? ($payload['namaPembeli'] ?? null);
            $lokasi_asal = $item['lokasi_asal'] ?? null;
            $lokasi_tujuan = $item['lokasi_tujuan'] ?? null;

            $isMklOut = str_starts_with($payload['idTransaksi'], 'MKL-OUT');
            $isMklIn = str_starts_with($payload['idTransaksi'], 'MKL-IN');

            if ($isMklOut) {
                $lokasi_asal = 'PT Mara Jaya Dewi Sakti';
                $lokasi_tujuan = $entitas;
            } elseif ($isMklIn) {
                $lokasi_asal = $entitas;
                $lokasi_tujuan = 'PT Mara Jaya Dewi Sakti';
            } else {
                $lokasi_asal = $this->resolveLokasiasal($item, $payload);
            }

            $hargaSatuan = $item['harga_modal_satuan'] ?? ($item['harga_satuan'] ?? 0);

            // Force Harga Modal (Purchase Price) for Return to Vendor (RET_OUT)
            if ($type === 'RET' && str_starts_with($jenisReturnOrTujuan ?? '', 'RET_OUT')) {
                $batchPriceFound = false;
                if (!empty($item['id_batch'])) {
                    $batch = DB::table('item_batches')->where('id_batch', $item['id_batch'])->first();
                    if ($batch && isset($batch->harga_modal_satuan) && floatval($batch->harga_modal_satuan) > 0) {
                        $hargaSatuan = $batch->harga_modal_satuan;
                        $batchPriceFound = true;
                    }
                }
                
                // Fallback to Master Item's hargaBeli if batch price is unavailable
                if (!$batchPriceFound) {
                    $hargaSatuan = $itemMaster->hargaBeli ?? 0;
                }
            }

            // PHASE 2: Fix Inbound Return Price. Extract from original transaction if available
            if ($type === 'RET' && str_starts_with($jenisReturnOrTujuan ?? '', 'RET_IN') && !empty($payload['idReferensi'])) {
                $originalDetail = DB::table('transaction_details')
                    ->where('idTransaksi', $payload['idReferensi'])
                    ->where('kodeBarang', $item['kodeBarang'])
                    ->first();
                if ($originalDetail && isset($originalDetail->harga_satuan)) {
                    $hargaSatuan = $originalDetail->harga_satuan;
                }
            }

            $calculatedSubtotal += ($realQty * $hargaSatuan);

            DB::table('transaction_details')->insert([
                'idTransaksi' => $payload['idTransaksi'],
                'kodeBarang' => $item['kodeBarang'],
                'namaBarang' => $item['namaBarang'],
                'jumlah' => $realQty,
                'satuan_transaksi' => $satuanTransaksi,
                'jumlah_transaksi' => $jumlahTransaksi,
                'harga_satuan' => $hargaSatuan,
                'lokasi_asal' => $lokasi_asal,
                'lokasi_tujuan' => $lokasi_tujuan,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now()
            ]);

            if ($type === 'IN') {
                if (!$isScheduled) {
                    \App\Models\ItemBatch::create([
                        'id_batch' => 'BCH-' . $payload['idTransaksi'] . '-' . $index,
                        'kodeBarang' => $item['kodeBarang'],
                        'idTransaksi_masuk' => $payload['idTransaksi'],
                        'tanggal_masuk' => $payload['tanggal'],
                        'qty_awal' => $realQty,
                        'qty_sisa' => $realQty,
                        'qty_booking' => 0,
                        'harga_modal_satuan' => round(floatval($item['harga_modal_satuan'] ?? 0), 2),
                        'idLokasi' => $item['lokasi_tujuan'] ?? null,
                        'lokasi_rak' => $item['lokasi_asal'] ?? '-',
                    ]);
                    DB::table('items')->where('kodeBarang', $item['kodeBarang'])->increment('stok', $realQty);

                    // TASK 4: Recalculate hargaBeli with strict 2-decimal precision
                    $pricePerUom = floatval($item['harga_modal_satuan'] ?? 0);
                    if ($pricePerUom > 0) {
                        $newHargaBeli = $pricePerUom;
                        if ($multiplier > 1) {
                            $newHargaBeli = $pricePerUom / $multiplier;
                        }
                        $newHargaBeli = round($newHargaBeli, 2);
                        DB::table('items')->where('kodeBarang', $item['kodeBarang'])->update(['hargaBeli' => $newHargaBeli]);
                    }

                    // MAKLOON IN: Update harga acuan with BOM cost + jasa + tax per unit
                    $isMakloonIn = str_starts_with($payload['idTransaksi'], 'MKL-IN');
                    if ($isMakloonIn && !empty($payload['idReferensi'])) {
                        $refTrx = DB::table('transactions')->where('idTransaksi', $payload['idReferensi'])->first();
                        if ($refTrx && $refTrx->target_kode_barang === $item['kodeBarang']) {
                            // Sum raw material cost from the MKL-OUT details
                            $rawMaterialCost = DB::table('transaction_details')
                                ->where('idTransaksi', $payload['idReferensi'])
                                ->sum(DB::raw('jumlah * harga_satuan'));
                            $bomCostPerUnit = $realQty > 0 ? $rawMaterialCost / $realQty : 0;
                            $jasaPerUnit = floatval($item['harga_modal_satuan'] ?? 0);
                            $pajakNominal = floatval($payload['pajak_nominal'] ?? 0);
                            $taxPerUnit = $realQty > 0 ? $pajakNominal / $realQty : 0;
                            $newHargaAcuan = round($bomCostPerUnit + $jasaPerUnit + $taxPerUnit, 2);
                            DB::table('items')->where('kodeBarang', $item['kodeBarang'])->update(['hargaBeli' => $newHargaAcuan]);
                        }
                    }
                }
            } 
            else if ($type === 'OUT') {
                $stokTersedia = $itemMaster->stok - ($itemMaster->stok_booking ?? 0);
                if (!$itemMaster || $stokTersedia < $realQty) {
                    throw new \Exception("Stok tersedia tidak mencukupi untuk {$item['namaBarang']}. Sisa Tersedia: " . ($stokTersedia ?? 0));
                }
                
                if ($isScheduled) {
                    DB::table('items')->where('kodeBarang', $item['kodeBarang'])->increment('stok_booking', $realQty);
                } else {
                    DB::table('items')->where('kodeBarang', $item['kodeBarang'])->decrement('stok', $realQty, ['last_sold_at' => Carbon::now()]);
                }
                $this->consumeFifoBatches($payload['idTransaksi'], $item['kodeBarang'], $realQty, $isScheduled);
            }
            else if ($type === 'RET') {
                $retJenis = $jenisReturnOrTujuan ?? '';
                // RET_OUT: stock decreases (returning to supplier / replacing for customer)
                if (str_starts_with($retJenis, 'RET_OUT')) {
                    if (empty($item['id_batch'])) {
                        throw new \Exception("id_batch harus disertakan untuk transaksi RET_OUT.");
                    }
                    $batch = DB::table('item_batches')->where('id_batch', $item['id_batch'])->lockForUpdate()->first();
                    if (!$batch) {
                        throw new \Exception("Batch {$item['id_batch']} tidak ditemukan.");
                    }
                    if (($batch->qty_sisa - $batch->qty_booking) < $realQty) {
                        throw new \Exception("Stok batch {$item['id_batch']} tidak mencukupi.");
                    }

                    if ($isScheduled) {
                        DB::table('items')->where('kodeBarang', $item['kodeBarang'])->increment('stok_booking', $realQty);
                        DB::table('item_batches')->where('id_batch', $item['id_batch'])->increment('qty_booking', $realQty);
                    } else {
                        DB::table('items')->where('kodeBarang', $item['kodeBarang'])->decrement('stok', $realQty);
                        DB::table('item_batches')->where('id_batch', $item['id_batch'])->decrement('qty_sisa', $realQty);
                    }
                    
                    \App\Models\TransactionBatchDetail::create([
                        'idTransaksi' => $payload['idTransaksi'],
                        'id_batch' => $batch->id_batch,
                        'qty_diambil' => $realQty
                    ]);
                }
                // RET_IN: stock increases (replacement from supplier / customer returning goods)
                else if (str_starts_with($retJenis, 'RET_IN')) {
                    if (!$isScheduled) {
                        $hargaModal = $itemMaster->hargaBeli ?? 0;
                        $id_batch_baru = 'BCH-' . $payload['idTransaksi'] . '-' . $index;
                        \App\Models\ItemBatch::create([
                            'id_batch' => $id_batch_baru,
                            'kodeBarang' => $item['kodeBarang'],
                            'idTransaksi_masuk' => $payload['idTransaksi'],
                            'tanggal_masuk' => $payload['tanggal'],
                            'qty_awal' => $realQty,
                            'qty_sisa' => $realQty,
                            'qty_booking' => 0,
                            'harga_modal_satuan' => round(floatval($hargaModal), 2),
                            'idLokasi' => $item['lokasi_tujuan'] ?? null,
                            'lokasi_rak' => '-',
                        ]);
                        DB::table('items')->where('kodeBarang', $item['kodeBarang'])->increment('stok', $realQty);
                    }
                }
            }
        }

        // Calculate taxes and grand total for ALL Returns as the absolute source of truth
        if ($type === 'RET') {
            $pajakPersen = 11; // Default PPN
            if (!empty($payload['idReferensi'])) {
                $originalTx = DB::table('transactions')->where('idTransaksi', $payload['idReferensi'])->first();
                if ($originalTx && floatval($originalTx->pajak_persen) > 0) {
                    $pajakPersen = floatval($originalTx->pajak_persen);
                }
            } elseif (isset($payload['pajak_persen']) && floatval($payload['pajak_persen']) > 0) {
                $pajakPersen = floatval($payload['pajak_persen']);
            }

            $pajakNominal = $calculatedSubtotal * ($pajakPersen / 100);
            $totalTransaksi = $calculatedSubtotal + $pajakNominal;

            DB::table('transactions')
                ->where('idTransaksi', $payload['idTransaksi'])
                ->update([
                    'pajak_persen' => $pajakPersen,
                    'pajak_nominal' => $pajakNominal,
                    'totalTransaksi' => $totalTransaksi,
                ]);
        }
    }

    public function fifoTrace($id)
    {
        $allTraces = \App\Models\TransactionBatchDetail::with([
            'batch.location'
        ])->where('idTransaksi', $id)
          ->get();

        if ($allTraces->isNotEmpty()) {
            $firstCreatedAt = $allTraces->min('created_at');
            $traces = $allTraces->filter(function ($t) use ($firstCreatedAt) {
                return \Carbon\Carbon::parse($t->created_at)->diffInSeconds(\Carbon\Carbon::parse($firstCreatedAt)) < 60;
            });
        } else {
            $traces = $allTraces;
        }

        $traces = $traces->map(function ($trace) {
              $item = \Illuminate\Support\Facades\DB::table('items')->where('kodeBarang', $trace->batch->kodeBarang ?? '')->first();
              return [
                  'id_batch' => $trace->id_batch,
                  'qty_diambil' => $trace->qty_diambil,
                  'kodeBarang' => $trace->batch->kodeBarang ?? null,
                  'idTransaksi_masuk' => $trace->batch->idTransaksi_masuk ?? null,
                  'tanggal_masuk' => $trace->batch->tanggal_masuk ?? null,
                  'qty_awal' => $trace->batch->qty_awal ?? null,
                  'harga_modal_satuan' => $trace->batch->harga_modal_satuan ?? null,
                  'namaBarang' => $item ? $item->nama : null,
                  'lokasi_rak_nama' => $trace->batch->location ? $trace->batch->location->nama : null,
                  'batch' => $trace->batch,
              ];
          })
          ->sortBy('tanggal_masuk')
          ->values();

        return response()->json($traces);
    }

    public function availableBatches(Request $request)
    {
        $kodeBarang = $request->query('kodeBarang');
        $query = DB::table('item_batches')
            ->whereRaw('(qty_sisa - qty_booking) > 0')
            ->orderBy('tanggal_masuk', 'asc');
            
        if ($kodeBarang) {
            $query->where('kodeBarang', $kodeBarang);
        }
        
        return response()->json($query->get());
    }

    public function consumeFifoBatches($idTransaksi, $kodeBarang, $jumlah, $isScheduled = false) {
        $remaining = $jumlah;
        $batches = DB::table('item_batches')
            ->where('kodeBarang', $kodeBarang)
            ->whereRaw('(qty_sisa - qty_booking) > 0')
            ->orderBy('tanggal_masuk', 'asc')
            ->orderBy('id_batch', 'asc')
            ->lockForUpdate()
            ->get();

        foreach($batches as $batch) {
            if($remaining <= 0) break;
            $available = $batch->qty_sisa - $batch->qty_booking;
            $take = min($available, $remaining);
            
            if ($isScheduled) {
                DB::table('item_batches')->where('id_batch', $batch->id_batch)->increment('qty_booking', $take);
            } else {
                DB::table('item_batches')->where('id_batch', $batch->id_batch)->decrement('qty_sisa', $take);
            }

            DB::table('transaction_batch_details')->insert([
                'idTransaksi' => $idTransaksi,
                'id_batch' => $batch->id_batch,
                'qty_diambil' => $take,
                'created_at' => Carbon::now()
            ]);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw new \Exception("Sisa stok FIFO tidak mencukupi untuk batch item {$kodeBarang}");
        }
    }

    private function revertTransaction($idTransaksi) {
        $header = DB::table('transactions')->where('idTransaksi', $idTransaksi)->first();
        if(!$header) throw new \Exception("Transaksi tidak ditemukan di database.");

        $details = DB::table('transaction_details')->where('idTransaksi', $idTransaksi)->get();
        $type = $header->type;

        foreach ($details as $detail) {
            if ($type === 'IN') {
                $batch = DB::table('item_batches')->where('idTransaksi_masuk', $idTransaksi)->where('kodeBarang', $detail->kodeBarang)->first();
                if($batch && $batch->qty_sisa < $batch->qty_awal) {
                    throw new \Exception("Gagal: Stok dari Inbound ini sudah ada yang terjual.");
                }
                DB::table('item_batches')->where('idTransaksi_masuk', $idTransaksi)->where('kodeBarang', $detail->kodeBarang)->delete();
                DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok', $detail->jumlah);
            } 
            else if ($type === 'OUT') {
                $batchDetails = DB::table('transaction_batch_details')
                    ->join('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
                    ->where('transaction_batch_details.idTransaksi', $idTransaksi)
                    ->where('item_batches.kodeBarang', $detail->kodeBarang)
                    ->select('transaction_batch_details.*')
                    ->get();
                    
                foreach($batchDetails as $bDetail) {
                    DB::table('item_batches')->where('id_batch', $bDetail->id_batch)->increment('qty_sisa', $bDetail->qty_diambil);
                }
                DB::table('items')->where('kodeBarang', $detail->kodeBarang)->increment('stok', $detail->jumlah);
            }
            else if ($type === 'RET') {
                $retJenis = $header->sumber_tujuan ?? '';
                if (str_starts_with($retJenis, 'RET_OUT')) {
                    // Was a decrement, so revert = increment + restore batches
                    $batchDetails = DB::table('transaction_batch_details')
                        ->join('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
                        ->where('transaction_batch_details.idTransaksi', $idTransaksi)
                        ->where('item_batches.kodeBarang', $detail->kodeBarang)
                        ->select('transaction_batch_details.*')
                        ->get();
                    foreach($batchDetails as $bDetail) {
                        DB::table('item_batches')->where('id_batch', $bDetail->id_batch)->increment('qty_sisa', $bDetail->qty_diambil);
                    }
                    DB::table('items')->where('kodeBarang', $detail->kodeBarang)->increment('stok', $detail->jumlah);
                } else if (str_starts_with($retJenis, 'RET_IN')) {
                    // Was an increment, so revert = decrement + remove batch
                    $batch = DB::table('item_batches')->where('idTransaksi_masuk', $idTransaksi)->where('kodeBarang', $detail->kodeBarang)->first();
                    if($batch && $batch->qty_sisa < $batch->qty_awal) {
                        throw new \Exception("Gagal: Stok dari Return ini sudah ada yang terjual.");
                    }
                    DB::table('item_batches')->where('idTransaksi_masuk', $idTransaksi)->where('kodeBarang', $detail->kodeBarang)->delete();
                    DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok', $detail->jumlah);
                }
            }
        }

        DB::table('transaction_batch_details')->where('idTransaksi', $idTransaksi)->delete();
        DB::table('transaction_details')->where('idTransaksi', $idTransaksi)->delete();
        DB::table('transactions')->where('idTransaksi', $idTransaksi)->delete();
    }

    private function resolveLokasiasal($item, $payload)
    {
        $lokasi = $item['lokasi_asal'] ?? null;

        // Auto-fill from reference vendor for MKL-IN
        if (!$lokasi && !empty($payload['idReferensi']) && str_starts_with($payload['idTransaksi'], 'MKL-IN')) {
            $ref = DB::table('transactions')->where('idTransaksi', $payload['idReferensi'])->first();
            if ($ref) {
                $lokasi = $ref->entitas;
            }
        }

        return $lokasi;
    }
}