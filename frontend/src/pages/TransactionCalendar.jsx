import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronDown, Package, ArrowUpFromLine, ArrowDownToLine, Undo, Factory } from '../components/icons/Icons';
import Modal from '../components/ui/Modal';
import { getLocalYYYYMMDD } from '../utils/helpers';
import { apiCall } from '../utils/api';
import toast from 'react-hot-toast';
import useAppStore from '../store/useAppStore';

export default function TransactionCalendar() {
    const { currentUser } = useAppStore();
    const isGuest = currentUser?.role === 'guest' || currentUser?.role === 'Guest';
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    
    // Lifecycle & Data Fetching
    const [isLoading, setIsLoading] = useState(true);
    const [calendarEvents, setCalendarEvents] = useState([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedDayEvents, setSelectedDayEvents] = useState([]);

    const [isExecuting, setIsExecuting] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [transactionToConfirm, setTransactionToConfirm] = useState(null);

    const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

    // Auto-Fetch Data based on Month/Year (React Lifecycle Fix)
    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
                const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
                
                const res = await apiCall(`/transactions?category=all&start_date=${startDate}&end_date=${endDate}`);
                
                const data = res.data || res;
                const events = (Array.isArray(data) ? data : []).map(t => {
                    let typeGroup = 'IN';
                    let title = `Masuk: ${t.idTransaksi}`;
                    
                    if (t.idTransaksi.startsWith('INV-OUT') || t.idTransaksi.startsWith('MKL-OUT') || t.type === 'OUT') {
                        typeGroup = 'OUT';
                        title = `Keluar: ${t.idTransaksi}`;
                    } else if (t.idTransaksi.startsWith('RET') || t.type === 'RET') {
                        typeGroup = 'RET';
                        title = `Return: ${t.idTransaksi}`;
                    }
                    
                    return { ...t, typeGroup, title };
                }).filter(t => t.tanggal);
                
                setCalendarEvents(events);
            } catch (error) {
                console.error("Gagal mengambil data kalender:", error);
                toast.error("Gagal memuat jadwal operasional.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [currentMonth, currentYear, daysInMonth]);

    const allTransactions = calendarEvents;

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleDayClick = (dateStr, events) => {
        if (events.length > 0) {
            setSelectedDate(dateStr);
            setSelectedDayEvents(events);
            setIsModalOpen(true);
        }
    };

    const handleExecuteTransactionClick = (idTransaksi) => {
        setTransactionToConfirm(idTransaksi);
        setIsConfirmOpen(true);
    };

    const confirmExecuteTransaction = async () => {
        if (!transactionToConfirm) return;
        setIsExecuting(true);
        try {
            await apiCall(`/transaction/${transactionToConfirm}/execute`, 'POST');
            toast.success('Transaksi berhasil dieksekusi secara manual.');
            
            // Update local state temporarily to reflect change immediately before WebSocket refetch
            setSelectedDayEvents(prev => prev.map(ev => 
                ev.idTransaksi === transactionToConfirm ? { ...ev, status: 'completed' } : ev
            ));
        } catch (err) {
            toast.error(err.message || 'Gagal mengeksekusi transaksi.');
        } finally {
            setIsExecuting(false);
            setIsConfirmOpen(false);
            setTransactionToConfirm(null);
        }
    };

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    const renderGrid = () => {
        const grid = [];
        for (let i = 0; i < firstDay; i++) {
            grid.push(<div key={`empty-${i}`} className="h-32 bg-slate-50/30 border border-gray-100 rounded-xl"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === getLocalYYYYMMDD();
            
            const dayEvents = allTransactions.filter(t => {
                const eventDate = t.tanggal.includes('T') ? t.tanggal.split('T')[0] : t.tanggal;
                return eventDate === dateStr;
            });

            grid.push(
                <div 
                    key={day} 
                    onClick={() => handleDayClick(dateStr, dayEvents)}
                    className={`h-32 p-2 border rounded-xl overflow-y-auto custom-scrollbar transition-colors ${dayEvents.length > 0 ? 'cursor-pointer hover:bg-slate-50' : ''} ${isToday ? 'bg-blue-50/10 border-b' : 'bg-white border-gray-100'}`}
                >
                    <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-600'}`}>{day}</span>
                    </div>
                    <div className="space-y-1.5">
                        {dayEvents.map(ev => {
                            const isScheduled = ev.status === 'scheduled';
                            return (
                                <div key={ev.idTransaksi} title={ev.title} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border truncate transition-all
                                    ${isScheduled 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {ev.typeGroup} | {ev.idTransaksi}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 print:hidden max-w-6xl mx-auto">
            <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-blue-600 border border-slate-200 shadow-sm">
                            <Calendar className="w-6 h-6" />
                        </div>
                        Kalender Operasional
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm font-medium">Pemantauan jadwal eksekusi operasional gudang secara komprehensif.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 tracking-wide uppercase">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Selesai
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 tracking-wide uppercase">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Dijadwalkan
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between mb-6 shadow-sm">
                <button onClick={prevMonth} className="px-5 py-2.5 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 shadow-sm hover:bg-slate-100 transition-colors">&laquo; Prev</button>
                <h3 className="text-lg font-black text-slate-700 uppercase tracking-widest">{monthNames[currentMonth]} {currentYear}</h3>
                <button onClick={nextMonth} className="px-5 py-2.5 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 shadow-sm hover:bg-slate-100 transition-colors">Next &raquo;</button>
            </div>

            <div className="grid grid-cols-7 gap-3 mb-2">
                {days.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-400 tracking-wider py-2 uppercase">{d}</div>
                ))}
            </div>
            
            <div className="relative min-h-[300px]">
                {/* 3. Penanganan Loading State (UX Tambahan) */}
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="mt-3 text-sm font-bold text-blue-600">Memuat Jadwal...</p>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-7 gap-3">
                    {renderGrid()}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Detail Transaksi - ${selectedDate}`} width="max-w-2xl">
                <div className="space-y-4">
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 font-bold text-slate-600">ID Transaksi</th>
                                    <th className="p-4 font-bold text-slate-600">Tipe</th>
                                    <th className="p-4 font-bold text-slate-600 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {selectedDayEvents.map(ev => {
                                    const isScheduled = ev.status === 'scheduled';
                                    return (
                                        <tr key={ev.idTransaksi} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">{ev.idTransaksi}</td>
                                            <td className="p-4 font-medium text-slate-500">
                                                {ev.typeGroup === 'IN' && 'Barang Masuk'}
                                                {ev.typeGroup === 'OUT' && 'Barang Keluar'}
                                                {ev.typeGroup === 'RET' && 'Return'}
                                            </td>
                                            <td className="p-4 text-right flex flex-col items-end justify-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border inline-block ${isScheduled ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                    {isScheduled ? 'Scheduled' : 'Completed'}
                                                </span>
                                                {isScheduled && !isGuest && (
                                                    <button 
                                                        onClick={() => handleExecuteTransactionClick(ev.idTransaksi)}
                                                        disabled={isExecuting && transactionToConfirm === ev.idTransaksi}
                                                        className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                    >
                                                        {isExecuting && transactionToConfirm === ev.idTransaksi ? 'Memproses...' : 'Konfirmasi Barang Fisik (Eksekusi Sekarang)'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                            Tutup
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Custom Confirmation Modal */}
            {isConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 mx-4 relative animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mb-4">
                                <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Konfirmasi Eksekusi</h3>
                            <p className="text-[13px] font-medium text-slate-500 mb-6 leading-relaxed">
                                Apakah transaksi fisik sudah dilakukan? Stok sistem akan langsung diperbarui saat ini juga.
                            </p>
                            <div className="flex w-full gap-3">
                                <button 
                                    onClick={() => {
                                        setIsConfirmOpen(false);
                                        setTransactionToConfirm(null);
                                    }}
                                    disabled={isExecuting}
                                    className="flex-1 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={confirmExecuteTransaction}
                                    disabled={isExecuting}
                                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                >
                                    {isExecuting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Memproses
                                        </>
                                    ) : 'Ya, Eksekusi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
