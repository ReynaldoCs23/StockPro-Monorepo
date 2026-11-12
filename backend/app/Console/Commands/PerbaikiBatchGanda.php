<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Perbaiki batch yang tercatat DOBEL akibat koreksi stok:
 * batch tujuan (mis. pembelian) jumlah awalnya sudah dikoreksi, tetapi barangnya juga pernah ditambal lewat
 * batch penyesuaian stok (sumber). Pemakaian di batch sumber dipindah ke batch tujuan, lalu batch sumber
 * dinolkan. Stok, sisa batch, dan HPP tidak berubah; hanya catatan masuk yang dobel yang dihilangkan.
 *
 *   php artisan stok:perbaiki-batch-ganda BCH-INV-IN-2610-0008-0 BCH-ADJ-261006-0004            (mode uji)
 *   php artisan stok:perbaiki-batch-ganda BCH-INV-IN-2610-0008-0 BCH-ADJ-261006-0004 --jalankan (simpan)
 */
class PerbaikiBatchGanda extends Command
{
    protected $signature = 'stok:perbaiki-batch-ganda
        {batch_tujuan : Batch yang jumlah awalnya sudah benar tetapi pemakaiannya kurang (mis. BCH-INV-IN-2610-0008-0)}
        {batch_sumber : Batch penyesuaian stok yang dobel (mis. BCH-ADJ-261006-0004)}
        {--jalankan : Simpan perubahan. Tanpa opsi ini hanya menampilkan rencana (mode uji).}';

    protected $description = 'Pindahkan pemakaian dari batch penyesuaian yang dobel ke batch aslinya, lalu nolkan batch penyesuaian';

