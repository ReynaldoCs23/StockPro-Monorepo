import React from 'react';

/**
 * ReportTemplate - Komponen cetak laporan dinamis
 * 
 * @param {string} reportType - 'inbound' | 'outbound' | 'return'
 * @param {string} dateRange - e.g., '01/10/2023 - 31/10/2023'
 * @param {Array} data - Array of transaction objects
 * @param {string} companyName - Nama perusahaan
 * @param {function} formatRp - Fungsi format uang
 */
export default function ReportTemplate({ reportType, dateRange, data, companyName, formatRp }) {
    // Tentukan judul laporan dan label kolom entitas berdasarkan tipe
    let title = 'Laporan Transaksi';
    let entityLabel = 'Entitas';

    if (reportType === 'inbound') {
        title = 'Laporan Barang Masuk';
        entityLabel = 'Nama Supplier';
    } else if (reportType === 'outbound') {
        title = 'Laporan Barang Keluar';
        entityLabel = 'Tujuan / Pelanggan';
    } else if (reportType === 'return') {
        title = 'Laporan Return Vendor';
        entityLabel = 'Vendor Tujuan';
    }

    // Kalkulasi Grand Total
    const totalQty = data.reduce((acc, row) => acc + (Number(row.jumlah) || 0), 0);
    const totalNilai = data.reduce((acc, row) => acc + (Number(row.totalTransaksi) || 0), 0);

    return (
        <div className="report-container font-sans text-slate-800 bg-white w-full max-w-5xl mx-auto p-8 print:p-0">
            
            {/* Kop Laporan */}
            <div className="text-center mb-8 border-b-2 border-slate-300 pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-wide">{companyName || 'PT Mara Jaya Dewi Sakti'}</h1>
                <h2 className="text-xl font-semibold mt-2 text-slate-600">{title}</h2>
                <p className="text-sm text-slate-500 mt-1">Periode: {dateRange}</p>
            </div>

            {/* Tabel Data */}
            <table className="w-full text-left border-collapse" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <thead className="bg-gray-100 print:bg-gray-100">
                    <tr>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700 whitespace-nowrap">No</th>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700 whitespace-nowrap">Tanggal</th>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700 whitespace-nowrap">ID Transaksi</th>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700">{entityLabel}</th>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700">Detail Item</th>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700 text-right whitespace-nowrap">Total Qty</th>
                        <th className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs font-semibold text-slate-700 text-right whitespace-nowrap">Total Nilai</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? (
                        data.map((row, idx) => (
                            <tr key={row.idTransaksi || idx} className="even:bg-gray-50 print:even:bg-gray-50 hover:bg-slate-50" style={{ pageBreakInside: 'avoid' }}>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-600">{idx + 1}</td>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-600 whitespace-nowrap">{row.tanggal?.split('T')[0] || '-'}</td>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-600 whitespace-nowrap font-medium">{row.idTransaksi}</td>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-700">{row.entitas || '-'}</td>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-600 max-w-xs truncate" title={row.isi_transaksi_detail}>
                                    {row.isi_transaksi_detail || '-'}
                                </td>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-700 text-right font-medium">{row.jumlah}</td>
                                <td className="border print:border-gray-300 px-4 py-2 text-sm print:text-xs text-slate-700 text-right whitespace-nowrap">{formatRp ? formatRp(row.totalTransaksi) : row.totalTransaksi}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="7" className="border print:border-gray-300 px-4 py-6 text-center text-sm print:text-xs text-slate-500 italic">
                                Tidak ada data transaksi untuk periode ini.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="bg-gray-100 print:bg-gray-100">
                    <tr>
                        <td colSpan="5" className="border print:border-gray-300 px-4 py-3 text-right font-bold text-slate-800 uppercase text-xs tracking-wider">Grand Total</td>
                        <td className="border print:border-gray-300 px-4 py-3 text-right font-bold text-blue-700 text-sm print:text-xs">{totalQty}</td>
                        <td className="border print:border-gray-300 px-4 py-3 text-right font-bold text-blue-700 text-sm print:text-xs whitespace-nowrap">{formatRp ? formatRp(totalNilai) : totalNilai}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Area Tanda Tangan */}
            <div className="mt-16 flex justify-between px-10">
                <div className="text-center">
                    <p className="text-sm text-slate-600 mb-20">Mengetahui,</p>
                    <p className="font-semibold text-slate-800 border-b border-slate-400 inline-block w-48">( ........................................ )</p>
                    <p className="text-xs text-slate-500 mt-1">Direktur / Manager</p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-slate-600 mb-20">Dibuat Oleh,</p>
                    <p className="font-semibold text-slate-800 border-b border-slate-400 inline-block w-48">( ........................................ )</p>
                    <p className="text-xs text-slate-500 mt-1">Staff Gudang</p>
                </div>
            </div>
        </div>
    );
}
