import React from 'react';
import { Package, Search } from '../components/icons/Icons';
import useAppStore from '../store/useAppStore';

export default function Notifikasi() {
    const { items } = useAppStore();
    const lowStockItems = items.filter(item => Number(item.stok) < Number(item.minStok));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-[28px] font-bold text-slate-800 tracking-tight">Notifikasi Stok</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Daftar barang yang stoknya mencapai ambang batas rendah</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm text-rose-500">
                        <span className="font-extrabold text-lg">!</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Peringatan Stok Rendah</h4>
                        <p className="text-xs mt-0.5 opacity-90">Terdapat <b>{lowStockItems.length}</b> barang yang perlu segera dipesan ulang.</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                        <thead className="text-slate-400 font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-3 font-bold">Kode Barang</th>
                                <th className="px-4 py-3 font-bold">Nama Barang</th>
                                <th className="px-4 py-3 font-bold">Kategori</th>
                                <th className="px-4 py-3 font-bold text-center">Stok Saat Ini</th>
                                <th className="px-4 py-3 font-bold text-center">Min Stok</th>
                                <th className="px-4 py-3 font-bold text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {lowStockItems.length > 0 ? lowStockItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3.5 font-bold text-slate-700">{item.kodeBarang}</td>
                                    <td className="px-4 py-3.5 text-slate-600 font-medium">{item.nama}</td>
                                    <td className="px-4 py-3.5 text-slate-500">{item.kategori}</td>
                                    <td className="px-4 py-3.5 text-center font-extrabold text-rose-600 text-base">{item.stok}</td>
                                    <td className="px-4 py-3.5 text-center font-medium text-slate-400">{item.minStok}</td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700">
                                            Kritis
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                                                <Package className="w-8 h-8" />
                                            </div>
                                            <p className="font-medium text-slate-600">Stok Aman</p>
                                            <p className="text-sm mt-1">Tidak ada barang yang stoknya di bawah batas minimum.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
