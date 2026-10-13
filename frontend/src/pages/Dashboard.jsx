import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Package, Tags, ArrowDownToLine, ArrowUpFromLine, Download, Plus, Search, Calendar } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import ProjectionDashboard from '../components/ProjectionDashboard';
import { formatRp, getDaysArray } from '../utils/helpers';
import { apiCall } from '../utils/api';

export default function Dashboard() {
    const { items, inbound, outbound, returns, users, currentUser, currentUserPermissions = [] } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const canViewForecasting = isAdminOrSuperadmin || currentUserPermissions.includes('view_ai_forecasting');
    const navigate = useNavigate();
    const getLocalYYYYMMDD = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    const todayDate = new Date();
    const endDefault = getLocalYYYYMMDD(todayDate);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDefault = getLocalYYYYMMDD(sevenDaysAgo);

    const [startDate, setStartDate] = useState(startDefault);
    const [endDate, setEndDate] = useState(endDefault);
    const [refreshKey, setRefreshKey] = useState(0);
    const [backendStats, setBackendStats] = useState({
        barangMasuk: { value: 0, percentage: 0, trend: 'up' },
        barangKeluar: { value: 0, percentage: 0, trend: 'up' },
        pengeluaranVendor: { value: 0, percentage: 0, trend: 'up' },
        penjualanDistributor: { value: 0, percentage: 0, trend: 'up' },
        labaBersih: 0,
        chartData: [],
        categoryProfitArray: [],
        maxProfit: 1,
        profitDonut: [],
        totalProfit: 0,
        vipCustomers: [],
        slowMoving: [],
        stokDibooking: 0,
        deadStock: [],
    });

    React.useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await apiCall(`/dashboard?start_date=${startDate}&end_date=${endDate}`);
                
                // Enforce Chronological Data Sorting
                if (res && res.chartData && Array.isArray(res.chartData)) {
                    res.chartData.sort((a, b) => new Date(a.Tanggal) - new Date(b.Tanggal));
                }

                // console.log("Dashboard Data:", res);
                setBackendStats(res);
            } catch (err) {
                console.error("Gagal mengambil data dashboard:", err);
            }
        };
        fetchDashboardData();
    }, [startDate, endDate, refreshKey]);

    React.useEffect(() => {
        if (window.Echo) {
            const channel = window.Echo.channel('inventory-channel');
            channel.listen('.stok.updated', (e) => {
                setRefreshKey(prev => prev + 1);
            });
            return () => {
                channel.stopListening('.stok.updated');
            };
        }
    }, []);

    // === OPTIMASI: Pecah useMemo menjadi 3 bagian independen ===

    // 1/3: Statistik Katalog — hanya dihitung ulang jika data items berubah
    const itemStats = useMemo(() => {
        const totalJenis = items.length;
        const totalStok = items.reduce((acc, curr) => acc + Number(curr.stok || 0), 0);
        return { totalJenis, totalStok };
    }, [items]);

    // 2/3: User Aktif — hanya dihitung ulang jika data users berubah
    const activeUsers = useMemo(() => {
        const todayString = getLocalYYYYMMDD(new Date());
        return (users || []).filter(u => !u.masaBerlaku || u.masaBerlaku >= todayString);
    }, [users]);

    // 3/3: Transaksi — hanya dihitung ulang jika data transaksi atau filter tanggal berubah
    const transactionStats = useMemo(() => {
        const filteredInbound = inbound.filter(trx => {
            const d = trx.tanggal?.split('T')[0];
            return d >= startDate && d <= endDate;
        });
        const filteredOutbound = outbound.filter(trx => {
            const d = trx.tanggal?.split('T')[0];
            return d >= startDate && d <= endDate;
        });
        const filteredReturns = returns.filter(trx => {
            const d = trx.tanggal?.split('T')[0];
            return d >= startDate && d <= endDate;
        });

        // 🔥 PERBAIKAN: Kalkulasi Total Masuk dan Keluar sudah mencakup Return 🔥
        const totalMasuk = 
            filteredInbound.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0) +
            filteredReturns.filter(r => (r.sumber_tujuan || r.jenisReturn || '').startsWith('RET_IN')).reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0);
            
        const totalKeluar = 
            filteredOutbound.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0) + 
            filteredReturns.filter(r => (r.sumber_tujuan || r.jenisReturn || '').startsWith('RET_OUT')).reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0);

        // 🔥 PERBAIKAN: List Semua Transaksi kini mencakup Return 🔥
        const allTransactions = [
            ...filteredInbound.map(t => ({ Tipe: 'Masuk', ID: t.idTransaksi, Tanggal: t.tanggal, Barang: t.namaBarang, Jumlah: `+${t.jumlah}`, Keterangan: t.namaSupplier })),
            ...filteredOutbound.map(t => ({ Tipe: 'Keluar', ID: t.idTransaksi, Tanggal: t.tanggal, Barang: t.namaBarang, Jumlah: `-${t.jumlah}`, Keterangan: t.namaPembeli })),
            ...filteredReturns.map(t => {
                const isOut = (t.sumber_tujuan || t.jenisReturn || '').startsWith('RET_OUT') || t.jenisReturn === 'Return ke Vendor';
                return {
                    Tipe: isOut ? 'Keluar' : 'Masuk',
                    ID: t.idTransaksi,
                    Tanggal: t.tanggal,
                    Barang: Array.isArray(t.items) ? `${t.items.length} Jenis Barang` : (t.namaBarang || '-'),
                    Jumlah: isOut ? `-${t.jumlah}` : `+${t.jumlah}`,
                    Keterangan: t.sumber_tujuan || t.jenisReturn || 'Return'
                };
            })
        ].sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));

        return { totalMasuk, totalKeluar, allTransactions };
    }, [inbound, outbound, returns, startDate, endDate]);

    // Gabungkan agar referensi `stats` di JSX tetap kompatibel
    const stats = useMemo(() => ({
        ...itemStats,
        ...transactionStats,
        activeUsers,
    }), [itemStats, transactionStats, activeUsers]);

    const formatFullIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

    const renderTrendBadge = (percentage, type = 'revenue') => {
        const numVal = Number(percentage);
        if (numVal === 0) {
            return (
                <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-500 mt-2 w-max">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14"></path></svg>
                    0% vs previous period
                </div>
            );
        }

        const isUp = numVal > 0;
        let isGood = isUp;
        if (type === 'expense') {
            isGood = !isUp;
        }

        const iconPath = isUp 
            ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" // Up arrow 
            : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"; // Down arrow

        return (
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2 w-max ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath}></path>
                </svg>
                {isUp ? '+' : ''}{numVal.toFixed(1)}% vs previous period
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col xl:flex-row justify-end items-start xl:items-center gap-4 print:hidden mb-2">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Filter */}
                    <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                        <span className="text-slate-300 font-bold mx-2">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* 4 Kartu Statistik Atas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCardMini title="STOK DIBOOKING" value={backendStats.stokDibooking.toLocaleString()} icon={Calendar} bgClass="bg-blue-50" colorClass="text-blue-600" isPositive={true} subtitle="Unit menunggu eksekusi fisik hari ini" />
                <StatCardMini title="Stok Keseluruhan" value={stats.totalStok.toLocaleString()} icon={Tags} bgClass="bg-slate-50" colorClass="text-slate-600" isPositive={false} subtitle="Unit Terdaftar" />
                
                {/* Barang Masuk Inline Card */}
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <ArrowDownToLine className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Transaksi Masuk</p>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight">{backendStats.barangMasuk?.value?.toLocaleString() || 0}</h3>
                        {renderTrendBadge(backendStats.barangMasuk?.percentage || 0, 'inbound')}
                    </div>
                </div>

                {/* Barang Keluar Inline Card */}
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
                            <ArrowUpFromLine className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Transaksi Keluar</p>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight">{backendStats.barangKeluar?.value?.toLocaleString() || 0}</h3>
                        {renderTrendBadge(backendStats.barangKeluar?.percentage || 0, 'outbound')}
                    </div>
                </div>
            </div>

            {/* 3 Kartu Finansial Tengah */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-center relative hover:shadow-md transition-shadow">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Belanja Stok (Inbound)</p>
                    <h3 className="text-[22px] font-extrabold text-slate-800">{formatRp(backendStats.pengeluaranVendor?.value || 0)}</h3>
                    {renderTrendBadge(backendStats.pengeluaranVendor?.percentage || 0, 'expense')}
                    <div className="text-[10px] text-slate-400 mt-2 font-medium">(Semua Pembelian & Makloon)</div>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-center relative hover:shadow-md transition-shadow">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Penjualan Distributor</p>
                    <h3 className="text-[22px] font-extrabold text-slate-800">{formatRp(backendStats.penjualanDistributor?.value || 0)}</h3>
                    {renderTrendBadge(backendStats.penjualanDistributor?.percentage || 0, 'revenue')}
                </div>
                <div className="p-5 rounded-[20px] shadow-md bg-blue-600 text-white flex flex-col justify-center relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wider mb-1">Estimasi Laba Penjualan</p>
                        <div className="flex items-center gap-3 mt-1">
                            <h3 className="text-[28px] font-extrabold text-white leading-none">{formatRp(backendStats.labaBersih)}</h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-white/20 text-white shadow-sm border border-white/30 tracking-wide">
                                Margin: {Number(backendStats.grand_margin_percentage || 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="text-[10px] text-blue-200 mt-2 font-medium">*(Dihitung dari HPP stok yang terjual)</div>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-10">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" /></svg>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Line Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800">Grafik Arus Kas Harian</h3>
                            <p className="text-[13px] text-slate-400">Pemasukan vs Pengeluaran / Periode terpilih</p>
                        </div>
                        <div className="flex items-center gap-4 text-[13px] font-bold">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-600"></div> <span className="text-slate-600">Pemasukan</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> <span className="text-slate-600">Pengeluaran</span></div>
                        </div>
                    </div>
                    <div className="flex-1 w-full h-72 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={backendStats.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPemasukan" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="Tanggal" 
                                    tickFormatter={(tickItem) => tickItem ? new Date(tickItem).getDate().toString().padStart(2, '0') : ''}
                                    tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} 
                                    dy={10} 
                                    axisLine={false} 
                                    tickLine={false} 
                                />
                                <YAxis 
                                    width={85}
                                    tick={{ fontSize: 12, fill: '#94a3b8' }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickFormatter={(val) => new Intl.NumberFormat('id-ID', { notation: 'compact', style: 'currency', currency: 'IDR', maximumFractionDigits: 1 }).format(val)} 
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }}
                                    formatter={(value) => [new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value), undefined]}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload.length > 0 && payload[0].payload.Tanggal) {
                                            return new Date(payload[0].payload.Tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                        }
                                        return `Tanggal ${label}`;
                                    }}
                                    labelStyle={{ color: '#64748b', marginBottom: '12px', fontSize: '13px', fontWeight: 'bold' }}
                                    itemStyle={{ fontSize: '14px', fontWeight: '900', paddingBottom: '4px' }}
                                />
                                <Area type="monotone" name="Pemasukan" dataKey="Pemasukan" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorPemasukan)" activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }} />
                                <Area type="monotone" name="Pengeluaran" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={3} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPengeluaran)" activeDot={{ r: 6, strokeWidth: 0, fill: '#f43f5e' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Profit List */}
                <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col h-full">
                    <h3 className="text-base font-extrabold text-slate-800">Laba Harian</h3>
                    <p className="text-[13px] text-slate-400 mb-6">Net Profit Performance</p>

                    <div className="space-y-5 flex-1">
                        {backendStats.categoryProfitArray.length > 0 ? backendStats.categoryProfitArray.map((cat, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[13px] font-bold text-slate-700">{cat.name}</span>
                                    <span className="text-[13px] font-bold text-blue-600">{formatFullIDR(cat.profit)}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.max(5, (cat.profit / backendStats.maxProfit) * 100)}%` }}></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center text-slate-400 text-sm py-10 font-medium">Belum ada data penjualan.</div>
                        )}
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                            <span className="font-extrabold text-lg">Rp</span>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase">Total Estimated Profit</p>
                            <p className="text-xl font-extrabold text-slate-800 leading-none mt-1">{formatFullIDR(backendStats.labaBersih)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* === NEW ROW: AI Projections === */}
            {canViewForecasting && (
                <div className="grid grid-cols-1 mb-6">
                    <ProjectionDashboard />
                </div>
            )}

            {/* === NEW ROW: Donut Chart + VIP Customers + Inventory Turnover === */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Widget 1: Profit Contribution Donut */}
                <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col items-center">
                    <h3 className="text-base font-extrabold text-slate-800 self-start">Kontribusi Laba</h3>
                    <p className="text-[13px] text-slate-400 self-start mb-4">Per Kategori Barang</p>
                    {backendStats.profitDonut.length > 0 ? (
                        <div className="relative w-full h-64 min-h-[250px] flex justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={backendStats.profitDonut} dataKey="profit" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                                        {backendStats.profitDonut.map((_, i) => <Cell key={i} fill={['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'][i % 5]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => formatRp(v)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] text-slate-400 font-bold">TOTAL</span>
                                <span className="text-sm font-extrabold text-slate-800">{formatRp(backendStats.totalProfit)}</span>
                            </div>
                        </div>
                    ) : <p className="text-slate-400 text-sm py-10">Belum ada data.</p>}
                    <div className="w-full mt-4 space-y-2">
                        {backendStats.profitDonut.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between text-[12px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'][i % 5] }}></div>
                                    <span className="font-semibold text-slate-700">{cat.name}</span>
                                </div>
                                <span className="font-bold text-slate-500">{cat.percentage}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Widget 2: Top 5 VIP Customers */}
                <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-base font-extrabold text-slate-800">Top 5 Pelanggan</h3>
                    <p className="text-[13px] text-slate-400 mb-4">VIP Leaderboard</p>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-[12px]">
                            <thead className="text-slate-400 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="py-2 text-left">#</th>
                                    <th className="py-2 text-left">Pelanggan & PIC</th>
                                    <th className="py-2 text-right">Vol</th>
                                    <th className="py-2 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {backendStats.vipCustomers.length > 0 ? backendStats.vipCustomers.map((c, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="py-2.5"><span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{c.rank}</span></td>
                                        <td className="py-2.5"><div className="font-bold text-slate-700">{c.customer}</div><div className="text-[10px] text-slate-400">{c.pic}</div></td>
                                        <td className="py-2.5 text-right font-semibold text-slate-600">{c.volume}</td>
                                        <td className="py-2.5 text-right font-bold text-emerald-600">{formatRp(c.revenue)}</td>
                                    </tr>
                                )) : <tr><td colSpan="4" className="py-8 text-center text-slate-400">Belum ada data.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Widget 3: Dead Stock */}
                <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-base font-extrabold text-slate-800">Barang Tidak Bergerak</h3>
                    <p className="text-[13px] text-slate-400 mb-4">Tidak ada transaksi keluar &gt; 30 hari</p>
                    <div className="flex-1 space-y-1">
                        {(() => {
                            const filteredDeadStock = (backendStats.deadStock || []).filter(item => {
                                const storeItem = items.find(i => i.kodeBarang === item.kodeBarang);
                                const tipe = (storeItem?.tipeBarang || item.tipeBarang || '').toLowerCase();
                                return !tipe.includes('inventaris') && !tipe.includes('non produksi') && !tipe.includes('jasa');
                            });
                            return filteredDeadStock.length > 0 ? (
                                filteredDeadStock.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div>
                                            <div className="text-[13px] font-bold text-slate-700">{item.namaBarang}</div>
                                            <div className="text-[11px] text-slate-400">{item.kodeBarang}</div>
                                        </div>
                                        <div>
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">
                                                Sisa: {item.stok} Unit
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-400 text-[13px] py-10 font-medium">Semua stok bergerak aktif</div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Bottom Tables Section */}
            <div className={`grid grid-cols-1 ${isAdminOrSuperadmin ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>

                {/* Active Users Table (Admin only) */}
                {isAdminOrSuperadmin && (
                    <div className="lg:col-span-1 bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm">
                        <h3 className="text-base font-extrabold text-slate-800 mb-4">User Aktif</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                                <thead className="text-slate-400 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="px-3 py-3 font-bold">Pengguna</th>
                                        <th className="px-3 py-3 font-bold text-right">Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stats.activeUsers.length > 0 ? stats.activeUsers.map((u, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-3 py-3.5">
                                                <div className="font-bold text-slate-700">{u.namaLengkap}</div>
                                                <div className="text-[11px] text-slate-400 mt-0.5">@{u.username}</div>
                                            </td>
                                            <td className="px-3 py-3.5 text-right">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${u.role === 'Superadmin' ? 'bg-amber-100 text-amber-700' : u.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : <tr><td colSpan="2" className="px-3 py-8 text-center text-slate-400 font-medium">Tidak ada user aktif.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Recent Transactions Table */}
                <div className={`${isAdminOrSuperadmin ? 'lg:col-span-2' : 'lg:col-span-1'} bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-extrabold text-slate-800">Aktivitas Terakhir</h3>
                        <button onClick={() => navigate('/semua-aktivitas')} className="text-sm font-bold text-blue-600 hover:text-blue-700">Lihat Semua</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                            <thead className="text-slate-400 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Barang / SKU</th>
                                    <th className="px-4 py-3 font-bold">Tanggal</th>
                                    <th className="px-4 py-3 font-bold">Keterangan</th>
                                    <th className="px-4 py-3 font-bold text-right">Perubahan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stats.allTransactions.length > 0 ? stats.allTransactions.slice(0, 8).map((t, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="font-bold text-slate-700">{t.Barang}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{t.ID}</div>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-500 font-medium">{new Date(t.Tanggal.includes('T') ? t.Tanggal : t.Tanggal.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-4 py-3.5 text-slate-500">{t.Keterangan}</td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold ${t.Tipe === 'Masuk' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {t.Jumlah} Unit
                                            </span>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400 font-medium">Tidak ada transaksi terbaru.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}