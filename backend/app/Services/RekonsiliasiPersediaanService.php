<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Rekonsiliasi nilai untuk Laporan Mutasi, disusun sesuai kaidah akuntansi persediaan:
 *
 * A. PERSEDIAAN (nilai perolehan TANPA PPN, tanpa jasa) — dari buku besar batch FIFO:
 *      Saldo awal + Masuk - Keluar = Saldo akhir
 *    - Masuk  = batch terbentuk (pembelian, barang jadi makloon, retur masuk, penyesuaian stok +)
 *               dinilai qty_awal x harga_modal_satuan.
 *    - Keluar = pengambilan batch (HPP penjualan, bahan ke makloon, retur ke supplier, penyesuaian -)
 *               dinilai qty_diambil x harga_modal_satuan batch (FIFO).
 *    - Tanggal kejadian = tanggal transaksi; penyesuaian stok memakai tanggal penyesuaian.
 *    - Saldo awal = seluruh masuk - keluar SEBELUM tanggal awal periode.
 *
 * B. PENJUALAN & PAJAK (tanpa PPN):
 *    - Penjualan = dasar faktur (total - PPN - PPnBM) penjualan ke customer, dipisah barang / jasa.
 *    - Retur penjualan = retur dari pelanggan (bukan barang pengganti dari supplier).
 *    - Laba kotor = penjualan bersih - HPP bersih (konsisten dengan Dashboard).
 *    - PPN kurang/(lebih) bayar = PPN keluaran - PPN masukan (masing-masing dikurangi returnya).
 *
 * Semua nominal dihitung dengan bcmath (InvoiceCalculator), keluaran string 2 desimal.
 */
class RekonsiliasiPersediaanService
{
    private const S = 4; // skala perhitungan antara

    public function build(string $startDate, string $endDate): array
    {
        $start = Carbon::parse($startDate)->startOfDay()->format('Y-m-d');
        $end = Carbon::parse($endDate)->startOfDay()->format('Y-m-d');

        $persediaan = $this->persediaan($start, $end);
        $penjualan = $this->penjualanDanPajak($start, $end, $persediaan);

        return [
            'persediaan' => $persediaan,
            'penjualan' => $penjualan['penjualan'],
            'pajak' => $penjualan['pajak'],
            'cek_batch' => $this->cekBatch(),
        ];
    }

    // =====================================================================
    // A. PERSEDIAAN (buku besar batch)
    // =====================================================================

    private function persediaan(string $start, string $end): array
    {
        $masukKategori = array_fill_keys(['pembelian', 'makloon_masuk', 'retur_pelanggan', 'retur_pengganti', 'pengembalian_galon', 'penyesuaian_tambah', 'lainnya'], '0');
        $keluarKategori = array_fill_keys(['hpp_penjualan', 'bahan_ke_makloon', 'retur_ke_supplier', 'pengganti_ke_pelanggan', 'penyesuaian_kurang', 'lainnya'], '0');
        $saldoAwal = '0';
        $hppReturPelanggan = '0';

        foreach ($this->batchMasuk() as $ev) {
            if ($ev['tanggal'] < $start) {
                $saldoAwal = bcadd($saldoAwal, $ev['nilai'], self::S);
            } elseif ($ev['tanggal'] <= $end) {
                $masukKategori[$ev['kategori']] = bcadd($masukKategori[$ev['kategori']], $ev['nilai'], self::S);
                if ($ev['kategori'] === 'retur_pelanggan') {
                    $hppReturPelanggan = bcadd($hppReturPelanggan, $ev['nilai'], self::S);
                }
            }
        }
        foreach ($this->batchKeluar() as $ev) {
            if ($ev['tanggal'] < $start) {
                $saldoAwal = bcsub($saldoAwal, $ev['nilai'], self::S);
            } elseif ($ev['tanggal'] <= $end) {
                $keluarKategori[$ev['kategori']] = bcadd($keluarKategori[$ev['kategori']], $ev['nilai'], self::S);
            }
        }

        $totalMasuk = array_reduce($masukKategori, fn ($c, $v) => bcadd($c, $v, self::S), '0');
        $totalKeluar = array_reduce($keluarKategori, fn ($c, $v) => bcadd($c, $v, self::S), '0');
        $perubahan = bcsub($totalMasuk, $totalKeluar, self::S);
        $saldoAkhir = bcadd($saldoAwal, $perubahan, self::S);

        return [
            'saldo_awal' => self::m($saldoAwal),
            'masuk' => array_map([self::class, 'm'], $masukKategori),
            'keluar' => array_map([self::class, 'm'], $keluarKategori),
            'total_masuk' => self::m($totalMasuk),
            'total_keluar' => self::m($totalKeluar),
            'perubahan' => self::m($perubahan),
            'saldo_akhir' => self::m($saldoAkhir),
            '_hpp_retur_pelanggan' => self::m($hppReturPelanggan),
        ];
    }

