import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search, Calendar, FileText } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import { apiCall } from '../utils/api';
import { formatLocalDate } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

export default function StockAdjustment() {
    const { items, currentUser, isApiOffline, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);

    const [adjustments, setAdjustments] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [isModalOpen, setModalOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const [formData, setFormData] = useState({
        item_id: '',
        adjustment_type: 'addition',
        quantity: '',
        reason: ''
    });

    const fetchAdjustments = () => {
        if (!isApiOffline) {
            setIsProcessing(true);
            apiCall(`/stock-adjustments?page=${currentPage}`)
                .then(data => {
                    if (data && data.data) {
                        setAdjustments(data.data);
                        setLastPage(data.last_page || 1);
                    } else {
                        setAdjustments([]);
                        setLastPage(1);
                    }
                    setIsProcessing(false);
                })
                .catch(() => setIsProcessing(false));
        }
    };

    useEffect(() => {
        fetchAdjustments();
    }, [currentPage, isApiOffline]);

    const openAddModal = () => {
        setFormData({
            item_id: '',
            adjustment_type: 'addition',
            quantity: '',
            reason: ''
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.item_id || !formData.quantity || !formData.reason) {
            return setToast({ message: 'Lengkapi semua field yang diwajibkan!', type: 'error' });
        }

        setIsProcessing(true);
        try {
            if (!isApiOffline) {
                await apiCall('/stock-adjustments', 'POST', formData);
                setToast({ message: 'Stock adjustment berhasil disimpan!', type: 'success' });
                setModalOpen(false);
                fetchAdjustments();
            } else {
                setToast({ message: 'Gagal! Sistem sedang offline.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: e.message || 'Gagal menyimpan penyesuaian stok', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const columns = [
        { label: 'No. Penyesuaian', key: 'adjustment_number' },
        { 
            label: 'Tanggal', 
            key: 'created_at',
            format: (val, row) => (
                <div className="flex items-center text-slate-600">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                    {formatLocalDate(row.created_at)}
                </div>
            )
        },
        { 
            label: 'Barang', 
            key: 'item_id',
            format: (val, row) => row.item ? (
                <div>
                    <div className="font-semibold text-slate-800">{row.item.nama}</div>
                    <div className="text-xs text-slate-500">{row.item_id}</div>
                </div>
            ) : row.item_id 
        },
        { 
            label: 'Tipe', 
            key: 'adjustment_type',
            format: (val, row) => (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${row.adjustment_type === 'addition' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                    {row.adjustment_type === 'addition' ? '+ Penambahan' : '- Pengurangan'}
                </span>
            ) 
        },
        { 
            label: 'Kuantitas', 
            key: 'quantity',
            format: (val, row) => (
                <span className={`font-bold ${row.adjustment_type === 'addition' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.adjustment_type === 'addition' ? '+' : '-'}{row.quantity}
                </span>
            )
        },
        { label: 'Alasan', key: 'reason' },
        { 
            label: 'Admin', 
            key: 'user_id',
            format: (val, row) => row.user ? row.user.namaLengkap : '-' 
        }
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Penyesuaian Stok (Opname)</h1>
                    <p className="text-slate-500 mt-1 text-sm">Koreksi kuantitas stok tanpa menghapus riwayat FIFO sebelumnya.</p>
                </div>
                {can('create_penyesuaian_stok') && (
                    <button 
                        onClick={openAddModal}
                        className="flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98]"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Tambah Penyesuaian
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCardMini 
                    title="Total Penyesuaian" 
                    value={adjustments.length} 
                    icon={ClipboardList}
                    color="blue"
                />
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto w-full">
                <DataTable 
                    title="Riwayat Penyesuaian"
                    columns={columns} 
                    data={adjustments} 
                    currentPage={currentPage}
                    lastPage={lastPage}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Modal Form */}
            <Modal isOpen={isModalOpen} onClose={() => !isProcessing && setModalOpen(false)} title="Tambah Penyesuaian Stok" maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
                        <div className="text-amber-500 mt-0.5">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div className="text-sm text-amber-800 leading-relaxed">
                            <strong>Perhatian:</strong> Aksi ini akan mengubah stok riil. Pengurangan stok akan memotong dari batch FIFO tertua, sedangkan Penambahan akan membentuk batch barang masuk baru dengan HPP rata-rata dari sistem.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Barang <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                                value={formData.item_id}
                                onChange={(e) => setFormData({...formData, item_id: e.target.value})}
                                required
                            >
                                <option value="">-- Pilih Barang --</option>
                                {items.map(i => (
                                    <option key={i.kodeBarang} value={i.kodeBarang}>
                                        [{i.kodeBarang}] {i.nama} (Stok: {i.stok} {i.satuan_dasar})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
                            <div className="w-full">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipe Penyesuaian <span className="text-red-500">*</span></label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${formData.adjustment_type === 'addition' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        <input 
                                            type="radio" 
                                            name="adj_type" 
                                            value="addition" 
                                            className="hidden"
                                            checked={formData.adjustment_type === 'addition'}
                                            onChange={() => setFormData({...formData, adjustment_type: 'addition'})}
                                        />
                                        <span className="font-semibold text-lg mr-2">+</span> Penambahan
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${formData.adjustment_type === 'subtraction' ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        <input 
                                            type="radio" 
                                            name="adj_type" 
                                            value="subtraction" 
                                            className="hidden"
                                            checked={formData.adjustment_type === 'subtraction'}
                                            onChange={() => setFormData({...formData, adjustment_type: 'subtraction'})}
                                        />
                                        <span className="font-semibold text-lg mr-2">-</span> Pengurangan
                                    </label>
                                </div>
                            </div>

                            <div className="w-full">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Kuantitas <span className="text-red-500">*</span></label>
                                <input 
                                    type="number" 
                                    min="1"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                                    placeholder="Cth: 10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Alasan / Keterangan <span className="text-red-500">*</span></label>
                            <textarea 
                                rows="3"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                                value={formData.reason}
                                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                                placeholder="Contoh: Stok aktual lebih sedikit karena barang rusak/hilang, salah input sebelumnya..."
                                required
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors" disabled={isProcessing}>
                            Batal
                        </button>
                        <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center shadow-sm shadow-blue-600/20" disabled={isProcessing}>
                            {isProcessing ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
