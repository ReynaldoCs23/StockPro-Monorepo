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

    const handlePrint = () => { window.print(); };

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
    const isMakloonOut = data.type === 'MAKLOON_OUT' || data.idTransaksi?.startsWith('MKL-OUT');
    const isPembelian = ['IN', 'MAKLOON_IN'].includes(data.type) || data.idTransaksi?.startsWith('IN-') || data.idTransaksi?.startsWith('MKL-IN');

    // ============================================================
    // TASK 3: MKL-OUT renders as Surat Jalan (no Faktur/tax layout)
    // ============================================================
    if (isMakloonOut) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto flex justify-center p-4 sm:p-8 print:m-0 print:p-0 print:block print:w-full max-w-4xl mx-auto print:bg-white print-only-layout" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div className="faktur-container invoice-root-container bg-white relative rounded-xl print:rounded-none print:mx-auto print:w-full print:max-w-4xl mx-auto print:shadow-none shadow-2xl print:block print:min-h-0 print:h-auto print:overflow-visible" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#000' }}>

                    <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                        <button onClick={handlePrint} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">🖨️ Cetak</button>
                        <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300">✕ Tutup</button>
                    </div>

                    {/* Header */}
                    <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
                        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>SURAT JALAN MAKLOON</h1>
                        <p style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginTop: '4px' }}>No: {data.idTransaksi} &nbsp;|&nbsp; Tanggal: {data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                    </div>

                    {/* Destination Info */}
                    <div style={{ marginBottom: '16px', fontSize: '11px' }}>
                        <table>
                            <tbody>
                                <tr><td style={{ padding: '2px 0', width: '80px' }}>Dari</td><td style={{ padding: '2px 0' }}>: <strong>{liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'}</strong></td></tr>
                                <tr><td style={{ padding: '2px 0' }}>Kepada</td><td style={{ padding: '2px 0' }}>: <strong>{entityData.nama}</strong></td></tr>
                                <tr><td style={{ padding: '2px 0', verticalAlign: 'top' }}>Alamat</td><td style={{ padding: '2px 0' }}>: {entityData.alamat}</td></tr>
                                {data.keterangan && <tr><td style={{ padding: '2px 0' }}>Keterangan</td><td style={{ padding: '2px 0' }}>: {data.keterangan}</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Simple Items Table - NO HARGA */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', width: '6%' }}>No.</th>
                                <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', width: '20%' }}>Kode Barang</th>
                                <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'left', fontWeight: 'bold', fontSize: '10px', width: '49%' }}>Nama Barang</th>
                                <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', width: '12%' }}>Qty</th>
                                <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', width: '13%' }}>Satuan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsList.map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>{item.kodeBarang}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px 4px' }}>{item.namaBarang || item.item_nama || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{item.jumlah}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>Pcs</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Signatures and Footer */}
                    <div className="signature-section avoid-break">
                        <div className="print:mt-8" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', textAlign: 'center', fontSize: '10px' }}>
                            <div style={{ width: '45%' }}>
                                <p>Yang Menyerahkan,</p>
                                <div style={{ height: '60px' }}></div>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{liveCompanyProfile?.nama || 'PT Mara Jaya Dewi Sakti'}</p>
                                <p>{liveCompanyProfile?.penanggung_jawab || 'GEDE ARIADI'}</p>
                            </div>
                            <div style={{ width: '45%' }}>
                                <p>Yang Menerima,</p>
                                <div style={{ height: '60px' }}></div>
                                <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{entityData.nama}</p>
                                <p>{entityData.penanggung_jawab}</p>
                            </div>
                        </div>

                        <div style={{ marginTop: '30px', fontSize: '9px', color: '#666', textAlign: 'center', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                            * Pastikan kuantitas fisik sesuai sebelum menandatangani dokumen ini.
                        </div>
                    </div>
                </div>

            </div>
        );
    }

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
    const hargaJualTotal = itemsList.reduce((sum, item) => sum + (Number(item.jumlah || 0) * Number(item.harga_satuan || item.harga_modal_satuan || 0)), 0);
    const potonganHarga = 0;
    const dpp = hargaJualTotal - potonganHarga;
    const pajakPersen = Number(data.pajak_persen || 0);
    const ppn = Number(data.pajak_nominal || 0) || (dpp * pajakPersen / 100);
    const grandTotal = dpp + ppn;

    return (
        <div className="fixed inset-0 print:static print:inset-auto z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto print:overflow-visible flex print:block justify-center p-4 sm:p-8 print:m-0 print:p-0 print:w-[190mm] print:max-w-[190mm] print:mx-auto max-w-4xl mx-auto print:bg-white print-only-layout text-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div className="faktur-container print-safe-wrapper bg-white p-10 shadow-2xl relative rounded-xl mx-auto text-black print:w-[190mm] print:max-w-[190mm] print:mx-auto print:p-0 print:shadow-none print:rounded-none print:overflow-visible" style={{ minHeight: '297mm' }}>
                
                {/* Action Buttons - hidden on print */}
                <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                    <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-slate-800 border border-b shadow-sm">🖨️ Cetak</button>
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