    /** Setiap batch yang terbentuk = persediaan masuk. */
    private function batchMasuk(): array
    {
        $rows = DB::table('item_batches as b')
            ->leftJoin('transactions as t', 't.idTransaksi', '=', 'b.idTransaksi_masuk')
            ->get(['b.id_batch', 'b.idTransaksi_masuk', 'b.tanggal_masuk', 'b.qty_awal', 'b.harga_modal_satuan',
                   't.idTransaksi', 't.type', 't.tanggal', 't.status', 't.deleted_at', 't.sumber_tujuan']);

        $events = [];
        foreach ($rows as $r) {
            if ($r->idTransaksi && ($r->status !== 'completed' || $r->deleted_at !== null)) {
                continue; // batch dari transaksi belum selesai / terhapus tidak dihitung
            }
            $events[] = [
                'tanggal' => Carbon::parse($r->idTransaksi ? $r->tanggal : $r->tanggal_masuk)->format('Y-m-d'),
                'nilai' => bcmul(InvoiceCalculator::num($r->qty_awal), InvoiceCalculator::num($r->harga_modal_satuan), self::S),
                'kategori' => $this->kategoriMasuk($r),
            ];
        }
        return $events;
    }

    /** Setiap pengambilan batch = persediaan keluar (dinilai harga batch / FIFO). */
    private function batchKeluar(): array
    {
        $rows = DB::table('transaction_batch_details as d')
            ->join('item_batches as b', 'b.id_batch', '=', 'd.id_batch')
            ->leftJoin('transactions as t', 't.idTransaksi', '=', 'd.idTransaksi')
            ->leftJoin('stock_adjustments as a', 'a.adjustment_number', '=', 'd.idTransaksi')
            ->get(['d.idTransaksi as ref', 'd.qty_diambil', 'd.created_at as d_created', 'b.harga_modal_satuan',
                   't.idTransaksi', 't.type', 't.tanggal', 't.status', 't.deleted_at', 't.sumber_tujuan',
                   'a.created_at as adj_created']);

        $events = [];
        foreach ($rows as $r) {
            if ($r->idTransaksi && ($r->status !== 'completed' || $r->deleted_at !== null)) {
                continue;
            }
            $tanggal = $r->idTransaksi ? $r->tanggal : ($r->adj_created ?? $r->d_created);
            $events[] = [
                'tanggal' => Carbon::parse($tanggal)->format('Y-m-d'),
                'nilai' => bcmul(InvoiceCalculator::num($r->qty_diambil), InvoiceCalculator::num($r->harga_modal_satuan), self::S),
                'kategori' => $this->kategoriKeluar($r),
            ];
        }
        return $events;
    }

    private function kategoriMasuk(object $r): string
    {
        if (!$r->idTransaksi) {
            $ref = (string) $r->idTransaksi_masuk;
            return (str_starts_with($ref, 'ADJ') || $ref === 'MANUAL-ADJUSTMENT') ? 'penyesuaian_tambah' : 'lainnya';
        }
        $st = (string) $r->sumber_tujuan;
        return match (true) {
            $r->type === 'MAKLOON_IN' || str_starts_with($r->idTransaksi, 'MKL-IN') => 'makloon_masuk',
            $r->type === 'IN' => 'pembelian',
            $r->type === 'RET' && $st === 'pengembalian_galon' => 'pengembalian_galon',
            $r->type === 'RET' && self::isReturPelanggan($st) => 'retur_pelanggan',
            $r->type === 'RET' => 'retur_pengganti',
            default => 'lainnya',
        };
    }

