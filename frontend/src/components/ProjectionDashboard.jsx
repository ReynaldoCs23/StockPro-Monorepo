import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { apiCall } from '../utils/api';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const stokAktual = payload.find(p => p.dataKey === 'qty_sisa')?.value || 0;
        const estimasi = payload.find(p => p.dataKey === 'estimasi_qty')?.value || 0;
        const selisih = estimasi - stokAktual;
        
        return (
            <div className="bg-white p-4 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] border border-slate-100">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-50 pb-2">{label}</p>
                <div className="space-y-1.5 text-[13px]">
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-200"></span> Stok Aktual
                        </span>
                        <span className="font-bold text-slate-700">{stokAktual} Unit</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Proyeksi AI
                        </span>
                        <span className="font-bold text-indigo-600">{estimasi} Unit</span>
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-slate-50">
                        {selisih > 0 ? (
                            <div className="flex justify-between gap-6 bg-rose-50 -mx-4 -mb-4 p-3 rounded-b-xl border-t border-rose-100">
                                <span className="text-rose-600 font-bold">Kekurangan Stok:</span>
                                <span className="font-extrabold text-rose-600">{selisih} Unit</span>
                            </div>
                        ) : (
                            <div className="flex justify-between gap-6 bg-emerald-50 -mx-4 -mb-4 p-3 rounded-b-xl border-t border-emerald-100">
                                <span className="text-emerald-600 font-bold">Status:</span>
                                <span className="font-extrabold text-emerald-600">Aman</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function ProjectionDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProjections = async () => {
            try {
                const res = await apiCall('/projections');
                setData(res);
                setLoading(false);
            } catch (err) {
                console.error("Gagal mengambil proyeksi AI", err);
                setError("Gagal memuat data AI");
                setLoading(false);
            }
        };
        fetchProjections();
    }, []);

    if (loading) return (
        <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-center items-center h-80 w-full animate-pulse">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-sm font-medium">Memuat Analisis Komparatif AI...</p>
        </div>
    );
    
    if (error) return (
        <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm text-rose-500 text-center flex items-center justify-center h-80">
            <p className="font-semibold">{error}</p>
        </div>
    );

    if (data.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex flex-col h-full w-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analisis Proyeksi vs Stok Aktual
                    </h3>
                    <p className="text-[13px] text-slate-400 mt-1">Perbandingan stok saat ini dengan estimasi kebutuhan AI untuk Bulan {data[0]?.periode_target ? new Date(data[0].periode_target).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Depan'}</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100">
                    AI Forecast
                </div>
            </div>
            
            <div className="flex-1 w-full h-80 min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="namaBarang" 
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            dy={15}
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                        />
                        <YAxis 
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            dx={-10}
                        />
                        <Tooltip 
                            content={<CustomTooltip />} 
                            cursor={{ fill: '#f8fafc' }} 
                        />
                        <Legend 
                            iconType="circle" 
                            wrapperStyle={{ fontSize: '13px', fontWeight: '600', paddingTop: '20px', color: '#64748b' }}
                        />
                        <Bar 
                            dataKey="qty_sisa" 
                            name="Stok Aktual" 
                            fill="#e2e8f0" 
                            barSize={40} 
                            radius={[4, 4, 0, 0]} 
                        />
                        <Bar 
                            dataKey="estimasi_qty" 
                            name="Estimasi AI" 
                            barSize={40} 
                            radius={[4, 4, 0, 0]}
                        >
                            {data.map((entry, index) => {
                                // Smart Coloring: If estimate > actual stock, turn Red. Otherwise, Indigo.
                                const isShortage = entry.estimasi_qty > entry.qty_sisa;
                                return <Cell key={`cell-${index}`} fill={isShortage ? '#ef4444' : '#6366f1'} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
