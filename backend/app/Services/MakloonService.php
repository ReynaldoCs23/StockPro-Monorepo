<?php

namespace App\Services;

use App\Models\MakloonOrder;
use App\Models\Bom;
use App\Models\Item;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Events\StokUpdated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class MakloonService
{
    protected $idGenerator;

    public function __construct(\App\Services\IdGeneratorService $idGenerator)
    {
        $this->idGenerator = $idGenerator;
    }
    public function sendToVendor(MakloonOrder $order)
    {
        if ($order->status !== 'Pending') {
            throw new \Exception("Order status must be Pending to send materials.");
        }

        return DB::transaction(function () use ($order) {
            $bom = Bom::where('kode_produk', $order->kode_produk)->with('details')->first();
            if (!$bom) {
                throw new \Exception("Resep BOM tidak ditemukan untuk produk ini.");
            }

            $vendorName = $order->vendor->nama ?? 'Unknown';
            $companyName = 'PT Mara Jaya Dewi Sakti';

            // 1. Check stock and update
            $requiredMaterials = [];
            foreach ($bom->details as $detail) {
                $item = Item::find($detail->kode_bahan_baku);
                if (!$item) throw new \Exception("Bahan baku {$detail->kode_bahan_baku} tidak ditemukan.");

                $qtyNeeded = $detail->jumlah_per_unit * $order->target_qty;
                if ($item->stok < $qtyNeeded) {
                    throw new \Exception("Stok tidak cukup untuk {$item->nama}. Sisa: {$item->stok}, Butuh: {$qtyNeeded}");
                }

                // Deduct from internal stock
                $item->stok -= $qtyNeeded;
                $item->save();

                $requiredMaterials[] = [
                    'item' => $item,
                    'qty' => $qtyNeeded
                ];
            }

            // 2. Create MAKLOON_OUT transaction — with target_kode_barang
            $trxId = $this->idGenerator->generateTransactionId('MAKLOON_OUT');
            $transaction = Transaction::create([
                'idTransaksi' => $trxId,
                'type' => 'MAKLOON_OUT',
                'tanggal' => Carbon::now()->toDateString(),
                'sumber_tujuan' => 'Ke Vendor: ' . $vendorName,
                'entitas' => $vendorName,
                'target_kode_barang' => $order->kode_produk,
                'keterangan' => "Pengiriman bahan baku Makloon WO: {$order->wo_number}",
                'totalTransaksi' => 0
            ]);

            foreach ($requiredMaterials as $rm) {
                TransactionDetail::create([
                    'idTransaksi' => $trxId,
                    'kodeBarang' => $rm['item']->kodeBarang,
                    'namaBarang' => $rm['item']->nama,
                    'jumlah' => $rm['qty'],
                    'satuan_transaksi' => $rm['item']->satuan_dasar ?? 'Pcs',
                    'jumlah_transaksi' => $rm['qty'],
                    'harga_satuan' => $rm['item']->hargaBeli,
                    'lokasi_asal' => $companyName,
                    'lokasi_tujuan' => $vendorName
                ]);

                // Consume FIFO batches
                $qty_needed = $rm['qty'];
                $batches = DB::table('item_batches')
                    ->where('kodeBarang', $rm['item']->kodeBarang)
                    ->where('qty_sisa', '>', 0)
                    ->orderBy('tanggal_masuk', 'asc')
                    ->orderBy('id_batch', 'asc')
                    ->lockForUpdate()
                    ->get();

                foreach($batches as $batch) {
                    if($qty_needed <= 0) break;
                    $take = min($batch->qty_sisa, $qty_needed);
                    
                    DB::table('item_batches')->where('id_batch', $batch->id_batch)->decrement('qty_sisa', $take);
                    DB::table('transaction_batch_details')->insert([
                        'idTransaksi' => $trxId,
                        'id_batch' => $batch->id_batch,
                        'qty_diambil' => $take,
                        'created_at' => Carbon::now()
                    ]);
                    $qty_needed -= $take;
                }
            }

            // 3. Update Order Status
            $order->status = 'On-Process';
            $order->save();

            // 4. Trigger Event
            event(new StokUpdated("Bahan baku dikirim ke vendor untuk Makloon WO: {$order->wo_number}"));

            return $order;
        });
    }

    public function receiveFromVendor(MakloonOrder $order, int $receivedQty, array $financial = [])
    {
        if ($order->status !== 'On-Process') {
            throw new \Exception("Order status must be On-Process to receive goods.");
        }

        $hargaSatuan = $financial['harga_satuan'] ?? 0;
        $pajakPersen = $financial['pajak_persen'] ?? 0;
        $pajakNominal = $financial['pajak_nominal'] ?? 0;
        $totalTransaksi = $financial['total_transaksi'] ?? 0;

        return DB::transaction(function () use ($order, $receivedQty, $hargaSatuan, $pajakPersen, $pajakNominal, $totalTransaksi) {
            $bom = Bom::where('kode_produk', $order->kode_produk)->with('details')->first();
            if (!$bom) {
                throw new \Exception("Resep BOM tidak ditemukan untuk produk ini.");
            }

            $vendorName = $order->vendor->nama ?? 'Unknown';
            $companyName = 'PT Mara Jaya Dewi Sakti';

            // Find the MKL-OUT transaction linked to this order (for idReferensi)
            $mklOutTrx = Transaction::where('type', 'MAKLOON_OUT')
                ->where('keterangan', 'like', "%{$order->wo_number}%")
                ->where('target_kode_barang', $order->kode_produk)
                ->first();
            $idReferensi = $mklOutTrx ? $mklOutTrx->idTransaksi : null;

            // 1. Add Finished Goods to internal stock
            $fgItem = Item::find($order->kode_produk);
            if (!$fgItem) throw new \Exception("Produk {$order->kode_produk} tidak ditemukan.");
            
            $fgItem->stok += $receivedQty;
            $fgItem->save();

            // 2. Create MAKLOON_IN transaction — with idReferensi and target_kode_barang
            $trxInId = $this->idGenerator->generateTransactionId('MAKLOON_IN');
            $transactionIn = Transaction::create([
                'idTransaksi' => $trxInId,
                'type' => 'MAKLOON_IN',
                'tanggal' => Carbon::now()->toDateString(),
                'sumber_tujuan' => 'Dari Vendor: ' . $vendorName,
                'entitas' => $vendorName,
                'idReferensi' => $idReferensi,
                'target_kode_barang' => $order->kode_produk,
                'keterangan' => "Penerimaan barang jadi Makloon WO: {$order->wo_number}",
                'pajak_persen' => $pajakPersen,
                'pajak_nominal' => $pajakNominal,
                'totalTransaksi' => $totalTransaksi
            ]);

            // Finished Goods detail — absolute location enforcement
            TransactionDetail::create([
                'idTransaksi' => $trxInId,
                'kodeBarang' => $fgItem->kodeBarang,
                'namaBarang' => $fgItem->nama,
                'jumlah' => $receivedQty,
                'satuan_transaksi' => $fgItem->satuan_dasar ?? 'Pcs',
                'jumlah_transaksi' => $receivedQty,
                'harga_satuan' => $hargaSatuan,
                'lokasi_asal' => $vendorName,
                'lokasi_tujuan' => $financial['lokasi_tujuan'] ?? $companyName
            ]);

            // Create item_batch for Finished Goods
            DB::table('item_batches')->insert([
                'id_batch' => 'BCH-' . $trxInId . '-0',
                'kodeBarang' => $fgItem->kodeBarang,
                'idTransaksi_masuk' => $trxInId,
                'tanggal_masuk' => Carbon::now()->toDateString(),
                'qty_awal' => $receivedQty,
                'qty_sisa' => $receivedQty,
                'harga_modal_satuan' => $hargaSatuan,
                'idLokasi' => $financial['lokasi_tujuan'] ?? null,
                'lokasi_rak' => $companyName,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now()
            ]);

            // Recalculate Harga Acuan (Base Cost) for finished goods
            $totalBomCost = 0;
            foreach ($bom->details as $detail) {
                $rawItem = Item::find($detail->kode_bahan_baku);
                if ($rawItem) {
                    $totalBomCost += $rawItem->hargaBeli * ($detail->jumlah_per_unit * $receivedQty);
                }
            }
            $bomCostPerUnit = $receivedQty > 0 ? $totalBomCost / $receivedQty : 0;
            $taxPerUnit = $receivedQty > 0 ? $pajakNominal / $receivedQty : 0;
            $newHargaAcuan = round($bomCostPerUnit + $hargaSatuan + $taxPerUnit, 2);
            $fgItem->hargaBeli = $newHargaAcuan;
            $fgItem->save();

            // 3. Update Order Status
            $order->status = 'Completed';
            $order->save();

            // 4. Trigger Event
            event(new StokUpdated("Barang jadi diterima dari vendor untuk Makloon WO: {$order->wo_number}"));

            return $order;
        });
    }
}
