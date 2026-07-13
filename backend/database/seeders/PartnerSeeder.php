<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PartnerSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = [
            ['idSupplier' => 'SUP-001', 'nama' => 'MANDIRI USAHA', 'tipe_partner' => 'supplier', 'npwp' => '0958137812908000', 'alamat' => 'JL KEBO IWA BTN BONGAN RESIDANCE NO 6A JL KEBO IWA, BONGAN KAUH, BONGAN, TABANAN, BALI A NO.6A, KAB. TABANAN', 'telp' => '-', 'penanggung_jawab' => 'M. ARIF JUNIAWAN'],
            ['idSupplier' => 'SUP-002', 'nama' => 'KARTIKA AGUNG DEWATA', 'tipe_partner' => 'supplier', 'npwp' => '0028638245908000', 'alamat' => 'BR DINAS KUTUH KELOD , KAB. TABANAN', 'telp' => '-', 'penanggung_jawab' => 'NI PUTU LISNA DEWI'],
            ['idSupplier' => 'SUP-003', 'nama' => 'TIRTA MUMBUL JAYA ABADI', 'tipe_partner' => 'supplier', 'npwp' => '0018287060904000', 'alamat' => 'JL MELATI BANJAR JAWA NO.9, RT 000, RW 000, BANJAR JAWA, BULELENG, KAB. BULELENG, BALI 81113', 'telp' => '-', 'penanggung_jawab' => 'NYOMAN ARTA WIDNYANA'],
            ['idSupplier' => 'VEN-001', 'nama' => 'TIRTA MUMBUL JAYA ABADI', 'tipe_partner' => 'vendor', 'npwp' => '0018287060904000', 'alamat' => 'JL MELATI BANJAR JAWA NO.9, KAB. BULELENG', 'telp' => '-', 'penanggung_jawab' => 'NYOMAN ARTA WIDNYANA'],
        ];

        foreach ($suppliers as $sup) {
            DB::table('suppliers')->updateOrInsert(
                ['idSupplier' => $sup['idSupplier']],
                ['nama' => $sup['nama'], 'tipe_partner' => $sup['tipe_partner'], 'npwp' => $sup['npwp'], 'alamat' => $sup['alamat'], 'telp' => $sup['telp'], 'penanggung_jawab' => $sup['penanggung_jawab'], 'created_at' => now(), 'updated_at' => now()]
            );
        }

        $customers = [
            ['idPelanggan' => 'CUS-001', 'nama' => 'CIRCLEKA INDONESIA UTAMA', 'npwp' => '0020797445007000', 'alamat' => 'JL JATINEGARA BARAT NO.124, RT 000, RW 000, KAMPUNG MELAYU, JATINEGARA, KOTA ADM. JAKARTA TIMUR, DKI JAKARTA 13320', 'telp' => '-', 'penanggung_jawab' => 'I WAYAN SUARDANA'],
        ];

        foreach ($customers as $cus) {
            DB::table('customers')->updateOrInsert(
                ['idPelanggan' => $cus['idPelanggan']],
                ['nama' => $cus['nama'], 'npwp' => $cus['npwp'], 'alamat' => $cus['alamat'], 'telp' => $cus['telp'], 'penanggung_jawab' => $cus['penanggung_jawab'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