    private function kategoriKeluar(object $r): string
    {
        if (!$r->idTransaksi) {
            return $r->adj_created ? 'penyesuaian_kurang' : 'lainnya';
        }
        $st = (string) $r->sumber_tujuan;
        return match (true) {
            $r->type === 'MAKLOON_OUT' || str_starts_with($r->idTransaksi, 'MKL-OUT') => 'bahan_ke_makloon',
            $r->type === 'OUT' => 'hpp_penjualan',
            $r->type === 'RET' && self::isReturKeSupplier($st) => 'retur_ke_supplier',
            $r->type === 'RET' => 'pengganti_ke_pelanggan',
            default => 'lainnya',
        };
    }

    // =====================================================================
    // B. PENJUALAN & PAJAK
    // =====================================================================

    private function penjualanDanPajak(string $start, string $end, array $persediaan): array
    {
        $trx = DB::table('transactions')
            ->where('status', 'completed')->whereNull('deleted_at')
            ->whereBetween('tanggal', [$start, $end])
            ->get(['idTransaksi', 'type', 'sumber_tujuan', 'totalTransaksi', 'pajak_nominal', 'ppnbm']);

        $penjualanBarang = $penjualanJasa = $returPenjualan = '0';
        $ppnKeluaran = $ppnReturPenjualan = $ppnMasukan = $ppnReturPembelian = '0';

        $jualIds = [];
        foreach ($trx as $t) {
            $dasar = bcsub(bcsub(InvoiceCalculator::num($t->totalTransaksi), InvoiceCalculator::num($t->pajak_nominal), self::S), InvoiceCalculator::num($t->ppnbm), self::S);
            $ppn = InvoiceCalculator::num($t->pajak_nominal);
            $st = (string) $t->sumber_tujuan;

            if ($t->type === 'OUT' && !str_starts_with($t->idTransaksi, 'MKL-OUT')) {
                $jualIds[$t->idTransaksi] = $dasar;
                $ppnKeluaran = bcadd($ppnKeluaran, $ppn, self::S);
            } elseif (in_array($t->type, ['IN', 'MAKLOON_IN'], true)) {
                $ppnMasukan = bcadd($ppnMasukan, $ppn, self::S);
            } elseif ($t->type === 'RET' && self::isReturPelanggan($st)) {
                $returPenjualan = bcadd($returPenjualan, $dasar, self::S);
                $ppnReturPenjualan = bcadd($ppnReturPenjualan, $ppn, self::S);
            } elseif ($t->type === 'RET' && self::isReturKeSupplier($st)) {
                $ppnReturPembelian = bcadd($ppnReturPembelian, $ppn, self::S);
            }
        }

        // Pisahkan dasar penjualan menjadi barang / jasa sesuai porsi harga jual per baris
        if ($jualIds) {
            $lines = DB::table('transaction_details as d')
                ->leftJoin('items as i', 'i.kodeBarang', '=', 'd.kodeBarang')
                ->whereIn('d.idTransaksi', array_keys($jualIds))
                ->get(['d.idTransaksi', 'd.jumlah', 'd.jumlah_transaksi', 'd.harga_satuan', 'i.kategori', 'i.tipeBarang'])
                ->groupBy('idTransaksi');
            foreach ($jualIds as $id => $dasar) {
                $semua = '0';
                $jasa = '0';
                foreach ($lines[$id] ?? [] as $l) {
                    $nilai = bcmul(InvoiceCalculator::num($l->jumlah_transaksi ?? $l->jumlah), InvoiceCalculator::num($l->harga_satuan), self::S);
                    $semua = bcadd($semua, $nilai, self::S);
                    if (self::isJasa($l->kategori, $l->tipeBarang)) {
                        $jasa = bcadd($jasa, $nilai, self::S);
                    }
                }
                $porsiJasa = bccomp($semua, '0', self::S) > 0 ? bcdiv(bcmul($dasar, $jasa, 10), $semua, self::S) : '0';
                $penjualanJasa = bcadd($penjualanJasa, $porsiJasa, self::S);
                $penjualanBarang = bcadd($penjualanBarang, bcsub($dasar, $porsiJasa, self::S), self::S);
            }
        }

        $hpp = InvoiceCalculator::num($persediaan['keluar']['hpp_penjualan']);
        $hppRetur = InvoiceCalculator::num($persediaan['_hpp_retur_pelanggan']);
        $penjualanBarangBersih = bcsub($penjualanBarang, $returPenjualan, self::S);
        $hppBersih = bcsub($hpp, $hppRetur, self::S);
        $labaBarang = bcsub($penjualanBarangBersih, $hppBersih, self::S);
        $labaTotal = bcadd($labaBarang, $penjualanJasa, self::S);
        $margin = bccomp($penjualanBarangBersih, '0', self::S) > 0
            ? InvoiceCalculator::roundHalfUp(bcmul(bcdiv($labaBarang, $penjualanBarangBersih, 10), '100', 10), 2)
            : '0.00';

        $ppnKeluaranBersih = bcsub($ppnKeluaran, $ppnReturPenjualan, self::S);
        $ppnMasukanBersih = bcsub($ppnMasukan, $ppnReturPembelian, self::S);

        return [
            'penjualan' => [
                'penjualan_barang' => self::m($penjualanBarang),
                'retur_penjualan' => self::m($returPenjualan),
                'penjualan_barang_bersih' => self::m($penjualanBarangBersih),
                'hpp_penjualan' => self::m($hpp),
                'hpp_retur' => self::m($hppRetur),
                'hpp_bersih' => self::m($hppBersih),
                'laba_kotor_barang' => self::m($labaBarang),
                'margin_barang_persen' => $margin,
                'penjualan_jasa' => self::m($penjualanJasa),
                'laba_kotor_total' => self::m($labaTotal),
            ],
            'pajak' => [
                'ppn_keluaran' => self::m($ppnKeluaran),
                'ppn_retur_penjualan' => self::m($ppnReturPenjualan),
                'ppn_masukan' => self::m($ppnMasukan),
                'ppn_retur_pembelian' => self::m($ppnReturPembelian),
                'ppn_kurang_bayar' => self::m(bcsub($ppnKeluaranBersih, $ppnMasukanBersih, self::S)),
            ],
        ];
    }

