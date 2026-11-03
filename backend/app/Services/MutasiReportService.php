<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Penyusun data "Laporan Rekapitulasi Keseluruhan Mutasi Inventaris" (FM-WH-ALL).
 *
 * Konvensi harga (mengikuti TransactionController::applyTransaction):
 *   - transaction_details.harga_satuan = harga per SATUAN TRANSAKSI, SEBELUM PPN.
 *   - Nilai baris (DPP basis) = jumlah_transaksi x harga_satuan.
 *   - transactions.totalTransaksi = subtotal - potongan - uang muka + PPN (efektif 11%).
 */
class MutasiReportService
{
    /**
     * Aturan pembulatan nilai rupiah pada total ringkasan.
     *   'per_row' : total = jumlah nilai per transaksi yang SUDAH dibulatkan ke rupiah
     *               (angka di tabel selalu menjumlah persis ke subtotal).
     *   'exact'   : total = jumlah nilai desimal mentah, dibulatkan sekali di akhir
     *               (perilaku lama).
     * Ganti ke 'exact' untuk me-revert Perbaikan 4 (pembulatan).
     */
    public const ROUNDING_MODE = 'per_row';

    /** Kategori/tipe barang yang dianggap jasa (non-stok). */
    private const JASA_MARKERS = ['jasa', 'service', 'non-stok', 'non stok'];

    /** Versi format kanonikal hash. Naikkan jika struktur data yang di-hash berubah. */
    public const HASH_CANONICAL_VERSION = 1;

    // =====================================================================
    // KONVERSI SATUAN (terpusat)
    // =====================================================================

    /**
     * Konversi satu baris detail transaksi ke satuan dasar barang.
     *
     * @param array $detail  ['jumlah','jumlah_transaksi','satuan_transaksi','harga_satuan']
     * @param array $item    ['satuan_dasar','satuan_besar','rasio_konversi'] (master items)
     * @return array{
     *   qty_dasar: float, satuan_dasar: string, is_konversi: bool,
     *   qty_transaksi: float, satuan_transaksi: string, isi_per_satuan: int,
     *   harga_per_satuan_transaksi: float, harga_per_satuan_dasar: float|null,
     *   nilai_dpp: float, peringatan: string[]
     * }
     */
    public static function convertToBaseUnit(array $detail, array $item): array
    {
        $satuanDasar = trim((string) ($item['satuan_dasar'] ?? '')) ?: 'Pcs';
        $satuanBesar = trim((string) ($item['satuan_besar'] ?? ''));
        $rasio = max(1, (int) ($item['rasio_konversi'] ?? 1));
        $satuanTrx = trim((string) ($detail['satuan_transaksi'] ?? '')) ?: $satuanDasar;

        $qtyDasarDb = (float) ($detail['jumlah'] ?? 0);
        $qtyTrx = isset($detail['jumlah_transaksi']) && $detail['jumlah_transaksi'] !== null
            ? (float) $detail['jumlah_transaksi']
            : $qtyDasarDb;
        $harga = (float) ($detail['harga_satuan'] ?? 0);

        // Sama dengan aturan saat transaksi disimpan: satuan transaksi == satuan besar -> kali rasio.
        $isKonversi = $satuanBesar !== ''
            && strcasecmp($satuanTrx, $satuanBesar) === 0
            && strcasecmp($satuanBesar, $satuanDasar) !== 0
            && $rasio > 1;

        $peringatan = [];
        $isi = $isKonversi ? $rasio : 1;
        $qtyHitung = $qtyTrx * $isi;

        // Qty dasar yang tersimpan (jumlah) adalah sumber kebenaran stok & total laporan.
        if (abs($qtyHitung - $qtyDasarDb) > 0.0001) {
            $peringatan[] = sprintf(
                'Qty dasar tersimpan (%s) != qty transaksi x isi (%s x %d = %s)',
                $qtyDasarDb, $qtyTrx, $isi, $qtyHitung
            );
            // Jika transaksi tampak terkonversi tapi rasio master berbeda, pakai isi aktual dari data.
            if ($qtyTrx > 0 && $qtyDasarDb > $qtyTrx) {
                $isiAktual = $qtyDasarDb / $qtyTrx;
                if (abs($isiAktual - round($isiAktual)) < 0.0001) {
                    $peringatan[] = sprintf('Isi per %s dari data transaksi = %d (master = %d)', $satuanTrx, $isiAktual, $rasio);
                    $isi = (int) round($isiAktual);
                    $isKonversi = true;
                }
            }
        }

        return [
            'qty_dasar' => $qtyDasarDb,
            'satuan_dasar' => $satuanDasar,
            'is_konversi' => $isKonversi,
            'qty_transaksi' => $qtyTrx,
            'satuan_transaksi' => $satuanTrx,
            'isi_per_satuan' => $isi,
            'harga_per_satuan_transaksi' => $harga,
            'harga_per_satuan_dasar' => $isKonversi ? round($harga / $isi, 2) : $harga,
            'nilai_dpp' => round($qtyTrx * $harga, 2),
            'peringatan' => $peringatan,
        ];
    }

