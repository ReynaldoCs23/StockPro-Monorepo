import React, { useState, useEffect } from 'react';
import { formatRp } from '../../utils/helpers';
import { apiCall } from '../../utils/api';

export default function FakturPajak({ data, onClose, suppliers = [], customers = [], companyProfile }) {
    const [liveCompanyProfile, setLiveCompanyProfile] = useState(companyProfile);

    useEffect(() => {
        if (data) {
            apiCall('/company-profile').then(res => {
                if (res.data) setLiveCompanyProfile(res.data);
            }).catch(() => { });
        }
    }, [data]);

    if (!data) return null;

    const handlePrint = () => {
        const printContent = document.getElementById('printable-faktur');
        if (!printContent) return;

        // Buat iframe tersembunyi dengan ukuran fisik A4 agar Tailwind w-full tidak bernilai 0px
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = 'none';
        iframe.style.zIndex = '-1000';
        document.body.appendChild(iframe);

        // Salin konten dokumen
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();

        // Ambil style Tailwind dari head dokumen utama agar format tidak hancur
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('');

        iframeDoc.write(`
            <html>
                <head>
                    <title>Print Document</title>
                    ${styles}
                    <style>
                        /* Tambahkan reset khusus untuk print */
                        @page { size: auto; margin: 10mm; }
                        body { background: white !important; margin: 0; padding: 0; color: black; }
                        /* Pastikan wrapper yang disalin (outerHTML) tetap mengambil ruang penuh */
                        #printable-faktur { margin: 0 auto; box-shadow: none !important; }
                    </style>
                </head>
                <body>
                    ${printContent.outerHTML}
                </body>
            </html>
        `);
        iframeDoc.close();

        // Tunggu sebentar agar resource/gambar termuat, lalu cetak
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Bersihkan iframe setelah cetak
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 800);
    };

    // Resolve entity from suppliers/customers arrays
    const entityName = data.entitas || data.namaSupplier || data.namaPembeli || '-';
    const matchedSupplier = suppliers.find(s => s.nama === entityName);
    const matchedCustomer = customers.find(c => c.nama === entityName);
    const entity = matchedSupplier || matchedCustomer || {};

    // Helper: reject "-" or empty strings
    const getValidData = (primary, secondary, fallback = '-') => {
        if (primary && primary !== '-' && primary.trim() !== '') return primary;
        if (secondary && secondary !== '-' && secondary.trim() !== '') return secondary;
        return fallback;
    };

    // Robust data binding
    const entityData = {
        nama: entity.nama || entityName,
        alamat: getValidData(entity.alamat_lengkap, entity.alamat, '-'),
        npwp: getValidData(entity.npwp, null, '-'),
        nik: getValidData(entity.nik, null, '-'),
        penanggung_jawab: getValidData(entity.penanggung_jawab, null, '.......................'),
    };

    // Items
    const itemsList = data.items?.length > 0
        ? data.items
        : [{ kodeBarang: data.kodeBarang, namaBarang: data.namaBarang, jumlah: data.jumlah, harga_satuan: 0 }];

    // Determine transaction type
    const isPembelian = ['IN', 'MAKLOON_IN'].includes(data.type) || data.idTransaksi?.startsWith('IN-') || data.idTransaksi?.startsWith('MKL-IN');

    // ============================================================
    // FAKTUR PAJAK LAYOUT (for IN, MAKLOON_IN, OUT)
    // ============================================================
    const fakturTitle = isPembelian ? 'FAKTUR PEMBELIAN' : 'FAKTUR PENJUALAN';

    // PKP / Pembeli swap
    const profile = data?.company_profile || liveCompanyProfile;
    const MY_COMPANY = {
        nama: profile?.nama || '-',
        alamat: profile?.alamat_lengkap || profile?.alamat || '-',
        npwp: profile?.npwp || '-',
        penanggung_jawab: profile?.penanggung_jawab || '-'
    };
    const dataPKP = isPembelian ? entityData : MY_COMPANY;
    const dataPembeli = isPembelian ? MY_COMPANY : entityData;

    // TASK 2: Signature logic with GEDE ARIADI
    const pihakPenyerah = isPembelian ? (entityData.nama || 'Vendor') : MY_COMPANY.nama;
    const picPenyerah = isPembelian ? entityData.penanggung_jawab : MY_COMPANY.penanggung_jawab;
    const pihakPenerima = isPembelian ? MY_COMPANY.nama : (entityData.nama || 'Customer');
    const picPenerima = isPembelian ? MY_COMPANY.penanggung_jawab : entityData.penanggung_jawab;

    // Calculations
    const hargaJualTotal = itemsList.reduce((sum, item) => sum + (Number(item.jumlah_transaksi || item.jumlah || 0) * Number(item.harga_satuan || item.harga_modal_satuan || 0)), 0);
    const potonganHarga = 0;
    const dpp = hargaJualTotal - potonganHarga;
    const pajakPersen = Number(data.pajak_persen || 0);
    const ppn = Number(data.pajak_nominal || 0) || (dpp * pajakPersen / 100);
    const grandTotal = dpp + ppn;

    return (
        <div className="fixed inset-0 print:static print:inset-auto z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto print:overflow-visible flex print:block justify-center p-4 sm:p-8 print:m-0 print:p-0 print:w-[190mm] print:max-w-[190mm] print:mx-auto max-w-4xl mx-auto print:bg-white print-only-layout text-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div id="printable-faktur" className="faktur-container print-safe-wrapper bg-white p-10 shadow-2xl relative rounded-xl mx-auto text-black print:w-[190mm] print:max-w-[190mm] print:mx-auto print:p-0 print:shadow-none print:rounded-none print:overflow-visible" style={{ minHeight: '297mm' }}>
                
                {/* Action Buttons - hidden on print */}
                <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-slate-800 border border-b shadow-sm">🖨️ Cetak</button>
                    <button onClick={onClose} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-slate-100 border border-b shadow-sm">✕ Tutup</button>
                </div>

                {/* Document Header */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold tracking-widest underline decoration-2 underline-offset-4">{fakturTitle}</h1>
                    <p className="text-sm mt-2">Nomor Faktur: {data.idTransaksi}</p>
                    <p className="text-sm mt-0.5">Tanggal Faktur: {new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                
                {/* Info Section - PKP and Pembeli (Vertically Stacked like Nota Retur) */}
                <div className="w-full flex flex-col gap-4 mb-6 text-sm print:flex-col print:gap-4 print:w-full print:mb-6 print:break-inside-avoid">
                    <div className="w-full border border-black p-3 print:w-full print:box-border">
                        <p className="font-bold underline mb-1">Pengusaha Kena Pajak:</p>
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{dataPKP.nama}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{dataPKP.alamat}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">NPWP</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-mono">{dataPKP.npwp}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="w-full border border-black p-3 print:w-full print:box-border">
                        <p className="font-bold underline mb-1">Pembeli Barang Kena Pajak:</p>
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{dataPembeli.nama}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{dataPembeli.alamat}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">NPWP</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-mono">{dataPembeli.npwp}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Items & Calculations Table (Consolidated) */}
                <table className="w-full text-sm border-collapse border border-black mb-2 print:w-full print:max-w-full">
                    <thead>
                        <tr>
                            <th className="border border-black py-2 px-3 text-center font-bold w-[5%]">No.</th>
                            <th className="border border-black py-2 px-3 text-left font-bold w-[15%]">Kode Barang</th>
                            <th className="border border-black py-2 px-3 text-left font-bold">Nama Barang Kena Pajak</th>
                            <th className="border border-black py-2 px-3 text-right font-bold w-[25%]">Harga Jual (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsList.map((item, idx) => {
                            const unitPrice = Number(item.harga_satuan ?? item.harga_modal_satuan ?? 0);
                            const amount = Number(item.jumlah_transaksi || item.jumlah) * unitPrice;
                            return (
                                <tr key={idx}>
                                    <td className="border border-black py-2 px-3 text-center">{idx + 1}</td>
                                    <td className="border border-black py-2 px-3 font-mono">{item.kodeBarang}</td>
                                    <td className="border border-black py-2 px-3">{item.namaBarang || item.item_nama || '-'} <br/><span className="text-xs text-slate-600">({item.jumlah_transaksi || item.jumlah} {item.satuan_transaksi || 'Pcs'} x {formatRp(unitPrice)})</span></td>
                                    <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(amount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="avoid-break">
                        <tr>
                            <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="3">Harga Jual / Penggantian</td>
                            <td className="border border-black py-2 px-3 text-right font-semibold print:text-black text-blue-700 w-[25%]">{formatRp(hargaJualTotal)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="3">PPN ({pajakPersen}%)</td>
                            <td className="border border-black py-2 px-3 text-right font-semibold print:text-black text-amber-700 w-[25%]">{formatRp(ppn)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black py-2 px-3 font-bold text-right bg-slate-50 print:bg-transparent" colSpan="3">GRAND TOTAL</td>
                            <td className="border border-black py-2 px-3 text-right font-bold bg-slate-50 print:bg-transparent text-emerald-700 w-[25%]">{formatRp(grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>

                {/* Bottom Section - Guaranteed not to split across pages */}
                <div className="signature-section avoid-break mt-6">
                    {/* Notes */}
                    {data.keterangan && (
                        <div className="mb-6 text-sm">
                            <span className="font-bold">Catatan: </span>
                            <span>{data.keterangan}</span>
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 mt-10 text-center text-sm print:mt-8">
                        <div className="flex flex-col items-center justify-end">
                            <p className="font-bold uppercase">Penjual,</p>
                            <div className="h-24"></div>
                            <p className="font-bold uppercase">( {pihakPenyerah} )</p>
                            <p className="text-xs text-slate-500 mt-1">{picPenyerah}</p>
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <p className="font-bold uppercase">Pembeli,</p>
                            <div className="h-24"></div>
                            <p className="font-bold uppercase">( {pihakPenerima} )</p>
                            <p className="text-xs text-slate-500 mt-1">{picPenerima}</p>
                        </div>
                    </div>

                    <div className="mt-12 text-[10px] text-slate-600 text-justify border-t border-slate-300 pt-3">
                        <span className="font-bold">Penting:</span> Sesuai dengan ketentuan yang berlaku, dokumen ini merupakan Faktur Pajak yang sah sebagai bukti pungutan pajak.
                    </div>
                </div>
            </div>
        </div>
    );
}
