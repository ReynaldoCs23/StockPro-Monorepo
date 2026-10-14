<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EFakturController extends Controller
{
    public function extract(Request $request)
    {
        $request->validate([
            'qrUrl' => 'required|string',
        ]);

        $rawInput = trim($request->input('qrUrl'));
        Log::info('EFaktur extract request received: ' . substr($rawInput, 0, 200));

        try {
            // Helper untuk membersihkan format angka rupiah (contoh: "29.398.595,00" atau "29398595")
            $parseIdrNumber = function($str) {
                if (is_numeric($str)) return (float)$str;
                $cleaned = trim((string)$str);
                $cleaned = str_replace(' ', '', $cleaned);
                $cleaned = str_replace('.', '', $cleaned); // Hilangkan titik ribuan
                $cleaned = str_replace(',', '.', $cleaned); // Ubah koma jadi titik desimal
                return (float)$cleaned;
            };

            // Helper format tanggal (DD-MM-YYYY atau DD/MM/YYYY -> YYYY-MM-DD)
            $parseIdrDate = function($str) {
                $trimmed = trim((string)$str);
                if (preg_match('/^(\d{1,2})[-|\/](\d{1,2})[-|\/](\d{4})$/', $trimmed, $m)) {
                    return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
                }
                $ts = strtotime($trimmed);
                return $ts ? date('Y-m-d', $ts) : now()->format('Y-m-d');
            };

            // =========================================================================
            // FORMAT 1: STRING HASHTAG (#) KHAS E-FAKTUR INDONESIA
            // Contoh: NAMA_PENJUAL#NPWP_PENJUAL#NAMA_PEMBELI#NPWP_PEMBELI#NO_FAKTUR#TANGGAL#DPP#PPN#PPNBM#STATUS
            // =========================================================================
            if (str_contains($rawInput, '#')) {
                $parts = explode('#', $rawInput);
                if (count($parts) >= 7) {
                    $namaPenjual = trim($parts[0] ?? '');
                    $npwpPenjual = trim($parts[1] ?? '');
                    $namaPembeli = trim($parts[2] ?? '');
                    $npwpPembeli = trim($parts[3] ?? '');
                    $nomorFaktur = trim($parts[4] ?? '');
                    $rawTanggal  = trim($parts[5] ?? '');
                    $rawDpp      = trim($parts[6] ?? '0');
                    $rawPpn      = trim($parts[7] ?? '0');
                    $rawPpnbm    = trim($parts[8] ?? '0');

                    $dpp = $parseIdrNumber($rawDpp);
                    $ppn = $parseIdrNumber($rawPpn);
                    $ppnbm = $parseIdrNumber($rawPpnbm);
                    $tanggal = $parseIdrDate($rawTanggal);

                    Log::info("Berhasil parsing e-Faktur format Hashtag (#): NoFaktur=$nomorFaktur, Supplier=$namaPenjual, DPP=$dpp, PPN=$ppn");

                    return response()->json([
                        'success' => true,
                        'data' => [
                            'nomor_faktur' => $nomorFaktur,
                            'no_faktur' => $nomorFaktur,
                            'tanggal' => $tanggal,
                            'npwp' => $npwpPenjual,
                            'nama' => $namaPenjual,
                            'supplier_name' => $namaPenjual,
                            'nama_pembeli' => $namaPembeli,
                            'npwp_pembeli' => $npwpPembeli,
                            'dpp' => $dpp,
                            'ppn' => $ppn,
                            'ppnbm' => $ppnbm,
                            'items' => [
                                [
                                    'nama' => 'Penyerahan BKP / JKP sesuai Faktur ' . $nomorFaktur,
                                    'harga_satuan' => $dpp,
                                    'jumlah' => 1,
                                    'total' => $dpp,
                                    'dpp' => $dpp,
                                    'ppn' => $ppn,
                                ]
                            ],
                        ]
                    ]);
                }
            }

            // =========================================================================
            // FORMAT 2: XML DIRECT STRING DARI SCANNER (<resValidateFakturPm>)
            // =========================================================================
            $xmlString = null;
            if (str_contains($rawInput, '<resValidateFakturPm>') || (str_contains($rawInput, '<?xml') && str_contains($rawInput, 'Faktur'))) {
                $xmlString = $rawInput;
            } 
            // =========================================================================
            // FORMAT 3: URL (DJP svc.efaktur.pajak.go.id atau Coretax DJP External Link)
            // =========================================================================
            elseif (filter_var($rawInput, FILTER_VALIDATE_URL) || str_starts_with($rawInput, 'http://') || str_starts_with($rawInput, 'https://')) {
                $targetUrl = $rawInput;

                // Khusus Coretax DocumentExternalLink
                if (str_contains($targetUrl, 'coretaxdjp.pajak.go.id') && str_contains($targetUrl, 'DocumentExternalLink')) {
                    try {
                        $coretaxRes = Http::timeout(12)
                            ->withoutVerifying()
                            ->withHeaders([
                                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept' => 'application/json, text/plain, text/html, */*'
                            ])
                            ->get($targetUrl);

                        if ($coretaxRes->successful()) {
                            $cBody = $coretaxRes->body();
                            // Cek jika Coretax mengembalikan JSON
                            $json = @json_decode($cBody, true);
                            if (is_array($json)) {
                                $nomorFaktur = $json['taxInvoiceNumber'] ?? $json['documentNumber'] ?? $json['invoiceNumber'] ?? '';
                                $namaPenjual = $json['sellerName'] ?? $json['supplierName'] ?? $json['seller'] ?? '';
                                $npwpPenjual = $json['sellerTin'] ?? $json['sellerNpwp'] ?? '';
                                $namaPembeli = $json['buyerName'] ?? $json['customerName'] ?? '';
                                $npwpPembeli = $json['buyerTin'] ?? $json['buyerNpwp'] ?? '';
                                $dpp = (float)($json['taxableAmount'] ?? $json['totalTaxableAmount'] ?? $json['dpp'] ?? 0);
                                $ppn = (float)($json['vatAmount'] ?? $json['totalVatAmount'] ?? $json['ppn'] ?? 0);
                                $ppnbm = (float)($json['luxuryTaxAmount'] ?? 0);
                                $tanggal = $parseIdrDate($json['issueDate'] ?? $json['invoiceDate'] ?? now()->format('Y-m-d'));

                                if ($nomorFaktur || $dpp > 0 || $namaPenjual) {
                                    return response()->json([
                                        'success' => true,
                                        'data' => [
                                            'nomor_faktur' => $nomorFaktur,
                                            'no_faktur' => $nomorFaktur,
                                            'tanggal' => $tanggal,
                                            'npwp' => $npwpPenjual,
                                            'nama' => $namaPenjual,
                                            'supplier_name' => $namaPenjual,
                                            'nama_pembeli' => $namaPembeli,
                                            'npwp_pembeli' => $npwpPembeli,
                                            'dpp' => $dpp,
                                            'ppn' => $ppn,
                                            'ppnbm' => $ppnbm,
                                            'items' => [
                                                [
                                                    'nama' => 'Barang / Jasa sesuai Coretax ' . $nomorFaktur,
                                                    'harga_satuan' => $dpp,
                                                    'jumlah' => 1,
                                                    'total' => $dpp,
                                                    'dpp' => $dpp,
                                                    'ppn' => $ppn,
                                                ]
                                            ],
                                        ]
                                    ]);
                                }
                            }
                            
                            // Jika mengembalikan HTML atau string berformat hashtag di dalam body
                            if (str_contains($cBody, '#')) {
                                preg_match('/([A-Z0-9\s\.\-]+#[0-9]+#[A-Z0-9\s\.\-]+#[0-9]+#[A-Z0-9\.\-]+#[0-9\-\/]+#[0-9\.\,]+#[0-9\.\,]+#[0-9\.\,]+#[A-Za-z]+)/', $cBody, $matches);
                                if (!empty($matches[1])) {
                                    $rawInput = $matches[1];
                                    // Rekursif/lanjutkan ke format hashtag
                                }
                            }
                        }
                    } catch (\Exception $cEx) {
                        Log::warning("Gagal fetch Coretax External Link: " . $cEx->getMessage());
                    }
                }

                // Untuk domain svc.efaktur.pajak.go.id: coba HTTP & HTTPS
                $urlsToTry = [$targetUrl];
                if (str_contains($targetUrl, 'svc.efaktur.pajak.go.id')) {
                    if (str_starts_with($targetUrl, 'https://')) {
                        $urlsToTry = [str_replace('https://', 'http://', $targetUrl), $targetUrl];
                    }
                }

                $headers = [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language' => 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                ];

                foreach ($urlsToTry as $u) {
                    try {
                        $response = Http::timeout(10)
                            ->withoutVerifying()
                            ->withHeaders($headers)
                            ->get($u);

                        if ($response->successful()) {
                            $body = $response->body();
                            if (str_contains($body, 'resValidateFakturPm') || str_contains($body, '<?xml')) {
                                $xmlString = $body;
                                break;
                            }
                        }
                    } catch (\Exception $reqEx) {
                        Log::warning("Gagal fetch e-Faktur dari URL [$u]: " . $reqEx->getMessage());
                    }
                }
            }

            // Jika berhasil mendapatkan XML dari DJP
            if ($xmlString) {
                $xmlString = preg_replace('/^.*?<\?xml/s', '<?xml', $xmlString);
                $xml = simplexml_load_string($xmlString);

                if ($xml) {
                    $items = [];
                    if (isset($xml->detailTransaksi)) {
                        foreach ($xml->detailTransaksi as $dt) {
                            $items[] = [
                                'nama' => (string)($dt->nama ?? ''),
                                'harga_satuan' => (float)($dt->hargaSatuan ?? 0),
                                'jumlah' => (float)($dt->jumlahBarang ?? 1),
                                'total' => (float)($dt->totalHarga ?? 0),
                                'dpp' => (float)($dt->dpp ?? 0),
                                'ppn' => (float)($dt->ppn ?? 0),
                            ];
                        }
                    }

                    $nomorFaktur = (string)($xml->nomorFaktur ?? '');
                    $kd = (string)($xml->kdJenisTransaksi ?? '');
                    $fg = (string)($xml->fgPengganti ?? '');
                    $fullNomor = ($kd || $fg) ? ($kd . $fg . '.' . $nomorFaktur) : $nomorFaktur;

                    $tanggal = $parseIdrDate((string)($xml->tanggalFaktur ?? ''));
                    $dpp = (float)($xml->jumlahDpp ?? 0);
                    $ppn = (float)($xml->jumlahPpn ?? 0);
                    $ppnbm = (float)($xml->jumlahPpnBm ?? $xml->jumlahPpnbm ?? 0);
                    $namaPenjual = (string)($xml->namaPenjual ?? '');
                    $npwpPenjual = (string)($xml->npwpPenjual ?? '');

                    if (empty($items) && $dpp > 0) {
                        $items[] = [
                            'nama' => 'Barang / Jasa sesuai e-Faktur ' . $nomorFaktur,
                            'harga_satuan' => $dpp,
                            'jumlah' => 1,
                            'total' => $dpp,
                            'dpp' => $dpp,
                            'ppn' => $ppn,
                        ];
                    }

                    return response()->json([
                        'success' => true,
                        'data' => [
                            'nomor_faktur' => $fullNomor,
                            'no_faktur' => $fullNomor,
                            'tanggal' => $tanggal,
                            'npwp' => $npwpPenjual,
                            'nama' => $namaPenjual,
                            'supplier_name' => $namaPenjual,
                            'nama_pembeli' => (string)($xml->namaLawanTransaksi ?? ''),
                            'npwp_pembeli' => (string)($xml->npwpLawanTransaksi ?? ''),
                            'dpp' => $dpp,
                            'ppn' => $ppn,
                            'ppnbm' => $ppnbm,
                            'items' => $items,
                        ]
                    ]);
                }
            }

            // Jika tautan adalah portal Coretax DJP yang diproteksi CAPTCHA
            if (str_contains($rawInput, 'coretaxdjp.pajak.go.id')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tautan QR Coretax DJP ini diproteksi verifikasi CAPTCHA oleh DJP dan tidak menyediakan open API publik. Silakan scan Barcode Faktur fisik (format teks hashtag #) atau input nomor faktur secara manual.'
                ], 422);
            }

            // Jika semua upaya parsing gagal, kembalikan pesan error spesifik (BUKAN DUMMY!)
            return response()->json([
                'success' => false,
                'message' => 'Format QR e-Faktur tidak dapat diekstrak atau tautan DJP tidak dapat diakses langsung. Isi teks scan: ' . substr($rawInput, 0, 80)
            ], 422);

        } catch (\Exception $e) {
            Log::error('EFaktur extraction failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses data e-Faktur: ' . $e->getMessage()
            ], 422);
        }
    }
}