    // =====================================================================
    // PENYUSUNAN LAPORAN
    // =====================================================================

    public function build(string $startDate, string $endDate): array
    {
        $cleanStart = Carbon::parse($startDate)->startOfDay()->format('Y-m-d H:i:s');
        $cleanEnd = Carbon::parse($endDate)->endOfDay()->format('Y-m-d H:i:s');

        $inbound = $this->buildSection(['IN', 'MAKLOON_IN'], 'in', $cleanStart, $cleanEnd);
        $outbound = $this->buildSection(['OUT', 'MAKLOON_OUT'], 'out', $cleanStart, $cleanEnd);
        $returns = $this->buildSection(['RET'], 'ret', $cleanStart, $cleanEnd);

        // Retur yang dihitung: hanya RET-IN dan bukan pengembalian galon (aturan lama dipertahankan).
        $returnsCounted = array_values(array_filter($returns, fn ($r) => $r['dihitung_dalam_total']));

        $sumIn = $this->summarize($inbound);
        $sumOut = $this->summarize($outbound);
        $sumRet = $this->summarize($returnsCounted);
        $sumRet['count'] = count($returns);

        $netQtyFisik = $sumIn['qty_fisik'] - $sumOut['qty_fisik'] - $sumRet['qty_fisik'];
        $netQtySemua = $sumIn['qty'] - $sumOut['qty'] - $sumRet['qty'];
        $netNilai = round($sumIn['nilai'] - $sumOut['nilai'] - $sumRet['nilai'], 2);
        $netNilaiExact = round($sumIn['nilai_exact'] - $sumOut['nilai_exact'] - $sumRet['nilai_exact'], 2);

        $report = [
            'periode' => [
                'start' => Carbon::parse($startDate)->format('d/m/Y'),
                'end' => Carbon::parse($endDate)->format('d/m/Y'),
            ],
            'summary' => [
                'inbound' => $sumIn,
                'outbound' => $sumOut,
                'returns' => $sumRet + ['status' => $this->returnStatus($returns)],
                'net' => [
                    // qty = hanya barang fisik (jasa/non-stok dikeluarkan)
                    'qty' => $netQtyFisik,
                    'qty_semua' => $netQtySemua,
                    'nilai' => $netNilai,
                    'nilai_exact' => $netNilaiExact,
                    'status' => $netQtyFisik >= 0 ? 'Surplus' : 'Defisit',
                ],
                'rounding_mode' => self::ROUNDING_MODE,
                'ppn_note' => 'Harga Satuan sebelum PPN. Total Nilai = Qty x Harga Satuan x (1 + PPN 11%).',
            ],
            'inbound_data' => $inbound,
            'outbound_data' => $outbound,
            'returns_data' => $returns,
            'net_per_barang' => $this->netPerBarang($inbound, $outbound, $returnsCounted),
        ];

        $report['audit'] = [
            'algorithm' => 'SHA-256',
            'canonical_version' => self::HASH_CANONICAL_VERSION,
            'hash' => self::computeHash($report),
        ];

        return $report;
    }

