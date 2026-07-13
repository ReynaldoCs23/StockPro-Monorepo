import React from 'react';
import { formatRp } from '../../utils/helpers';

export default function NotaPenerimaanMakloon({ data, onClose }) {
    if (!data) return null;

    const handlePrint = () => { window.print(); };

    const itemsList = data.items && data.items.length > 0
        ? data.items
        : [{ kodeBarang: data.kodeBarang, namaBarang: data.namaBarang, jumlah: data.jumlah, harga_satuan: 0 }];

    const pajakNominal = Number(data.pajak_nominal || 0);
    const grandTotal = Number(data.totalTransaksi || 0);

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50/50 backdrop-blur-sm overflow-y-auto flex justify-center p-4 sm:p-8 print:p-0 print:bg-white print-only-layout" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div className="w-full max-w-[210mm] print:w-full print:max-w-none bg-white p-10 print:p-8 shadow-2xl relative rounded-xl print:rounded-none print:shadow-none mx-auto text-slate-900 print:text-black" style={{ minHeight: '297mm' }}>

                {/* Action Buttons - hidden on print */}
                <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">🖨️ Cetak</button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300">✕ Tutup</button>
                </div>

                {/* Document Header */}
                <div className="text-center mb-8 border-b border-slate-800 pb-4">
                    <h1 className="text-xl font-black tracking-wide">BUKTI PENERIMAAN BARANG MAKLOON</h1>
                    <p className="text-sm text-slate-600 mt-1">No: {data.idTransaksi}</p>
                </div>

                {/* Info Section */}
                <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                    <div className="space-y-1">
                        <div><span className="text-slate-500 w-24 inline-block">Tanggal</span>: <span className="font-semibold">{data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></div>
                        <div><span className="text-slate-500 w-24 inline-block">Vendor</span>: <span className="font-semibold">{data.entitas || data.namaSupplier || '-'}</span></div>
                    </div>
                    <div className="space-y-1">
                        <div><span className="text-slate-500 w-24 inline-block">Ref. MKL-OUT</span>: <span className="font-semibold">{data.idReferensi || '-'}</span></div>
                        <div><span className="text-slate-500 w-24 inline-block">Keterangan</span>: <span className="font-semibold">{data.keterangan || '-'}</span></div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-sm border-collapse mb-6">
                    <thead>
                        <tr className="border-t-2 border-b border-slate-800">
                            <th className="py-2 text-left font-bold">No</th>
                            <th className="py-2 text-left font-bold">Kode Barang</th>
                            <th className="py-2 text-left font-bold">Nama Barang</th>
                            <th className="py-2 text-center font-bold">Qty</th>
                            <th className="py-2 text-right font-bold">Biaya Jasa/Unit</th>
                            <th className="py-2 text-right font-bold">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsList.map((item, idx) => {
                            const qty = Number(item.jumlah || 0);
                            const harga = Number(item.harga_satuan || item.harga_modal_satuan || 0);
                            return (
                                <tr key={idx} className="border-b border-slate-200">
                                    <td className="py-2">{idx + 1}</td>
                                    <td className="py-2">{item.kodeBarang}</td>
                                    <td className="py-2">{item.namaBarang}</td>
                                    <td className="py-2 text-center">{qty}</td>
                                    <td className="py-2 text-right">{formatRp(harga)}</td>
                                    <td className="py-2 text-right">{formatRp(qty * harga)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end">
                    <div className="w-64 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">PPN ({data.pajak_persen || 0}%)</span>
                            <span className="font-semibold">{formatRp(pajakNominal)}</span>
                        </div>
                        <div className="flex justify-between border-t-2 border-slate-800 pt-2">
                            <span className="font-bold">TOTAL</span>
                            <span className="font-black text-lg">{formatRp(grandTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 mt-16 text-center text-sm">
                    <div>
                        <p className="text-slate-500 mb-16">Diserahkan Oleh,</p>
                        <p className="border-t border-slate-400 pt-1 inline-block px-8 font-semibold">{data.entitas || 'Vendor'}</p>
                    </div>
                    <div>
                        <p className="text-slate-500 mb-16">Diterima Oleh,</p>
                        <p className="border-t border-slate-400 pt-1 inline-block px-8 font-semibold">Admin Gudang</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
