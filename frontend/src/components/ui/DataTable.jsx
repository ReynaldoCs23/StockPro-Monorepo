import React, { useState } from 'react';
import { Search, FileSpreadsheet, FileText, Plus, Edit, Trash2 } from '../icons/Icons';
import ConfirmModal from './ConfirmModal';
import dayjs from 'dayjs';

export default function DataTable({ 
    title, data, columns, onAdd, onEdit, onDelete, onPrint, idKey, filename, customFilter, hideActions,
    currentPage, lastPage, onPageChange, extraActions
}) {
    const [search, setSearch] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isCancelMode, setIsCancelMode] = useState(false);
    const filteredData = data.filter(row => 
        JSON.stringify(row).toLowerCase().includes(search.toLowerCase())
    );
    
    const handleExportCSV = () => {
        if (!filteredData || filteredData.length === 0) return;
        const exportCols = columns.filter(c => c.label !== 'Aksi'); 
        const headers = exportCols.map(c => `"${c.label}"`).join(',');
        const rows = filteredData.map(row => {
            return exportCols.map(c => {
                let val = c.exportFormat ? c.exportFormat(row[c.key], row) : row[c.key];
                if (c.key === 'tanggal' && val) val = new Date(val).toLocaleDateString('id-ID');
                if (val === null || val === undefined) val = '-';
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(',');
        }).join('\n');
        
        const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filename}.csv`;
        a.click();
    };

    const needsLandscape = columns.length >= 7;

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] print:border-none print:shadow-none print:p-0">
            <style>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .print-table { 
                        table-layout: auto !important; 
                        width: 100% !important; 
                        border-collapse: collapse !important;
                    }
                    .print-table th, .print-table td {
                        border: 1px solid #d1d5db !important;
                        padding: 8px 12px !important;
                        white-space: nowrap !important;
                    }
                    .print-table th {
                        background-color: #f3f4f6 !important;
                        color: #374151 !important;
                    }
                    .print-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }
                    .print-table tbody tr:nth-child(even) {
                        background-color: #f9fafb !important;
                    }
                }
            `}</style>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
                <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Cari data..." className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button onClick={handleExportCSV} className="p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 rounded-xl transition-colors" title="Export CSV"><FileSpreadsheet className="w-4 h-4" /></button>
                    <button onClick={() => window.print()} className="p-2.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 rounded-xl transition-colors" title="Print Laporan"><FileText className="w-4 h-4" /></button>
                    {customFilter && customFilter}
                    {onAdd && <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"><Plus className="w-4 h-4" /> Tambah</button>}
                </div>
            </div>
            
            <div className="hidden print:block mb-6 text-center pb-3 border-b border-slate-400">
               <p className="text-[12px] text-slate-500 font-medium tracking-widest uppercase">PT Mara Jaya Dewi Sakti</p>
               <h1 className="text-xl font-bold uppercase tracking-wider mt-1 text-slate-900">Laporan {title}</h1>
               <p className="text-[10px] text-slate-500 mt-1">Dicetak pada: {new Date().toLocaleString('id-ID')} &bull; Total Data: {filteredData.length}</p>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-slate-200 print:border-none print:overflow-visible">
                <table className="print-table w-full text-left text-sm text-slate-600 print:text-[11px] print:text-slate-900">
                    <thead className="bg-slate-50 text-slate-700 border-b">
                        <tr>
                            {columns.map((col, idx) => <th key={idx} className="px-5 py-4 whitespace-nowrap font-semibold">{col.label}</th>)}
                            {(onEdit || onDelete || onPrint || extraActions) && <th className="px-5 py-4 whitespace-nowrap font-semibold text-center print:hidden">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-none">
                        {filteredData.length > 0 ? filteredData.map((row, idx) => {
                            const isProtected = hideActions && hideActions(row);
                            return (
                                <tr key={idx} className="hover:bg-slate-50">
                                    {columns.map((col, cIdx) => <td key={cIdx} className="px-5 py-4">{col.format ? col.format(row[col.key], row) : row[col.key]}</td>)}
                                    {(onEdit || onDelete || onPrint || extraActions) && (
                                        <td className="px-5 py-4 whitespace-nowrap text-center print:hidden">
                                            <div className="flex items-center justify-center gap-2">
                                                {extraActions && extraActions(row)}
                                                {onPrint && <button onClick={() => onPrint(row)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Print Surat Jalan/Struk"><FileText className="w-4 h-4" /></button>}
                                                {(() => {
                                                    if (isProtected) return null;
                                                    
                                                    const isTransaction = !!row.idTransaksi;
                                                    if (isTransaction) {
                                                        if (row.status !== 'scheduled') {
                                                            return null;
                                                        } else {
                                                            return (
                                                                <>
                                                                    {onEdit && <button onClick={() => onEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Ubah Transaksi Scheduled"><Edit className="w-4 h-4" /></button>}
                                                                    {onDelete && <button onClick={() => { setDeleteTarget(row[idKey]); setIsCancelMode(true); }} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="Batalkan Transaksi"><Trash2 className="w-4 h-4" /></button>}
                                                                </>
                                                            );
                                                        }
                                                    } else {
                                                        return (
                                                            <>
                                                                {onEdit && <button onClick={() => onEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Edit Data"><Edit className="w-4 h-4" /></button>}
                                                                {onDelete && <button onClick={() => { setDeleteTarget(row[idKey]); setIsCancelMode(false); }} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus Data"><Trash2 className="w-4 h-4" /></button>}
                                                            </>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        }) : <tr><td colSpan={columns.length + (onEdit || onDelete || onPrint || extraActions ? 1 : 0)} className="px-5 py-12 text-center text-slate-400">Tidak ada data.</td></tr>}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => { setDeleteTarget(null); setIsCancelMode(false); }}
                onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); setIsCancelMode(false); }}
                title={isCancelMode ? "Batalkan Transaksi" : "Hapus Data"}
                message={isCancelMode ? "Batalkan transaksi terjadwal ini? Alokasi stok akan dilepas." : "Yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."}
                confirmText={isCancelMode ? "Ya, Batalkan" : "Ya, Hapus"}
                variant={isCancelMode ? "warning" : "danger"}
            />

            {lastPage > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 print:hidden">
                    <span className="text-sm font-medium text-slate-500">
                        Halaman {currentPage} dari {lastPage}
                    </span>
                    <div className="flex gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => onPageChange(currentPage - 1)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                        >
                            Sebelumnya
                        </button>
                        <button 
                            disabled={currentPage === lastPage}
                            onClick={() => onPageChange(currentPage + 1)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}