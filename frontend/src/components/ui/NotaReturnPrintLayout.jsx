import React, { useState, useEffect } from 'react';
import { Printer, X } from '../icons/Icons';
import { formatRp } from '../../utils/helpers';
import { apiCall } from '../../utils/api';

export default function NotaReturnPrintLayout({ data, onClose, currentUser, type = 'OUT', suppliers = [], customers = [], companyProfile }) {
    const [liveCompanyProfile, setLiveCompanyProfile] = useState(companyProfile);

    useEffect(() => {
        if (data) {
            apiCall('/company-profile').then(res => {
                if (res.nama) setLiveCompanyProfile(res);
                else if (res.data) setLiveCompanyProfile(res.data);
            }).catch(() => {});
        }
    }, [data]);

    if (!data) return null;

    const handlePrint = () => {
        const printContent = document.getElementById('printable-return');
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

        // Ambil style Tailwind dari head dokumen utama
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('');

        iframeDoc.write(`
            <html>
                <head>
                    <title>Print Document</title>
                    ${styles}
                    <style>
                        /* Reset khusus print */
                        @page { size: auto; margin: 10mm; }
                        body { background: white !important; margin: 0; padding: 0; color: black; }
                        #printable-return { margin: 0 auto; box-shadow: none !important; }
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

    const isMakloonOut = data.type === 'MAKLOON_OUT' || data.idTransaksi?.startsWith('MKL-OUT');
    const isMakloonIn  = data.type === 'MAKLOON_IN'  || data.idTransaksi?.startsWith('MKL-IN');
    const isMakloon    = isMakloonOut || isMakloonIn;
    const isReturnOut = (data.jenisReturn || data.sumber_tujuan || '').startsWith('RET_OUT');
    const isReturnIn = (data.jenisReturn || data.sumber_tujuan || '').startsWith('RET_IN');
    const isPengembalianGalon = data.jenisReturn === 'pengembalian_galon' || data.sumber_tujuan === 'pengembalian_galon';
    const isReturn = isReturnOut || isReturnIn;
    const isPenjualan = !isMakloon && !isReturn && !isPengembalianGalon && (data.tujuan?.includes('Penjualan') || data.sumber_tujuan?.includes('Penjualan'));
    const isPembelian = !isMakloon && !isReturn && !isPengembalianGalon && type === 'IN';

    const showPriceColumn = (isPenjualan || isPembelian) && !isMakloon && !isReturn && !isPengembalianGalon;

    let docTitle = 'SURAT JALAN';
    if (isMakloonOut) docTitle = 'SURAT JALAN MAKLOON';
    else if (isMakloonIn) docTitle = 'BUKTI PENERIMAAN BARANG MAKLOON';
    else if (isReturnOut) docTitle = 'SURAT RETURN KELUAR';
    else if (isReturnIn) docTitle = 'SURAT RETURN MASUK';
    else if (isPengembalianGalon) docTitle = 'SURAT JALAN PENGEMBALIAN ASET';
    else if (isPembelian) docTitle = 'BUKTI PENERIMAAN BARANG';
    else if (isPenjualan) docTitle = 'INVOICE';

    // Lookup address from suppliers/customers
    const tracedEntity = data.resolved_party?.nama || '';
    const supplierName = data.namaSupplier || data.entitas || tracedEntity || '';
    const customerName = data.namaPembeli || data.entitas || tracedEntity || '';
    const matchedSupplier = suppliers.find(s => s.nama === supplierName);
    const matchedCustomer = customers.find(c => c.nama === customerName);
    const entityName = data.entitas || tracedEntity || '-';
    const entityAddress = data.entityAddress || matchedCustomer?.alamat || matchedSupplier?.alamat || '';

    // Info boxes
    let fromTitle = '', fromValue = '', fromAddress = '';
    let toTitle = '', toValue = '', toAddress = '';

    if (isReturnIn || isPengembalianGalon) {
        // Return Masuk / Pengembalian Galon: goods coming FROM customer/supplier TO our warehouse
        fromTitle = 'FROM'; fromValue = entityName; fromAddress = entityAddress;
        toTitle = 'TO'; toValue = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; toAddress = liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI';
    } else if (isReturnOut) {
        // Return Keluar: goods going FROM our warehouse TO supplier/customer
        fromTitle = 'FROM'; fromValue = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; fromAddress = liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI';
        toTitle = 'TO'; toValue = entityName; toAddress = entityAddress;
    } else if (isMakloonOut) {
        fromTitle = 'FROM'; fromValue = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; fromAddress = liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI';
        toTitle = 'TO (VENDOR)'; toValue = data.entitas || 'Vendor Makloon'; toAddress = matchedSupplier?.alamat || '';
    } else if (isMakloonIn) {
        fromTitle = 'FROM (VENDOR)'; fromValue = data.entitas || 'Vendor Makloon'; fromAddress = matchedSupplier?.alamat || '';
        toTitle = 'TO'; toValue = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; toAddress = liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI';
    } else if (isPembelian) {
        fromTitle = 'FROM'; fromValue = supplierName || '-'; fromAddress = matchedSupplier?.alamat || '';
        toTitle = 'TO'; toValue = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; toAddress = liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI';
    } else {
        fromTitle = 'FROM'; fromValue = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; fromAddress = liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI';
        toTitle = isPenjualan ? 'BILL TO' : 'TO'; toValue = customerName || '-'; toAddress = matchedCustomer?.alamat || '';
    }

    // Calculate totals from items
    const itemsList = data.items && data.items.length > 0 ? data.items : [{ kodeBarang: data.kodeBarang, namaBarang: data.namaBarang, jumlah: data.jumlah, harga_satuan: data.harga_modal_satuan || 0 }];
    const subtotal = showPriceColumn ? itemsList.reduce((sum, it) => sum + (Number(it.jumlah) * Number(it.harga_satuan || it.harga_modal_satuan || 0)), 0) : 0;
    const potonganHarga = Number(data.potongan_harga || 0);
    const uangMuka = Number(data.uang_muka || 0);
    const ppnbm = Number(data.ppnbm || 0);
    const subtotalDasar = Math.max(0, subtotal - potonganHarga - uangMuka);
    const fallbackDpp = isPembelian ? (subtotalDasar * 11 / 12) : subtotalDasar;
    const dpp = data.dpp !== undefined && data.dpp !== null && Number(data.dpp) > 0 ? Number(data.dpp) : fallbackDpp;
    const pajakPersen = Number(data.pajak_persen || 0);
    const pajakNominal = Number(data.pajak_nominal || (dpp * pajakPersen / 100));
    const grandTotal = Number(data.totalTransaksi) || (subtotalDasar + pajakNominal + ppnbm);

    // Signatures
    let sig1Label = 'Dikirim Oleh', sig1Name = isPembelian ? (data.namaSupplier || 'Supplier') : 'Admin Gudang';
    let sig2Label = 'Penerima', sig2Name = isPembelian ? 'Admin Gudang' : (data.namaPembeli || data.entitas || 'Nama Terang');
    let sig1PIC = '', sig2PIC = '';

    if (isMakloonOut) { sig1Name = 'Admin Gudang'; sig2Label = 'Penerima (Vendor)'; sig2Name = data.entitas || 'Vendor'; }
    else if (isMakloonIn) { sig1Label = 'Dikirim Oleh (Vendor)'; sig1Name = data.entitas || 'Vendor'; sig2Label = 'Penerima Gudang'; sig2Name = 'Admin Gudang'; }
    else if (isReturnIn || isPengembalianGalon) { 
        sig1Label = 'Dikirim Oleh'; sig1Name = entityName; sig1PIC = matchedCustomer?.penanggung_jawab || matchedSupplier?.penanggung_jawab || '';
        sig2Label = 'Diterima Oleh'; sig2Name = liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'; sig2PIC = liveCompanyProfile?.penanggung_jawab || '';
    }
    else if (isReturnOut) { sig1Label = 'Dikirim Oleh'; sig1Name = 'Admin Gudang'; sig2Label = 'Penerima'; sig2Name = entityName; }

    if (isReturn) {
        // Buyer is the one returning the goods to Seller
        // In "RET_IN" (Return Masuk), customer is returning to us. 
        //  -> Pembeli (Buyer): Customer
        //  -> Penjual (Seller): Us (Company)
        // In "RET_OUT" (Return Keluar), we are returning to supplier.
        //  -> Pembeli (Buyer): Us (Company)
        //  -> Penjual (Seller): Supplier

        const sellerName = isReturnOut ? entityName : (liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti');
        const sellerAddress = isReturnOut ? entityAddress : (liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI 81119');
        const sellerNPWP = isReturnOut ? (data?.vendor?.npwp || matchedSupplier?.npwp || '-') : (liveCompanyProfile?.npwp || '-');
        const sellerPIC = isReturnOut ? (data?.vendor?.penanggung_jawab || matchedSupplier?.penanggung_jawab || '_________________________') : (liveCompanyProfile?.penanggung_jawab || '_________________________');

        const buyerName = isReturnIn ? entityName : (liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti');
        const buyerAddress = isReturnIn ? entityAddress : (liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI 81119');
        const buyerNPWP = isReturnIn ? (data?.customer?.npwp || data?.partner?.npwp || matchedCustomer?.npwp || matchedSupplier?.npwp || '-') : (liveCompanyProfile?.npwp || '-');
        const buyerPIC = isReturnIn ? (matchedCustomer?.penanggung_jawab || '_________________________') : (liveCompanyProfile?.penanggung_jawab || '_________________________');
        // Since the database is now the absolute source of truth, 
        // we extract the exact totals directly from the transaction record.
        const calculatedGrandTotal = Number(data.totalTransaksi || 0);
        const calculatedPpn = Number(data.pajak_nominal || 0);
        const ppnRate = Number(data.pajak_persen || 11);
        const calculatedSubtotal = calculatedGrandTotal - calculatedPpn;

        return (
            <div className="fixed inset-0 print:static print:inset-auto z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto print:overflow-visible flex print:block justify-center p-4 sm:p-8 print:m-0 print:p-0 print:w-full max-w-4xl mx-auto print:bg-white print-only-layout text-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div id="printable-return" className="faktur-container print-safe-wrapper bg-white p-10 shadow-2xl relative rounded-xl mx-auto text-black print:w-[210mm] print:mx-auto print:p-0 print:shadow-none print:rounded-none print:overflow-visible" style={{ minHeight: '297mm' }}>
                    
                    {/* Action Buttons - hidden on print */}
                    <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                        <button onClick={handlePrint} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-slate-800 border border-b shadow-sm">🖨️ Cetak</button>
                        <button onClick={onClose} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-slate-100 border border-b shadow-sm">✕ Tutup</button>
                    </div>

                    {/* Document Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold tracking-widest underline decoration-2 underline-offset-4">NOTA RETUR</h1>
                        <p className="text-sm mt-2">Nomor Nota Retur: {data.idTransaksi}</p>
                        <p className="text-sm mt-0.5">Tanggal Nota Retur: {new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-xs mt-1 italic text-slate-700">(atas nomor Faktur Pajak: {data.original_id || '[Faktur Pajak Asli]'} Tanggal {new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})</p>
                    </div>
                    
                    {/* Info Section - Buyer and Seller */}
                    <div className="mb-6 text-sm grid grid-cols-1 gap-4 print:break-inside-avoid">
                        <div className="border border-black p-3">
                            <p className="font-bold underline mb-1">Pembeli Barang Kena Pajak:</p>
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{buyerName}</td></tr>
                                    <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{buyerAddress}</td></tr>
                                    <tr><td className="w-32 py-0.5 align-top">NPWP</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-mono">{buyerNPWP}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="border border-black p-3">
                            <p className="font-bold underline mb-1">Penjual Barang Kena Pajak:</p>
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{sellerName}</td></tr>
                                    <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{sellerAddress}</td></tr>
                                    <tr><td className="w-32 py-0.5 align-top">NPWP</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-mono">{sellerNPWP}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Items & Calculations Table (Consolidated) */}
                    <table className="w-full text-sm border-collapse border border-black mb-2">
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
                                // Fallback logic: Primary (originalTransaction detail price), Fallback (harga_satuan from return detail)
                                const unitPrice = Number(item.original_harga_satuan ?? item.harga_satuan ?? 0);
                                const amount = Number(item.jumlah) * unitPrice;
                                return (
                                    <tr key={idx}>
                                        <td className="border border-black py-2 px-3 text-center">{idx + 1}</td>
                                        <td className="border border-black py-2 px-3 font-mono">{item.kodeBarang}</td>
                                        <td className="border border-black py-2 px-3">{item.namaBarang || item.item_nama || '-'} <br/><span className="text-xs text-slate-600">({item.jumlah} Pcs x {formatRp(unitPrice)})</span></td>
                                        <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="avoid-break print-summary-group">
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="3">Harga Jual yang diretur</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold print:text-black text-blue-700 w-[25%]">{formatRp(calculatedSubtotal)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="3">PPN yang diretur ({ppnRate}%)</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold print:text-black text-amber-700 w-[25%]">{formatRp(calculatedPpn)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-bold text-right bg-slate-50 print:bg-transparent" colSpan="3">TOTAL PENGEMBALIAN</td>
                                <td className="border border-black py-2 px-3 text-right font-bold bg-slate-50 print:bg-transparent text-emerald-700 w-[25%]">{formatRp(calculatedGrandTotal)}</td>
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
                                <p className="font-bold uppercase">( {sellerName} )</p>
                                <p className="text-xs text-slate-500 mt-1">{sellerPIC}</p>
                            </div>
                            <div className="flex flex-col items-center justify-end">
                                <p className="font-bold uppercase">Pembeli,</p>
                                <div className="h-24"></div>
                                <p className="font-bold uppercase">( {buyerName} )</p>
                                <p className="text-xs text-slate-500 mt-1">{buyerPIC}</p>
                            </div>
                        </div>

                        <div className="mt-12 text-[10px] text-slate-600 text-justify border-t border-slate-300 pt-3">
                            <span className="font-bold">Penting:</span> Sesuai dengan ketentuan yang berlaku, Direktorat Jenderal Pajak mengatur bahwa nota retur ini telah ditandatangani secara elektronik sehingga tidak diperlukan tanda tangan basah pada nota retur ini.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 print:static print:inset-auto z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto print:overflow-visible flex print:block justify-center p-4 sm:p-8 print:m-0 print:p-0 print:w-[190mm] print:max-w-[190mm] print:mx-auto max-w-4xl mx-auto print:bg-white print-only-layout text-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div id="printable-return" className="faktur-container print-safe-wrapper bg-white p-10 shadow-2xl relative rounded-xl mx-auto text-black print:w-[190mm] print:max-w-[190mm] print:mx-auto print:p-0 print:shadow-none print:rounded-none print:overflow-visible" style={{ minHeight: '297mm' }}>
                
                {/* Action Buttons - hidden on print */}
                <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"><Printer className="w-4 h-4" /> Print</button>
                    <button onClick={onClose} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-medium shadow hover:bg-slate-200 transition"><X className="w-5 h-5" /></button>
                </div>

                {/* Document Header */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold tracking-widest underline decoration-2 underline-offset-4">{docTitle}</h1>
                    <p className="text-sm mt-2">Nomor: {data.idTransaksi}</p>
                    <p className="text-sm mt-0.5">Tanggal: {data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                    <p className="text-sm mt-0.5">Printed By: {currentUser?.namaLengkap || 'System'}</p>
                </div>
                
                {/* Info Section - Vertically Stacked */}
                <div className="w-full flex flex-col gap-4 mb-6 text-sm print:flex-col print:gap-4 print:w-full print:mb-6 print:break-inside-avoid">
                    <div className="w-full border border-black p-3 print:w-full print:box-border">
                        <p className="font-bold underline mb-1">Pengirim ({fromTitle}):</p>
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{fromValue}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{fromAddress}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="w-full border border-black p-3 print:w-full print:box-border">
                        <p className="font-bold underline mb-1">Penerima ({toTitle}):</p>
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr><td className="w-32 py-0.5 align-top">Nama</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top font-semibold">{toValue}</td></tr>
                                <tr><td className="w-32 py-0.5 align-top">Alamat</td><td className="w-4 py-0.5 align-top">:</td><td className="py-0.5 align-top">{toAddress}</td></tr>
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
                            {showPriceColumn && <th className="border border-black p-2 text-right">Harga Satuan</th>}
                            {showPriceColumn && <th className="border border-black p-2 text-right">Subtotal</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {itemsList.map((item, idx) => {
                            const unitPrice = Number(item.harga_satuan || item.harga_modal_satuan || 0);
                            const amount = Number(item.jumlah) * unitPrice;
                            return (
                                <tr key={idx}>
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2 text-center font-mono text-[11px]">{item.kodeBarang || '-'}</td>
                                    <td className="border border-black p-2">{item.namaBarang || item.item_nama || '-'}</td>
                                    <td className="border border-black p-2 text-center font-bold">{item.jumlah}</td>
                                    <td className="border border-black p-2 text-center">Pcs</td>
                                    {showPriceColumn && <td className="border border-black p-2 text-right">{formatRp(unitPrice)}</td>}
                                    {showPriceColumn && <td className="border border-black p-2 text-right font-bold">{formatRp(amount)}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                    {showPriceColumn && (
                        <tfoot className="avoid-break print-summary-group bg-slate-50 print:bg-slate-50" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="6">Subtotal</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(subtotal)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="6">Dikurangi Potongan Harga</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(potonganHarga)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="6">Dikurangi Uang Muka</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(uangMuka)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="6">Dasar Pengenaan Pajak (DPP)</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(dpp)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="6">Tax / PPN ({pajakPersen}%)</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(pajakNominal)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-semibold text-right" colSpan="6">Pajak Penjualan Atas Barang Mewah (PPnBM)</td>
                                <td className="border border-black py-2 px-3 text-right font-semibold">{formatRp(ppnbm)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black py-2 px-3 font-bold text-right" colSpan="6">GRAND TOTAL</td>
                                <td className="border border-black py-2 px-3 text-right font-bold">{formatRp(grandTotal)}</td>
                            </tr>
                        </tfoot>
                    )}
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
                            <p className="font-bold uppercase tracking-wider text-[11px]">{sig1Label}</p>
                            <div className="h-24"></div>
                            <p className="font-bold uppercase underline">( {sig1Name} )</p>
                            {sig1PIC && <p className="text-[10px] text-slate-500 mt-1">{sig1PIC}</p>}
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <p className="font-bold uppercase tracking-wider text-[11px]">{sig2Label}</p>
                            <div className="h-24"></div>
                            <p className="font-bold uppercase underline">( {sig2Name} )</p>
                            {sig2PIC && <p className="text-[10px] text-slate-500 mt-1">{sig2PIC}</p>}
                        </div>
                    </div>

                    <div className="mt-12 text-[10px] text-slate-600 text-justify border-t border-slate-300 pt-3 text-center">
                        * Dokumen ini merupakan bukti sah pencatatan transaksi barang. Pastikan kuantitas fisik sesuai sebelum menandatangani.
                    </div>
                </div>

            </div>
        </div>
    );
}
