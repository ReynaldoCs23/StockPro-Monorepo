import React, { useState, useMemo } from 'react';
import { Search, Calendar } from '../components/icons/Icons';
import { getLocalYYYYMMDD, formatLocalDate } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

export default function SemuaAktivitas() {
    const { inbound, outbound, returns } = useAppStore();
    const todayDate = new Date();
    const endDefault = getLocalYYYYMMDD();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDefault = getLocalYYYYMMDD(sevenDaysAgo);

    const [startDate, setStartDate] = useState(startDefault);
    const [endDate, setEndDate] = useState(endDefault);
    const [searchTerm, setSearchTerm] = useState('');

    const allTransactions = useMemo(() => {
        const list = [
            ...inbound.map(t => ({ Tipe: 'Masuk', ID: t.idTransaksi, Tanggal: t.tanggal, Barang: t.namaBarang || (Array.isArray(t.items) ? `${t.items.length} Jenis Barang` : '-'), Jumlah: `+${t.jumlah || 0}`, Keterangan: t.namaSupplier || t.entitas || t.sumber || '-' })),
            ...outbound.map(t => ({ Tipe: 'Keluar', ID: t.idTransaksi, Tanggal: t.tanggal, Barang: t.namaBarang || (Array.isArray(t.items) ? `${t.items.length} Jenis Barang` : '-'), Jumlah: `-${t.jumlah || 0}`, Keterangan: t.namaPembeli || t.entitas || t.tujuan || '-' })),
            ...returns.map(t => {
                const isOut = (t.sumber_tujuan || t.jenisReturn || '').startsWith('RET_OUT') || t.jenisReturn === 'Return ke Vendor';
                return {
                    Tipe: isOut ? 'Keluar' : 'Masuk',
                    ID: t.idTransaksi,
                    Tanggal: t.tanggal,
                    Barang: Array.isArray(t.items) ? `${t.items.length} Jenis Barang` : (t.namaBarang || '-'),
                    Jumlah: isOut ? `-${t.jumlah || 0}` : `+${t.jumlah || 0}`,
                    Keterangan: t.sumber_tujuan || t.jenisReturn || 'Return'
                };
            })
        ].filter(row => {
            if (!row.Tanggal) return true;
            const tgl = getLocalYYYYMMDD(row.Tanggal);
            return tgl >= startDate && tgl <= endDate;
        }).sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));

        if (!searchTerm) return list;

        const term = searchTerm.toLowerCase();
        return list.filter(row => JSON.stringify(row).toLowerCase().includes(term));
    }, [inbound, outbound, returns, searchTerm, startDate, endDate]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-[28px] font-bold text-slate-800 tracking-tight">Semua Aktivitas</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Riwayat lengkap barang masuk, keluar, dan return</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {/* Date Filter */}
                    <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer w-full sm:w-auto" />
                        <span className="text-slate-300 font-bold mx-2">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer w-full sm:w-auto" />
                    </div>

                    <div className="flex items-center bg-white px-4 py-2.5 rounded-xl border border-slate-200 w-full sm:w-80 focus-within:border-b focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        <input 
                            type="text" 
                            placeholder="Cari transaksi..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full text-slate-600 placeholder:text-slate-400" 
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                        <thead className="text-slate-400 font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-3 font-bold">Barang / SKU</th>
                                <th className="px-4 py-3 font-bold">Tanggal</th>
                                <th className="px-4 py-3 font-bold">Tipe</th>
                                <th className="px-4 py-3 font-bold">Keterangan</th>
                                <th className="px-4 py-3 font-bold text-right">Perubahan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {allTransactions.length > 0 ? allTransactions.map((t, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <div className="font-bold text-slate-700">{t.Barang}</div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">{t.ID}</div>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-500 font-medium">{formatLocalDate(t.Tanggal)}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold ${t.Tipe === 'Masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {t.Tipe.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-500">{t.Keterangan}</td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold ${t.Tipe === 'Masuk' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {t.Jumlah} Unit
                                        </span>
                                    </td>
                                </tr>
                            )) : <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400 font-medium">Tidak ada transaksi ditemukan.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}