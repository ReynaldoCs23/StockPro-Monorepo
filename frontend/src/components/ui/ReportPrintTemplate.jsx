import React from 'react';
import useAppStore from '../../store/useAppStore';

const ReportPrintTemplate = ({ title, type, columns, data, dateRange }) => {
    const { companyProfile, currentUser } = useAppStore();

    // Compute totals
    const totalTransaksi = data.length;

    const totalQty = data.reduce((sum, item) => {
        // Logic for quantity counting across different data shapes
        return sum + (Number(item.jumlah) || Number(item.qty) || (item.items ? item.items.reduce((s, i) => s + Number(i.jumlah || 0), 0) : 0) || 0);
    }, 0);

    const grandTotal = type === 'transaction'
        ? data.reduce((sum, item) => sum + (Number(item.totalTransaksi) || Number(item.total_nilai) || Number(item.total_jumlah) || (Number(item.qty) * Number(item.harga)) || 0), 0)
        : 0;

    const formatRp = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

    // Derive form number based on title
    let formNumber = 'FM-WH-ALL-' + new Date().getFullYear() + '-09';
    let refCode = 'ALL';
    if (title.toLowerCase().includes('masuk')) { formNumber = 'FM-WH-IN-' + new Date().getFullYear() + '-09'; refCode = 'IN'; }
    else if (title.toLowerCase().includes('keluar')) { formNumber = 'FM-WH-OUT-' + new Date().getFullYear() + '-09'; refCode = 'OUT'; }
    else if (title.toLowerCase().includes('return')) { formNumber = 'FM-WH-RET-' + new Date().getFullYear() + '-09'; refCode = 'RET'; }

    return (
        <div className="hidden print:block w-full bg-white text-black p-0 m-0 print-safe-wrapper" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style>{`
            @page {
                size: landscape;
                margin: 15mm;
            }
            :where(.print-safe-wrapper) *, 
            :where(.print-safe-wrapper) *::before, 
            :where(.print-safe-wrapper) *::after {
                border-color: rgba(226, 232, 240, 1);
                outline-color: rgba(226, 232, 240, 1);
                text-decoration-color: rgba(226, 232, 240, 1);
            }
            .print-table-cell {
                word-break: break-word;
                hyphens: auto;
            }
        `}</style>

            {/* Header Section */}
            <div className="flex justify-between items-end mb-3">
                <div>
                    <h1 className="text-2xl font-black text-[#1e293b] tracking-tight mb-1">{companyProfile?.nama || 'PT MARA JAYA DEWI SAKTI'}</h1>
                    <p className="text-[11px] text-[#2563eb] font-bold tracking-wider uppercase">SISTEM MANAJEMEN INVENTARIS — STOCKPRO</p>
                    <p className="text-[10px] text-[#64748b] mt-1.5">{companyProfile?.alamat || 'Kawasan Industri Cemerlang Blok B-4, Jakarta Barat'} | Telp: 0362-3435401 | gede.ariadi@gmail.com</p>
                </div>
                <div className="text-right bg-slate-50 border border-slate-200 px-4 py-2.5 rounded text-[9px] text-[#64748b]">
                    <p className="uppercase text-[8px] tracking-wider mb-0.5">NO. FORMULIR / SOP</p>
                    <p className="font-bold text-[#1e293b] text-[11px]">{formNumber}</p>
                </div>
            </div>
            <div className="border-b-2 border-slate-800 mb-1 w-full"></div>
            <div className="border-b-4 border-slate-300 mb-6 w-full"></div>

            {/* Title Section */}
            <div className="text-center mb-6">
                <h2 className="text-lg font-extrabold text-[#1e293b] mb-1 uppercase tracking-wide inline-block border-b-2 border-blue-600 pb-1">{title}</h2>
                <p className="text-[10px] text-[#475569] mt-2">
                    Dicetak pada: <strong className="text-slate-800">{new Date().toLocaleString('id-ID')} WIB</strong> • Operator: <strong className="text-slate-800">{currentUser?.namaLengkap || 'Administrator Super'} ({currentUser?.role || 'User'})</strong>
                </p>
                {dateRange && <p className="text-[10px] text-slate-500 mt-1">Periode: {dateRange}</p>}
            </div>

            {/* Summary Cards */}
            {type === 'master' ? (
                <div className="flex justify-end mb-5">
                    <div className="border border-slate-200 rounded p-3 bg-[#f8fafc] w-64 shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL DATA MASTER</p>
                        <div className="text-sm font-extrabold text-blue-600">{data.length} <span className="text-[10px] text-slate-500 font-normal text-black">Data Tersimpan</span></div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="border border-slate-200 rounded p-3 bg-[#f8fafc]">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL TRANSAKSI</p>
                        <div className="text-sm font-extrabold text-slate-800">{totalTransaksi} <span className="text-[10px] text-slate-500 font-normal">Transaksi</span></div>
                    </div>
                    <div className="border border-slate-200 rounded p-3 bg-[#f8fafc]">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL KUANTITAS</p>
                        <div className="text-sm font-extrabold text-slate-800">{totalQty.toLocaleString('id-ID')} <span className="text-[10px] text-slate-500 font-normal">Unit</span></div>
                    </div>
                    <div className="border border-slate-200 rounded p-3 bg-[#f8fafc]">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL NILAI {title.toLowerCase().includes('masuk') ? 'MASUK' : title.toLowerCase().includes('keluar') ? 'KELUAR' : ''}</p>
                        <div className="text-sm font-extrabold text-blue-600">{formatRp(grandTotal)}</div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <table className="w-full border-collapse border border-slate-200 text-[10px] table-fixed">
                <thead>
                    <tr className="bg-slate-100 print:bg-slate-100">
                        <th className="border border-slate-200 px-1 py-1.5 text-center font-bold text-slate-600 w-8">NO</th>
                        {columns.filter(col => (col.header || col.label) !== 'Aksi' && col.key !== 'status').map((col, idx) => (
                            <th key={idx} className="border border-slate-200 px-1.5 py-1.5 text-left font-bold text-slate-600 uppercase tracking-wider print-table-cell">
                                {col.header || col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIdx) => (
                        <tr key={rowIdx} className="page-break-inside-avoid print:break-inside-avoid">
                            <td className="border border-slate-200 px-1 py-1.5 text-center text-slate-500">{rowIdx + 1}</td>
                            {columns.filter(col => (col.header || col.label) !== 'Aksi' && col.key !== 'status').map((col, colIdx) => {
                                let cellValue = row[col.accessor || col.key];
                                if (col.render) cellValue = col.render(row);
                                else if (col.exportFormat) cellValue = col.exportFormat(cellValue, row);
                                else if (col.format) cellValue = col.format(cellValue, row);

                                return (
                                    <td key={colIdx} className="border border-slate-200 px-1.5 py-1.5 align-top text-slate-700 print-table-cell">
                                        {cellValue}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
                {type === 'transaction' && grandTotal > 0 && (
                    <tfoot className="print-summary-group print:break-inside-avoid bg-slate-50">
                        <tr className="font-bold">
                            {(() => {
                                const cols = columns.filter(col => (col.header || col.label) !== 'Aksi' && col.key !== 'status');
                                const qtyIdx = cols.findIndex(c => c.key === 'jumlah' || c.key === 'qty' || c.key === 'items');
                                const totalIdx = cols.findIndex(c => c.key === 'totalTransaksi' || c.key === 'total_nilai');

                                return (
                                    <>
                                        <td className="border border-slate-200 px-1 py-2 text-center"></td>
                                        {cols.map((col, idx) => {
                                            if (idx === qtyIdx) {
                                                return <td key={idx} className="border border-slate-200 px-1.5 py-2 text-left text-slate-800 text-[10px] whitespace-nowrap">{totalQty.toLocaleString('id-ID')}</td>;
                                            } else if (idx === totalIdx) {
                                                return <td key={idx} className="border border-slate-200 px-1.5 py-2 text-right font-extrabold text-slate-800 text-[10px] whitespace-nowrap">{formatRp(grandTotal)}</td>;
                                            } else if (idx === qtyIdx - 1) {
                                                return <td key={idx} className="border border-slate-200 px-1.5 py-2 text-right uppercase text-slate-600 tracking-wider text-[9px] whitespace-nowrap">GRAND TOTAL:</td>;
                                            } else {
                                                return <td key={idx} className="border border-slate-200 px-1.5 py-2"></td>;
                                            }
                                        })}
                                    </>
                                );
                            })()}
                        </tr>
                    </tfoot>
                )}
            </table>

            {/* Catatan Note */}
            <div className="mt-4 bg-slate-50 border-l-4 border-blue-600 p-3 rounded-r text-[9px] text-slate-600 leading-relaxed page-break-inside-avoid print:break-inside-avoid">
                {type === 'master' ? (
                    <><strong className="text-slate-800">Catatan Data Master:</strong> Dokumen ini merupakan cetakan resmi data master dari database utama StockPro ERP dan dapat dipertanggungjawabkan validitas informasinya.</>
                ) : (
                    <><strong className="text-slate-800">Catatan Mutasi:</strong> Seluruh fisik barang pada laporan di atas telah melalui proses Quality Control (QC) dan verifikasi dokumen yang diatur sesuai dengan standard operating procedure (SOP) pergudangan StockPro ERP.</>
                )}
            </div>

            {/* Page Footer */}
            <div className="mt-8 flex justify-between items-end text-[8px] text-slate-400 italic pt-2 border-t border-slate-200">
                <div>
                    * Dokumen ini dicetak otomatis secara sistem komputerisasi StockPro ERP dan merupakan bukti sah transaksi fisik barang gudang.
                </div>
                <div className="text-right">
                    Ref: {new Date().getMonth() + 1}{new Date().getDate().toString().padStart(2, '0')}-{refCode}-ALL
                </div>
            </div>
        </div>
    );
};

export default ReportPrintTemplate;