    // =====================================================================
    // CEK INTEGRITAS BATCH (tidak bergantung periode)
    // =====================================================================

    /**
     * qty_awal - total diambil harus = qty_sisa untuk setiap batch. Bila tidak, nilai persediaan di buku batch
     * berbeda dengan sisa fisik batch; selisihnya dilaporkan (data TIDAK diubah otomatis).
     */
    private function cekBatch(): array
    {
        $rows = DB::table('item_batches as b')
            ->leftJoinSub(
                DB::table('transaction_batch_details')->select('id_batch', DB::raw('SUM(qty_diambil) as diambil'))->groupBy('id_batch'),
                'd', 'd.id_batch', '=', 'b.id_batch'
            )
            ->whereRaw('b.qty_awal - COALESCE(d.diambil, 0) <> b.qty_sisa')
            ->get(['b.id_batch', 'b.kodeBarang', 'b.qty_awal', 'b.qty_sisa', 'b.harga_modal_satuan', DB::raw('COALESCE(d.diambil, 0) as diambil')]);

        $selisih = '0';
        $daftar = [];
        foreach ($rows as $r) {
            $qty = (int) $r->qty_awal - (int) $r->diambil - (int) $r->qty_sisa;
            $nilai = bcmul((string) $qty, InvoiceCalculator::num($r->harga_modal_satuan), self::S);
            $selisih = bcadd($selisih, $nilai, self::S);
            $daftar[] = ['id_batch' => $r->id_batch, 'kode_barang' => $r->kodeBarang, 'qty_selisih' => $qty, 'nilai' => self::m($nilai)];
            Log::warning("[Rekonsiliasi] Batch {$r->id_batch}: qty_awal {$r->qty_awal} - diambil {$r->diambil} != qty_sisa {$r->qty_sisa} (selisih {$qty})");
        }

        return ['selisih' => self::m($selisih), 'batch' => $daftar];
    }

    // =====================================================================
    // UTIL
    // =====================================================================

    public static function isReturPelanggan(string $st): bool
    {
        return str_starts_with($st, 'RET_IN_RETURN_CUSTOMER') || $st === 'Return dari Customer';
    }

    public static function isReturKeSupplier(string $st): bool
    {
        return str_starts_with($st, 'RET_OUT_RETURN_SUPPLIER') || $st === 'Return ke Vendor';
    }

    private static function isJasa(?string $kategori, ?string $tipe): bool
    {
        foreach ([$kategori, $tipe] as $s) {
            if ($s !== null && in_array(strtolower(trim($s)), ['jasa', 'service', 'non-stok', 'non stok'], true)) {
                return true;
            }
        }
        return false;
    }

    public static function m(string $v): string
    {
        return InvoiceCalculator::money($v);
    }
}