    public function handle(): int
    {
        $tujuanId = $this->argument('batch_tujuan');
        $sumberId = $this->argument('batch_sumber');
        $jalankan = (bool) $this->option('jalankan');

        $tujuan = DB::table('item_batches')->where('id_batch', $tujuanId)->first();
        $sumber = DB::table('item_batches')->where('id_batch', $sumberId)->first();
        if (!$tujuan || !$sumber) {
            $this->error('Batch tujuan atau sumber tidak ditemukan.');
            return self::FAILURE;
        }

        $dipakai = fn (string $id) => (int) DB::table('transaction_batch_details')->where('id_batch', $id)->sum('qty_diambil');
        $selisih = (int) $tujuan->qty_awal - $dipakai($tujuanId) - (int) $tujuan->qty_sisa;
        $pemakaianSumber = DB::table('transaction_batch_details')->where('id_batch', $sumberId)->get();
        $qtySumber = (int) $pemakaianSumber->sum('qty_diambil');

        // ---------- Pemeriksaan keamanan: semua harus terpenuhi ----------
        $cek = [
            'Barang sama' => $tujuan->kodeBarang === $sumber->kodeBarang,
            'Harga batch sama (HPP tidak berubah)' => bccomp((string) $tujuan->harga_modal_satuan, (string) $sumber->harga_modal_satuan, 2) === 0,
            'Batch sumber berasal dari penyesuaian stok' => str_starts_with((string) $sumber->idTransaksi_masuk, 'ADJ') || $sumber->idTransaksi_masuk === 'MANUAL-ADJUSTMENT',
            "Batch tujuan tidak seimbang (selisih {$selisih})" => $selisih > 0,
            "Jumlah awal batch sumber ({$sumber->qty_awal}) = selisih batch tujuan" => (int) $sumber->qty_awal === $selisih,
            "Batch sumber habis terpakai (sisa {$sumber->qty_sisa}, booking {$sumber->qty_booking})" => (int) $sumber->qty_sisa === 0 && (int) $sumber->qty_booking === 0,
            "Pemakaian batch sumber ({$qtySumber}) = jumlah awalnya" => $qtySumber === (int) $sumber->qty_awal,
        ];

        $this->info("Barang {$tujuan->kodeBarang} — harga batch Rp " . number_format((float) $tujuan->harga_modal_satuan, 2, ',', '.'));
        $this->table(['Batch', 'Asal', 'Jml awal', 'Dipakai', 'Sisa'], [
            [$tujuanId, $tujuan->idTransaksi_masuk, $tujuan->qty_awal, $dipakai($tujuanId), $tujuan->qty_sisa],
            [$sumberId, $sumber->idTransaksi_masuk, $sumber->qty_awal, $qtySumber, $sumber->qty_sisa],
        ]);
        $this->line('Pemeriksaan:');
        $lolos = true;
        foreach ($cek as $label => $ok) {
            $this->line(($ok ? '  [OK]    ' : '  [GAGAL] ') . $label);
            $lolos = $lolos && $ok;
        }
        if (!$lolos) {
            $this->error('Pemeriksaan gagal — tidak ada data yang diubah.');
            return self::FAILURE;
        }

        $this->line('');
        $this->line('Rencana perubahan:');
        $this->line("  1. Pindahkan {$pemakaianSumber->count()} catatan pemakaian ({$qtySumber} unit) dari {$sumberId} ke {$tujuanId}:");
        foreach ($pemakaianSumber as $p) {
            $this->line("       - {$p->idTransaksi}: {$p->qty_diambil} unit");
        }
        $this->line("  2. Jumlah awal {$sumberId} diubah {$sumber->qty_awal} -> 0 (baris batch tetap disimpan untuk jejak).");
        $this->line("  3. Keterangan penyesuaian stok {$sumber->idTransaksi_masuk} ditambah catatan koreksi (riwayat tidak dihapus).");
        $nilai = bcmul((string) $selisih, (string) $tujuan->harga_modal_satuan, 2);
        $this->line('  Hasil: ' . $tujuanId . ' menjadi seimbang; saldo buku persediaan turun Rp ' . number_format((float) $nilai, 2, ',', '.') . ' (catatan dobel dihapus).');
        $this->line('  Stok barang, sisa batch, HPP, dan laba TIDAK berubah.');

        if (!$jalankan) {
            $this->warn('MODE UJI — tidak ada yang disimpan. Tambahkan --jalankan untuk menyimpan.');
            return self::SUCCESS;
        }

        // ---------- Cadangan sebelum diubah ----------
        $stokSebelum = (int) DB::table('items')->where('kodeBarang', $tujuan->kodeBarang)->value('stok');
        $cadangan = [
            'dibuat' => now()->toDateTimeString(),
            'item_batches' => [$tujuan, $sumber],
            'transaction_batch_details' => $pemakaianSumber,
            'stock_adjustments' => DB::table('stock_adjustments')->where('adjustment_number', $sumber->idTransaksi_masuk)->get(),
            'items_stok' => $stokSebelum,
        ];
        $dir = storage_path('app/koreksi-batch');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $file = $dir . '/' . now()->format('Ymd_His') . "_{$tujuanId}.json";
        file_put_contents($file, json_encode($cadangan, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info("Cadangan data asli: {$file}");

        DB::transaction(function () use ($tujuanId, $sumberId, $sumber) {
            DB::table('transaction_batch_details')->where('id_batch', $sumberId)->update(['id_batch' => $tujuanId, 'updated_at' => now()]);
            DB::table('item_batches')->where('id_batch', $sumberId)->update(['qty_awal' => 0, 'updated_at' => now()]);
            DB::table('stock_adjustments')->where('adjustment_number', $sumber->idTransaksi_masuk)->update([
                'reason' => DB::raw("CONCAT(COALESCE(reason, ''), ' [Koreksi " . now()->format('d/m/Y') . ": duplikat penambalan bug satuan box; pemakaian dipindah ke {$tujuanId}, batch {$sumberId} dinolkan]')"),
                'updated_at' => now(),
            ]);

            // Verifikasi di dalam transaksi: bila tidak seimbang / stok berubah, semua dibatalkan
            $t = DB::table('item_batches')->where('id_batch', $tujuanId)->first();
            $pakai = (int) DB::table('transaction_batch_details')->where('id_batch', $tujuanId)->sum('qty_diambil');
            if ((int) $t->qty_awal - $pakai !== (int) $t->qty_sisa) {
                throw new \RuntimeException('Verifikasi gagal: batch tujuan masih tidak seimbang. Perubahan dibatalkan.');
            }
        });

        $stokSesudah = (int) DB::table('items')->where('kodeBarang', $tujuan->kodeBarang)->value('stok');
        if ($stokSesudah !== $stokSebelum) {
            $this->error("Peringatan: stok berubah ({$stokSebelum} -> {$stokSesudah}). Periksa cadangan: {$file}");
            return self::FAILURE;
        }

        Log::info("[Koreksi batch] Pemakaian {$sumberId} dipindah ke {$tujuanId}; {$sumberId} dinolkan. Cadangan: {$file}");
        $this->info("Selesai. {$tujuanId} seimbang; stok {$tujuan->kodeBarang} tetap {$stokSesudah}.");
        return self::SUCCESS;
    }
}
