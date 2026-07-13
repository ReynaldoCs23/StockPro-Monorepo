import React, { useState, useEffect } from 'react';
import { Printer, X } from '../icons/Icons';
import { formatRp } from '../../utils/helpers';
import { apiCall } from '../../utils/api';

export default function SuratJalanPrintLayout({ data, onClose, currentUser, type = 'OUT', suppliers = [], customers = [], companyProfile }) {
    const [liveCompanyProfile, setLiveCompanyProfile] = useState(companyProfile);

    useEffect(() => {
        if (data) {
            apiCall('/company-profile').then(res => {
                if (res.data) setLiveCompanyProfile(res.data);
            }).catch(() => {});
        }
    }, [data]);

    if (!data) return null;

    const handlePrint = () => { window.print(); };

    const isMakloonOut = data.type === 'MAKLOON_OUT' || data.idTransaksi?.startsWith('MKL-OUT');
    const isMakloonIn  = data.type === 'MAKLOON_IN'  || data.idTransaksi?.startsWith('MKL-IN');
    const isMakloon    = isMakloonOut || isMakloonIn;
    const isReturnOut = (data.jenisReturn || data.sumber_tujuan || '').startsWith('RET_OUT');
    const isReturnIn = (data.jenisReturn || data.sumber_tujuan || '').startsWith('RET_IN');
    const isReturn = isReturnOut || isReturnIn;
    const isPenjualan = !isMakloon && !isReturn && (data.tujuan?.includes('Penjualan') || data.sumber_tujuan?.includes('Penjualan'));
    const isPembelian = !isMakloon && !isReturn && type === 'IN';

    const showPriceColumn = (isPenjualan || isPembelian) && !isMakloon && !isReturn;

    let docTitle = 'SURAT JALAN';
    if (isMakloonOut) docTitle = 'SURAT JALAN MAKLOON';
    else if (isMakloonIn) docTitle = 'BUKTI PENERIMAAN BARANG MAKLOON';
    else if (isReturnOut) docTitle = 'SURAT RETURN KELUAR';
    else if (isReturnIn) docTitle = 'SURAT RETURN MASUK';
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

    if (isReturnIn) {
        // Return Masuk: goods coming FROM customer/supplier TO our warehouse
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
    const pajakPersen = Number(data.pajak_persen || 0);
    const pajakNominal = Number(data.pajak_nominal || (subtotal * pajakPersen / 100));
    const grandTotal = Number(data.totalTransaksi) || (subtotal + pajakNominal);

    // Signatures
    let sig1Label = 'Dikirim Oleh', sig1Name = isPembelian ? (data.namaSupplier || 'Supplier') : 'Admin Gudang';
    let sig2Label = 'Penerima', sig2Name = isPembelian ? 'Admin Gudang' : (data.namaPembeli || data.entitas || 'Nama Terang');
    if (isMakloonOut) { sig1Name = 'Admin Gudang'; sig2Label = 'Penerima (Vendor)'; sig2Name = data.entitas || 'Vendor'; }
    else if (isMakloonIn) { sig1Label = 'Dikirim Oleh (Vendor)'; sig1Name = data.entitas || 'Vendor'; sig2Label = 'Penerima Gudang'; sig2Name = 'Admin Gudang'; }
    else if (isReturnIn) { sig1Label = 'Dikirim Oleh'; sig1Name = entityName; sig2Label = 'Penerima'; sig2Name = 'Admin Gudang'; }
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
                <div className="faktur-container print-safe-wrapper bg-white p-10 shadow-2xl relative rounded-xl mx-auto text-black print:w-[210mm] print:mx-auto print:p-0 print:shadow-none print:rounded-none print:overflow-visible" style={{ minHeight: '297mm' }}>
                    
                    {/* Action Buttons - hidden on print */}
                    <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                        <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-slate-800 border border-b shadow-sm">🖨️ Cetak</button>
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
        <div className="fixed inset-0 z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto print:bg-white flex justify-center p-4 sm:p-8 print:m-0 print:p-0 print:block print:w-full max-w-4xl mx-auto print-only-layout" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div className="faktur-container w-full max-w-[850px] print:w-full print:max-w-none print:shadow-none bg-white p-8 sm:p-12 print:p-4 shadow-2xl relative rounded-xl print:rounded-none mx-auto text-slate-900 print:text-black print:block print:scale-[0.95] origin-top print:min-h-0 print:h-auto print:overflow-visible">

                {/* Header Actions */}
                <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"><Printer className="w-4 h-4" /> Print</button>
                    <button onClick={onClose} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-medium shadow hover:bg-slate-200 transition"><X className="w-5 h-5" /></button>
                </div>

                {/* Company Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-5 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'}</h1>
                        <p className="text-slate-500 text-xs mt-1">{liveCompanyProfile?.alamat || 'JL KUMBA KARNA NO.1, BAKTISERAGA, BULELENG, BALI 81119'}</p>
                        <p className="text-slate-500 text-xs">Industrial Manufacturing & Distribution</p>
                    </div>
                    <div className="text-right">
                        <div className="inline-block bg-slate-900 text-white font-bold px-5 py-2 rounded text-sm uppercase tracking-widest">{docTitle}</div>
                    </div>
                </div>

                {/* Transaction Info */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                        <table className="text-sm">
                            <tbody>
                                <tr><td className="text-slate-500 pr-4 py-0.5 font-medium">No. Transaksi</td><td className="font-bold text-slate-800">: {data.idTransaksi}</td></tr>
                                <tr><td className="text-slate-500 pr-4 py-0.5 font-medium">Tanggal</td><td className="font-bold text-slate-800">: {new Date(data.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                                <tr><td className="text-slate-500 pr-4 py-0.5 font-medium">Printed By</td><td className="font-bold text-slate-800">: {currentUser?.namaLengkap || 'System'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{fromTitle}</p>
                            <p className="font-bold text-slate-800 text-sm">{fromValue}</p>
                            {fromAddress && <p className="text-xs text-slate-500 mt-0.5">{fromAddress}</p>}
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{toTitle}</p>
                            <p className="font-bold text-slate-800 text-sm">{toValue}</p>
                            {toAddress && <p className="text-xs text-slate-500 mt-0.5">{toAddress}</p>}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-sm mb-1 border border-slate-300 print:break-inside-avoid">
                    <thead>
                        <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-3 font-semibold w-[5%] text-center">No</th>
                            <th className="p-3 font-semibold w-[15%]">Kode</th>
                            <th className="p-3 font-semibold w-[30%]">Deskripsi / Item Description</th>
                            <th className="p-3 font-semibold text-center w-[10%]">Qty</th>
                            <th className="p-3 font-semibold w-[8%]">Unit</th>
                            {showPriceColumn && <th className="p-3 font-semibold text-right w-[16%]">Unit Price</th>}
                            {showPriceColumn && <th className="p-3 font-semibold text-right w-[16%]">Amount</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {itemsList.map((item, idx) => {
                            const unitPrice = Number(item.harga_satuan || item.harga_modal_satuan || 0);
                            const amount = Number(item.jumlah) * unitPrice;
                            return (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                                    <td className="p-3 font-mono text-xs font-bold text-blue-700">{item.kodeBarang}</td>
                                    <td className="p-3 font-medium text-slate-800">{item.namaBarang || item.item_nama || '-'}</td>
                                    <td className="p-3 text-center font-bold">{item.jumlah}</td>
                                    <td className="p-3 text-slate-600">Pcs</td>
                                    {showPriceColumn && <td className="p-3 text-right">{formatRp(unitPrice)}</td>}
                                    {showPriceColumn && <td className="p-3 text-right font-bold">{formatRp(amount)}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Totals */}
                {showPriceColumn ? (
                    <div className="flex justify-end mb-8 print:break-inside-avoid">
                        <div className="w-72 border border-slate-300 text-sm">
                            <div className="flex justify-between p-3 border-b border-slate-200">
                                <span className="text-slate-600">Subtotal</span>
                                <span className="font-bold">{formatRp(subtotal)}</span>
                            </div>
                            <div className="flex justify-between p-3 border-b border-slate-200">
                                <span className="text-slate-600">Tax / PPN ({pajakPersen}%)</span>
                                <span className="font-bold text-amber-700">{formatRp(pajakNominal)}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-slate-800 text-white">
                                <span className="font-bold">GRAND TOTAL</span>
                                <span className="font-black text-lg">{formatRp(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center border-t border-b border-slate-300 py-3 mb-8 print:break-inside-avoid">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500 mr-4">Total Items</span>
                        <span className="font-bold text-blue-700 text-lg">{data.jumlah || itemsList.reduce((s, i) => s + Number(i.jumlah), 0)}</span>
                    </div>
                )}

                {/* Notes */}
                {data.keterangan && (
                    <div className="mb-8 text-sm">
                        <span className="font-bold text-slate-600">Catatan: </span>
                        <span className="text-slate-500 italic">{data.keterangan}</span>
                    </div>
                )}

                {/* Signatures and Footer */}
                <div className="signature-section avoid-break print:break-inside-avoid">
                    <div className="grid grid-cols-3 gap-8 mt-12 px-2 text-xs print:mt-8">
                        <div className="text-center">
                            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{sig1Label}</p>
                            <div className="h-[100px]"></div>
                            <div className="border-t border-slate-400 mx-auto w-40 pt-2">
                                <p className="font-bold text-slate-800">( {sig1Name} )</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{sig2Label}</p>
                            <div className="h-[100px]"></div>
                            <div className="border-t border-slate-400 mx-auto w-40 pt-2">
                                <p className="font-bold text-slate-800">( {sig2Name} )</p>
                                <p className="text-[10px] text-slate-500 mt-1">{matchedCustomer?.penanggung_jawab || matchedSupplier?.penanggung_jawab || '_________________________'}</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Hormat Kami</p>
                            <div className="h-[100px]"></div>
                            <div className="border-t border-slate-400 mx-auto w-40 pt-2">
                                <p className="font-bold text-slate-800">{liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{liveCompanyProfile?.penanggung_jawab || '_________________________'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 text-[10px] text-slate-400 text-center border-t border-slate-100 pt-3">
                        * Dokumen ini merupakan bukti sah pencatatan transaksi barang. Pastikan kuantitas fisik sesuai sebelum menandatangani.
                    </div>
                </div>
            </div>
        </div>
    );
}