    private function buildSection(array $types, string $kind, string $start, string $end): array
    {
        $headers = DB::table('transactions')
            ->whereIn('type', $types)
            ->where('status', 'completed')
            ->whereNull('deleted_at')
            ->whereBetween('tanggal', [$start, $end])
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))->from('transaction_details')
                    ->whereColumn('transaction_details.idTransaksi', 'transactions.idTransaksi');
            })
            ->orderBy('tanggal', 'asc')
            ->orderBy('idTransaksi', 'asc')
            ->get()
            ->all();

        if (empty($headers)) {
            return [];
        }

        $ids = array_map(fn ($h) => $h->idTransaksi, $headers);
        $detailsByTrx = DB::table('transaction_details as td')
            ->leftJoin('items as i', 'i.kodeBarang', '=', 'td.kodeBarang')
            ->whereIn('td.idTransaksi', $ids)
            ->orderBy('td.id')
            ->get([
                'td.id', 'td.idTransaksi', 'td.kodeBarang', 'td.namaBarang', 'td.jumlah',
                'td.jumlah_transaksi', 'td.satuan_transaksi', 'td.harga_satuan',
                'i.nama as item_nama', 'i.satuan_dasar', 'i.satuan_besar', 'i.rasio_konversi',
                'i.kategori', 'i.tipeBarang',
            ])
            ->groupBy('idTransaksi');

        $rows = [];
        foreach ($headers as $h) {
            $rows[] = $this->buildRow($h, $detailsByTrx[$h->idTransaksi] ?? collect(), $kind);
        }

        // Urut: tanggal naik, lalu ID transaksi naik (tie-breaker eksplisit, tidak bergantung DB collation).
        usort($rows, fn ($a, $b) => [$a['tanggal_iso'], $a['id_transaksi']] <=> [$b['tanggal_iso'], $b['id_transaksi']]);

        return $rows;
    }

    private function buildRow(object $h, $details, string $kind): array
    {
        $entitas = self::cleanText($h->entitas ?: $h->sumber_tujuan ?: '-');
        $total = round((float) $h->totalTransaksi, 2);
        $pajakPersen = (float) $h->pajak_persen;
        $potongan = (float) $h->potongan_harga + (float) $h->uang_muka;

        $items = [];
        $sumDpp = 0.0;
        foreach ($details as $d) {
            $conv = self::convertToBaseUnit((array) $d, (array) $d);
            foreach ($conv['peringatan'] as $w) {
                Log::warning("[LaporanMutasi] {$h->idTransaksi} / {$d->kodeBarang}: {$w}");
            }
            $sumDpp += $conv['nilai_dpp'];
            $items[] = [
                'kode_barang' => $d->kodeBarang,
                'nama_barang' => self::cleanText($d->item_nama ?: $d->namaBarang),
                'qty' => $conv['qty_dasar'],
                'satuan' => $conv['satuan_dasar'],
                'harga_satuan' => $conv['harga_per_satuan_transaksi'],
                'harga_satuan_dasar' => $conv['harga_per_satuan_dasar'],
                'konversi' => $conv['is_konversi'] ? [
                    'qty_beli' => $conv['qty_transaksi'],
                    'satuan_beli' => $conv['satuan_transaksi'],
                    'isi_per_satuan' => $conv['isi_per_satuan'],
                    'satuan_dasar' => $conv['satuan_dasar'],
                ] : null,
                'nilai_dpp' => $conv['nilai_dpp'],
                'is_jasa' => self::isJasa($d->kategori ?? null, $d->tipeBarang ?? null),
            ];
        }

        // Subtotal per item (termasuk PPN, potongan dialokasikan proporsional) — dihitung
        // independen dari total header supaya validasi di bawah bermakna.
        foreach ($items as &$it) {
            $share = $sumDpp > 0 ? $it['nilai_dpp'] / $sumDpp : 0;
            $base = max(0, $it['nilai_dpp'] - $potongan * $share);
            $it['subtotal'] = round($base * (1 + $pajakPersen / 100), 2);
            $it['subtotal_bulat'] = (int) round($it['subtotal']);
        }
        unset($it);

        $isMulti = count($items) > 1;
        $totalBulat = (int) round($total);

        if ($isMulti || count($items) === 1) {
            $sumSub = round(array_sum(array_column($items, 'subtotal')), 2);
            if (abs($sumSub - $total) > 0.05) {
                Log::warning(sprintf(
                    '[LaporanMutasi] %s: jumlah subtotal item (%s) != total transaksi (%s), selisih %s',
                    $h->idTransaksi, $sumSub, $total, round($sumSub - $total, 2)
                ));
            } elseif ($isMulti && array_sum(array_column($items, 'subtotal_bulat')) !== $totalBulat) {
                Log::warning(sprintf(
                    '[LaporanMutasi] %s: jumlah subtotal item yang dibulatkan (%d) != total dibulatkan (%d) — selisih pembulatan',
                    $h->idTransaksi, array_sum(array_column($items, 'subtotal_bulat')), $totalBulat
                ));
            }
        }

        if (self::isSuspiciousValue($total)) {
            Log::warning("[LaporanMutasi] {$h->idTransaksi}: nilai mencurigakan, kemungkinan placeholder (Rp " . number_format($total, 2, ',', '.') . "). Tidak diubah — butuh konfirmasi.");
        }

        $qty = array_sum(array_column($items, 'qty'));
        $isJasa = !empty($items) && count(array_filter($items, fn ($i) => $i['is_jasa'])) === count($items);
        $single = !$isMulti ? ($items[0] ?? null) : null;

        $row = [
            'id_transaksi' => $h->idTransaksi,
            'tanggal' => Carbon::parse($h->tanggal)->format('d/m/Y'),
            'tanggal_iso' => Carbon::parse($h->tanggal)->format('Y-m-d'),
            'nama_barang' => $isMulti ? count($items) . ' Jenis Barang' : ($single['nama_barang'] ?? '-'),
            'qty' => $qty,
            'qty_fisik' => array_sum(array_column(array_filter($items, fn ($i) => !$i['is_jasa']), 'qty')),
            'satuan' => $single['satuan'] ?? null,
            'harga_satuan' => $single['harga_satuan'] ?? null,
            'harga_satuan_dasar' => $single['harga_satuan_dasar'] ?? null,
            'konversi' => $single['konversi'] ?? null,
            'total_nilai' => $total,
            'total_nilai_bulat' => $totalBulat,
            'is_multi' => $isMulti,
            'is_jasa' => $isJasa,
            'items' => $items,
        ];

        $catatanDb = self::cleanText((string) $h->keterangan);
        $catatanTambahan = ($catatanDb !== '' && strcasecmp($catatanDb, $entitas) !== 0) ? $catatanDb : '';

        if ($kind === 'in') {
            $boxParts = [];
            foreach ($items as $it) {
                if ($it['konversi']) {
                    $boxParts[] = self::fmtNum($it['konversi']['qty_beli']) . ' ' . strtolower($it['konversi']['satuan_beli']);
                }
            }
            $row['sumber'] = $entitas;
            $row['keterangan'] = self::joinKet(["Pembelian dari {$entitas}", ...$boxParts, $catatanTambahan]);
        } elseif ($kind === 'out') {
            $row['tujuan'] = $entitas;
            $row['keterangan'] = self::joinKet(["Pengiriman ke {$entitas}", $catatanTambahan]);
        } else {
            $isRetIn = str_contains($h->idTransaksi, 'RET-IN');
            $isGalon = $h->sumber_tujuan === 'pengembalian_galon';
            $asal = self::cleanText($h->entitas ?: '-');
            $row['tipe'] = $isGalon ? 'Pengembalian Galon (Kosong)' : ($isRetIn ? 'Return Inbound' : 'Return Outbound');
            $row['asal_retur'] = $asal;
            $row['kondisi'] = 'Sesuai SOP Retur';
            $row['tindakan'] = self::joinKet(["Retur dari {$asal}", $catatanTambahan]);
            $row['keterangan'] = $row['tindakan'];
            $row['status_trx'] = $h->status;
            $row['estimasi_nilai'] = $total;
            $row['estimasi_nilai_bulat'] = $totalBulat;
            $row['dihitung_dalam_total'] = $isRetIn && !$isGalon;
        }

        return $row;
    }

    private function summarize(array $rows): array
    {
        $exact = round(array_sum(array_column($rows, 'total_nilai')), 2);
        $perRow = (float) array_sum(array_column($rows, 'total_nilai_bulat'));
        $qty = (float) array_sum(array_column($rows, 'qty'));
        $qtyFisik = (float) array_sum(array_column($rows, 'qty_fisik'));

        return [
            'qty' => $qty,                   // semua unit (perilaku lama)
            'qty_fisik' => $qtyFisik,        // hanya barang stok
            'qty_jasa' => $qty - $qtyFisik,  // jasa / non-stok
            'nilai' => self::ROUNDING_MODE === 'per_row' ? $perRow : round($exact),
            'nilai_exact' => $exact,
            'nilai_per_baris' => $perRow,
            'count' => count($rows),
        ];
    }

    /** Status Bagian III dari data; null bila tidak ada retur (frontend menampilkan "Tidak Ada Retur"). */
    private function returnStatus(array $returns): ?string
    {
        if (empty($returns)) {
            return null;
        }
        // Tabel transactions belum punya kolom status klaim; status diturunkan dari transactions.status.
        $map = ['completed' => 'Resolved', 'draft' => 'Pending', 'scheduled' => 'Pending', 'submitted' => 'Claim Submitted'];
        $statuses = array_unique(array_map(fn ($r) => $map[$r['status_trx']] ?? ucfirst((string) $r['status_trx']), $returns));
        return count($statuses) === 1 ? reset($statuses) : implode(' / ', $statuses);
    }

    private function netPerBarang(array $in, array $out, array $ret): array
    {
        $acc = [];
        $add = function (array $rows, string $field) use (&$acc) {
            foreach ($rows as $r) {
                foreach ($r['items'] as $it) {
                    if ($it['is_jasa']) {
                        continue;
                    }
                    $k = $it['kode_barang'];
                    $acc[$k] ??= ['kode_barang' => $k, 'nama_barang' => $it['nama_barang'], 'satuan' => $it['satuan'], 'masuk' => 0.0, 'keluar' => 0.0, 'retur' => 0.0];
                    $acc[$k][$field] += $it['qty'];
                }
            }
        };
        $add($in, 'masuk');
        $add($out, 'keluar');
        $add($ret, 'retur');

        foreach ($acc as &$a) {
            $a['net'] = $a['masuk'] - $a['keluar'] - $a['retur'];
        }
        unset($a);
        $list = array_values($acc);
        usort($list, fn ($a, $b) => strcasecmp($a['nama_barang'], $b['nama_barang']));
        return $list;
    }

    /**
     * Rekap per barang untuk konsumen lain (mis. Asisten AI): barang fisik DAN jasa,
     * satuan dasar, serta ringkasan konversi pembelian per box. Tidak memengaruhi hash laporan.
     */
    public static function perBarangLengkap(array $report): array
    {
        $acc = [];
        $sections = [
            'masuk' => $report['inbound_data'] ?? [],
            'keluar' => $report['outbound_data'] ?? [],
            'retur' => array_values(array_filter($report['returns_data'] ?? [], fn ($r) => $r['dihitung_dalam_total'] ?? false)),
        ];
        foreach ($sections as $field => $rows) {
            foreach ($rows as $r) {
                foreach ($r['items'] as $it) {
                    $k = $it['kode_barang'];
                    $acc[$k] ??= [
                        'kode_barang' => $k,
                        'nama_barang' => $it['nama_barang'],
                        'jenis' => $it['is_jasa'] ? 'Jasa/Non-Stok' : 'Barang Fisik',
                        'satuan' => $it['satuan'],
                        'masuk' => 0.0, 'keluar' => 0.0, 'retur' => 0.0,
                        'trx_masuk' => 0, 'trx_keluar' => 0, 'trx_retur' => 0,
                        'konversi' => [],
                    ];
                    $acc[$k][$field] += $it['qty'];
                    $acc[$k]['trx_' . $field]++;
                    if ($it['konversi']) {
                        $c = $it['konversi'];
                        $key = strtolower($c['satuan_beli']) . '|' . $c['isi_per_satuan'];
                        $acc[$k]['konversi'][$key] ??= ['qty_beli' => 0.0, 'satuan_beli' => strtolower($c['satuan_beli']), 'isi' => $c['isi_per_satuan'], 'satuan_dasar' => strtolower($c['satuan_dasar'])];
                        $acc[$k]['konversi'][$key]['qty_beli'] += $c['qty_beli'];
                    }
                }
            }
        }

        $list = array_map(function ($a) {
            $a['net'] = $a['masuk'] - $a['keluar'] - $a['retur'];
            $a['konversi'] = implode('; ', array_map(
                fn ($c) => sprintf('dibeli %s %s x %d %s', self::fmtNum($c['qty_beli']), $c['satuan_beli'], $c['isi'], $c['satuan_dasar']),
                array_values($a['konversi'])
            ));
            return $a;
        }, array_values($acc));

        usort($list, fn ($a, $b) => [$a['jenis'], $a['nama_barang']] <=> [$b['jenis'], $b['nama_barang']]);
        return $list;
    }

    // =====================================================================
    // HASH AUDIT
    // =====================================================================

    /**
     * Kanonikalisasi: key objek diurutkan rekursif, urutan list dipertahankan,
     * angka desimal ditulis sebagai string 2 desimal (bebas dari variasi presisi float),
     * blok 'audit' dikecualikan. Waktu cetak/operator TIDAK termasuk (hanya data).
     */
    public static function canonicalize(array $report): string
    {
        unset($report['audit']);
        return json_encode(self::normalize($report), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function computeHash(array $report): string
    {
        return hash('sha256', self::canonicalize($report));
    }

    /** Verifikasi hash yang tercetak terhadap data sumber. */
    public static function verifyHash(array $report, string $hash): bool
    {
        $hash = strtolower(trim(preg_replace('/^sha-?256:/i', '', $hash)));
        return preg_match('/^[0-9a-f]{64}$/', $hash) === 1 && hash_equals(self::computeHash($report), $hash);
    }

    private static function normalize($v)
    {
        if (is_array($v)) {
            if (array_is_list($v)) {
                return array_map([self::class, 'normalize'], $v);
            }
            ksort($v, SORT_STRING);
            $out = [];
            foreach ($v as $k => $x) {
                $out[(string) $k] = self::normalize($x);
            }
            return (object) $out;
        }
        if (is_float($v)) {
            return number_format($v, 2, '.', '');
        }
        if (is_int($v)) {
            return number_format($v, 2, '.', '');
        }
        return $v;
    }

    // =====================================================================
    // UTIL
    // =====================================================================

    public static function isSuspiciousValue(float $v): bool
    {
        $int = (string) (int) round($v);
        // Semua digit sama dan >= 5 digit (99999, 999999, 1111111, ...)
        return strlen($int) >= 5 && preg_match('/^(\d)\1+$/', $int) === 1;
    }

    private static function isJasa(?string $kategori, ?string $tipe): bool
    {
        foreach ([$kategori, $tipe] as $s) {
            if ($s !== null && in_array(strtolower(trim($s)), self::JASA_MARKERS, true)) {
                return true;
            }
        }
        return false;
    }

    private static function cleanText(?string $s): string
    {
        return trim(preg_replace('/\s+/u', ' ', (string) $s));
    }

    private static function joinKet(array $parts): string
    {
        return implode(' • ', array_values(array_filter($parts, fn ($p) => $p !== '' && $p !== null)));
    }

    private static function fmtNum(float $n): string
    {
        return number_format($n, (floor($n) == $n) ? 0 : 2, ',', '.');
    }
}
