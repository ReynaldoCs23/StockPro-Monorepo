import useAppStore from '../store/useAppStore';
import React, { useState } from 'react';
import { ClipboardList } from '../components/icons/Icons';
import DataTable from '../components/ui/DataTable';
import { getLocalYYYYMMDD } from '../utils/helpers';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';

export default function Logs() {
    const { logs } = useAppStore();
    // Setup tanggal default (7 hari terakhir)
    const todayString = getLocalYYYYMMDD();
    const todayDate = new Date();
    const endDefault = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
    const startDefault = endDefault;

    const [filterStart, setFilterStart] = useState(startDefault);
    const [filterEnd, setFilterEnd] = useState(endDefault);

    // Filter log berdasarkan rentang tanggal
    const filteredLogs = logs.filter(l => {
        if (!l.waktu) return true;
        // Menangani format ISO T string maupun string spasi biasa dari database
        const tgl = l.waktu.includes('T') ? l.waktu.split('T')[0] : l.waktu.split(' ')[0];
        return tgl >= filterStart && tgl <= filterEnd;
    });

    // Mengurutkan log agar yang paling baru (terbaru) berada di atas
    const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

    // Standardized columns for print and screen
    const logColumns = [
        { 
            key: 'idLog', 
            label: 'ID', 
        },
        { 
            key: 'waktu', 
            label: 'Tanggal/Waktu', 
            format: v => v ? new Date(v).toLocaleString('id-ID') : '-' 
        },
        { 
            key: 'user', 
            label: 'User/Aktor', 
            format: v => <span className="font-medium text-slate-800">{v}</span> 
        },
        { 
            key: 'aksi', 
            label: 'Aksi/Aktivitas', 
            format: v => (
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    v === 'DELETE' ? 'bg-rose-100 text-rose-700' : 
                    v === 'UPDATE' ? 'bg-amber-100 text-amber-700' : 
                    v === 'CREATE' ? 'bg-emerald-100 text-emerald-700' : 
                    v === 'ERROR' || v === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-700'
                }`}>
                    {v}
                </span>
            ) 
        },
        { 
            key: 'modul', 
            label: 'Modul' 
        },
        { 
            key: 'keterangan', 
            label: 'Rincian / Keterangan', 
            format: (v, row) => {
                if (row.payload) {
                    try {
                        const changes = JSON.parse(row.payload);
                        return (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-slate-700 font-medium">{v}</span>
                                <div className="flex flex-col gap-1 pl-2 border-l-2 border-slate-200">
                                    {Object.entries(changes).map(([field, diff]) => (
                                        <div key={field} className="flex items-center text-[11px] font-mono">
                                            <span className="font-semibold text-slate-600 w-28 truncate capitalize mr-2">{field.replace(/_/g, ' ')}</span>
                                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded line-through">{String(diff.old ?? '-')}</span>
                                            <span className="text-slate-400 mx-2">➔</span>
                                            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">{String(diff.new ?? '-')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    } catch (e) {
                        return <span className="text-slate-500 italic">{v}</span>;
                    }
                }
                return <span className="text-slate-500 italic">{v}</span>;
            } 
        }
    ];

    // UI Khusus untuk filter tanggal di sebelah kanan atas tabel
    const customFilterUI = (
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm print:hidden">
            <input 
                type="date" 
                max={filterEnd} 
                value={filterStart} 
                onChange={e => setFilterStart(e.target.value)} 
                className="text-sm outline-none bg-transparent font-medium text-slate-700 cursor-pointer" 
            />
            <span className="text-slate-300 font-bold">-</span>
            <input 
                type="date" 
                min={filterStart} 
                value={filterEnd} 
                onChange={e => setFilterEnd(e.target.value)} 
                className="text-sm outline-none bg-transparent font-medium text-slate-700 cursor-pointer" 
            />
        </div>
    );

    return (
        <>
            <div className="print:hidden">
                {/* Header Halaman Logs */}
                <div className="mb-6 border-b border-slate-100 pb-4">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-blue-600 border border-slate-200 shadow-sm">
                            <ClipboardList className="w-6 h-6" />
                        </div>
                        Audit Trail (Log Sistem)
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm">
                        Rekam jejak transparan untuk seluruh aktivitas dan modifikasi data oleh pengguna.
                    </p>
                </div>

                {/* Tabel Data Log */}
                <DataTable 
                    title="Log Aktivitas" 
                    filename="Log_Sistem" 
                    data={sortedLogs} 
                    idKey="idLog" 
                    customFilter={customFilterUI}
                    columns={logColumns} 
                />
            </div>
            
            <ReportPrintTemplate 
                title="LAPORAN AUDIT & LOG AKTIVITAS SISTEM"
                type="master"
                columns={logColumns} 
                data={sortedLogs} 
                dateRange={filterStart && filterEnd ? `${filterStart} s/d ${filterEnd}` : null}
            />
        </>
    );
}