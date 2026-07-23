import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import { formatRp } from '../../utils/helpers'; // Dipertahankan jika dibutuhkan

export default function SuratJalanMakloon({ data, onClose, companyProfile, suppliers = [], customers = [] }) {
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
        const printContent = document.getElementById('printable-suratjalan');
        if (!printContent) return;

        // Buat iframe tersembunyi dengan ukuran fisik A4
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
                        body { background: white !important; margin: 0; padding: 0; color: black; display: block !important; visibility: visible !important; }
                        /* Pastikan wrapper yang disalin (outerHTML) tetap mengambil ruang penuh */
                        #printable-suratjalan { margin: 0 auto; box-shadow: none !important; display: block !important; visibility: visible !important; }
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

    // Helper: reject "-" or empty strings
    const getValidData = (primary, secondary, fallback = '-') => {
        if (primary && primary !== '-' && primary.trim() !== '') return primary;
        if (secondary && secondary !== '-' && secondary.trim() !== '') return secondary;
        return fallback;
    };

    // Data Resolution
    const entityName = data.entitas || data.namaSupplier || data.namaPembeli || '-';
    const matchedSupplier = suppliers.find(s => s.nama === entityName);
    const matchedCustomer = customers.find(c => c.nama === entityName);
    const entity = matchedSupplier || matchedCustomer || {};

    const profile = data?.company_profile || liveCompanyProfile;
    const MY_COMPANY = {
        nama: profile?.nama || '-',
        alamat: profile?.alamat_lengkap || profile?.alamat || '-',
        npwp: profile?.npwp || '-',
        penanggung_jawab: profile?.penanggung_jawab || '-'
    };

    const entityData = {
        nama: entityName,
        alamat: getValidData(data.alamat, entity.alamat_lengkap || entity.alamat, '-'),
        npwp: getValidData(data.npwp, entity.npwp, '-'),
        penanggung_jawab: getValidData(entity.penanggung_jawab, null, '___________________'),
    };

    const itemsList = data.items && data.items.length > 0
        ? data.items
        : [{ kodeBarang: data.kodeBarang, namaBarang: data.namaBarang, jumlah: data.jumlah }];

    return (
        <div className="fixed inset-0 print:static print:inset-auto z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto print:overflow-visible flex print:block justify-center p-4 sm:p-8 print:m-0 print:p-0 print:w-[190mm] print:max-w-[190mm] print:mx-auto max-w-4xl mx-auto print:bg-white print-only-layout text-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div id="printable-suratjalan" className="faktur-container print-safe-wrapper bg-white p-10 shadow-2xl relative rounded-xl mx-auto text-black print:w-[190mm] print:max-w-[190mm] print:mx-auto print:p-0 print:shadow-none print:rounded-none print:overflow-visible" style={{ minHeight: '297mm' }}>
                
                {/* Action Buttons - hidden on print */}
                <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-slate-800 border border-b shadow-sm">🖨️ Cetak</button>
                    <button onClick={onClose} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-slate-100 border border-b shadow-sm">✕ Tutup</button>
                </div>

                {/* Document Header */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold tracking-widest underline decoration-2 underline-offset-4">SURAT JALAN MAKLOON</h1>
                    <p className="text-sm mt-2">Nomor: {data.idTransaksi}</p>
                    <p className="text-sm mt-0.5">Tanggal: {data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                </div>
                
                {/* Info Section - Vertically Stacked like Nota Retur & Faktur Pajak */}
                <div className="w-full flex flex-col gap-4 mb-6 text-sm print:flex-col print:gap-4 print:w-full print:mb-6 print:break-inside-avoid">
                    <div className="w-full border border-black p-3 print:w-full print:box-border">
                        <p className="font-bold underline mb-1">Pengirim:</p>
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{MY_COMPANY.nama}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{MY_COMPANY.alamat}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">NPWP</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-mono">{MY_COMPANY.npwp}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="w-full border border-black p-3 print:w-full print:box-border">
                        <p className="font-bold underline mb-1">Penerima:</p>
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{entityData.nama}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{entityData.alamat}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">NPWP</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-mono">{entityData.npwp}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-sm border-collapse border border-black mb-2 print:w-full print:max-w-full">
                    <thead>
                        <tr className="bg-slate-100 print:bg-slate-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <th className="border border-black p-2 text-center w-12 print:w-12">No.</th>
                            <th className="border border-black p-2 text-center w-32 print:w-32">Kode Barang</th>
                            <th className="border border-black p-2 text-left">Nama Barang</th>
                            <th className="border border-black p-2 text-center w-24 print:w-24">Qty</th>
                            <th className="border border-black p-2 text-center w-24 print:w-24">Satuan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsList.map((item, idx) => (
                            <tr key={idx}>
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2 text-center font-mono text-[11px]">{item.kodeBarang || '-'}</td>
                                <td className="border border-black p-2">{item.namaBarang || item.item_nama || '-'}</td>
                                <td className="border border-black p-2 text-center font-bold">{item.jumlah}</td>
                                <td className="border border-black p-2 text-center">Pcs</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Bottom Section */}
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
                            <p className="font-bold uppercase">Yang Menyerahkan,</p>
                            <div className="h-24"></div>
                            <p className="font-bold uppercase underline">( {MY_COMPANY.nama} )</p>
                            <p className="text-xs text-slate-500 mt-1">{MY_COMPANY.penanggung_jawab}</p>
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <p className="font-bold uppercase">Yang Menerima,</p>
                            <div className="h-24"></div>
                            <p className="font-bold uppercase underline">( {entityData.nama} )</p>
                            <p className="text-xs text-slate-500 mt-1">{entityData.penanggung_jawab}</p>
                        </div>
                    </div>

                    <div className="mt-12 text-[10px] text-slate-600 text-justify border-t border-slate-300 pt-3 text-center">
                        * Pastikan kuantitas fisik sesuai sebelum menandatangani dokumen ini.
                    </div>
                </div>

            </div>
        </div>
    );
}
