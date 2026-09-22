import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Package, Tags } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId, formatRp } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

export default function MasterBarang() {
    const { 
        items, setItems, categories, satuans, currentUser, 
        isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions 
    } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [formData, setFormData] = useState({ nama: '', kategori: '', tipeBarang: 'Bahan Baku', satuan_dasar: '', satuan_besar: '', rasio_konversi: 1, minStok: '', hargaBeli: '', hargaBeli_besar: '', hargaJual: '', hargaJual_besar: '' });

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);

    const openAddModal = () => {
        setEditId(null);
        setFormData({ nama: '', kategori: '', tipeBarang: 'Bahan Baku', satuan_dasar: '', satuan_besar: '', rasio_konversi: 1, minStok: '', hargaBeli: '', hargaBeli_besar: '', hargaJual: '', hargaJual_besar: '' });
        setModalOpen(true);
    };

    const handleEdit = (row) => {
        setEditId(row.kodeBarang);
        setFormData({
            nama: row.nama,
            kategori: row.kategori,
            tipeBarang: row.tipeBarang || 'Bahan Baku',
            satuan_dasar: row.satuan_dasar || row.satuan || '',
            satuan_besar: row.satuan_besar || '',
            rasio_konversi: row.rasio_konversi || 1,
            minStok: row.minStok || 0,
            hargaBeli: row.hargaBeli,
            hargaBeli_besar: row.hargaBeli_besar || '',
            hargaJual: row.hargaJual,
            hargaJual_besar: row.hargaJual_besar || ''
        });
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            if(!isApiOffline) await apiCall(`/items/${id}`, 'DELETE', { log_user: currentUser.namaLengkap, log_detail: `Menghapus Barang Master: ${id}`, id_key: 'kodeBarang' });
            setItems(items.filter(i => i.kodeBarang !== id));
            if(isApiOffline) addSimulatedLog('DELETE', 'Master Barang', `Menghapus Barang Master: ${id}`);
        } catch(e) { toast.error(e.message || 'Gagal koneksi API.'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const payload = { ...formData, rasio_konversi: Number(formData.rasio_konversi) || 1 };
            if (!payload.satuan_besar) { payload.satuan_besar = null; payload.rasio_konversi = 1; }
            // Stok awal selalu 0 saat tambah baru — gunakan menu Penyesuaian Stok untuk input stok agar memiliki kode batch
            if (!editId) { payload.stok = 0; }

            if (editId) {
                if(!isApiOffline) await apiCall(`/items/${editId}`, 'PUT', { ...payload, log_user: currentUser.namaLengkap, log_detail: `Mengubah Data Barang: ${editId}`, id_key: 'kodeBarang' });
                setItems(items.map(i => i.kodeBarang === editId ? { ...i, ...payload } : i));
                if(isApiOffline) addSimulatedLog('UPDATE', 'Master Barang', `Mengubah Data Barang: ${editId}`);
            } else {
                const prefix = (formData.tipeBarang === 'Bahan Baku' || formData.tipeBarang === 'Kemasan') ? 'RM' : 'BRG';
                const newPayload = { kodeBarang: payload.kodeBarang || generateId(prefix, items, 'kodeBarang'), ...payload };
                if(!isApiOffline) await apiCall(`/items`, 'POST', { ...newPayload, log_user: currentUser.namaLengkap, log_detail: `Menambah Barang Baru: ${newPayload.nama}` });
                setItems([...items, newPayload]);
                if(isApiOffline) addSimulatedLog('CREATE', 'Master Barang', `Menambah Barang Baru: ${newPayload.nama}`);
            }
            setModalOpen(false);
        } catch(e) { toast.error(e.message || 'Gagal koneksi API.'); }
        finally { setIsProcessing(false); }
    };

    const satuanList = satuans?.length > 0 ? satuans.map(s => s.nama_satuan) : ['Pcs', 'Box', 'Kg', 'Liter', 'Roll'];

    const masterColumns = [
        { key: 'kodeBarang', label: 'Kode' },
        { key: 'nama', label: 'Nama Barang' },
        { key: 'kategori', label: 'Kategori' },
        { key: 'tipeBarang', label: 'Tipe', format: v => <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${v === 'Produk Jadi' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{v}</span>, exportFormat: v => v },
        { key: 'satuan_dasar', label: 'Satuan Dasar' },
        { key: 'satuan_besar', label: 'Satuan Besar', format: (v, row) => v ? `${v} (1:${row.rasio_konversi})` : '-' },
        { key: 'stok', label: 'Stok', format: (v, row) => <span className={`font-bold ${Number(v) <= Number(row.minStok || 0) ? 'text-rose-600' : ''}`}>{v} {row.satuan_dasar || ''}</span>, exportFormat: (v, row) => `${v} ${row.satuan_dasar || ''}` },
        { key: 'hargaBeli', label: 'Harga Beli', format: (v, row) => row.satuan_besar ? `${formatRp(v)} /${row.satuan_dasar}` : formatRp(v), exportFormat: v => formatRp(v) },
        { key: 'hargaBeli_besar', label: 'Harga Beli Besar', format: (v, row) => row.satuan_besar && Number(v) > 0 ? `${formatRp(v)} /${row.satuan_besar}` : '-', exportFormat: v => Number(v) > 0 ? formatRp(v) : '-' },
        { key: 'hargaJual', label: 'Harga Jual', format: (v, row) => row.satuan_besar ? `${formatRp(v)} /${row.satuan_dasar}` : formatRp(v), exportFormat: v => formatRp(v) },
        { key: 'hargaJual_besar', label: 'Harga Jual Besar', format: (v, row) => row.satuan_besar && Number(v) > 0 ? `${formatRp(v)} /${row.satuan_besar}` : '-', exportFormat: v => Number(v) > 0 ? formatRp(v) : '-' }
    ];

    return (
        <div>
            <div className="space-y-6 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <StatCardMini title="Total Produk / Jenis Barang" value={items.length} icon={Package} bgClass="bg-blue-50" colorClass="text-blue-600" />
                    <StatCardMini title="Total Stok Seluruhnya" value={items.reduce((a,b)=>a+Number(b.stok),0)} icon={Tags} bgClass="bg-indigo-50" colorClass="text-indigo-600" />
                </div>

                <DataTable
                    title="Master Barang" filename="Data_Barang" data={items}
                    onAdd={can('create_master_barang') ? openAddModal : null} onEdit={can('edit_master_barang') ? handleEdit : null} onDelete={can('delete_master_barang') ? handleDelete : null} idKey="kodeBarang"
                    columns={masterColumns}
                />
            </div>
            
            <ReportPrintTemplate title="Laporan Data Master Barang" type="master" columns={masterColumns} data={items} />

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Update Data Barang" : "Tambah Barang Baru"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Nama Barang</label>
                        <input required type="text" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Kategori</label>
                            <select required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.kategori} onChange={e => setFormData({...formData, kategori: e.target.value})}>
                                <option value="">Pilih...</option>
                                {categories.map(c => <option key={c.idKategori} value={c.nama}>{c.nama}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Tipe</label>
                            <select required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.tipeBarang} onChange={e => {
                                const val = e.target.value;
                                if (!editId) {
                                    const newPrefix = (val === 'Bahan Baku' || val === 'Kemasan') ? 'RM' : 'BRG';
                                    setFormData({...formData, tipeBarang: val, kodeBarang: generateId(newPrefix, items, 'kodeBarang')});
                                } else {
                                    setFormData({...formData, tipeBarang: val});
                                }
                            }}>
                                <option value="Bahan Baku">Bahan Baku</option>
                                <option value="Produk Jadi">Produk Jadi</option>
                                <option value="Kemasan">Kemasan</option>
                            </select>
                        </div>
                    </div>

                    {/* UOM Section */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pengaturan Satuan (UOM)</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Satuan Dasar *</label>
                                <select required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.satuan_dasar} onChange={e => setFormData({...formData, satuan_dasar: e.target.value})}>
                                    <option value="">Pilih...</option>
                                    {satuanList.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Satuan Besar</label>
                                <select className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.satuan_besar} onChange={e => setFormData({...formData, satuan_besar: e.target.value})}>
                                    <option value="">Tidak Ada</option>
                                    {satuanList.filter(s => s !== formData.satuan_dasar).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Rasio Konversi</label>
                                <input type="number" min="1" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.rasio_konversi} onChange={e => setFormData({...formData, rasio_konversi: e.target.value === '' ? '' : Number(e.target.value)})} disabled={!formData.satuan_besar} />
                            </div>
                        </div>
                        {formData.satuan_besar && formData.rasio_konversi > 1 && (
                            <p className="text-xs text-blue-600 font-medium">ℹ️ 1 {formData.satuan_besar} = {formData.rasio_konversi} {formData.satuan_dasar}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Min Stok</label>
                            <input required type="number" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.minStok} onChange={e => setFormData({...formData, minStok: e.target.value === '' ? '' : Number(e.target.value)})} />
                        </div>
                        <div className="flex items-end">
                            <p className="text-xs text-slate-400 pb-3">ℹ️ Stok awal diisi melalui menu <strong>Penyesuaian Stok</strong> agar tercatat dengan kode batch.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Harga Beli /{formData.satuan_dasar || 'Satuan'}</label>
                            <input required type="number" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.hargaBeli} onChange={e => setFormData({...formData, hargaBeli: e.target.value === '' ? '' : Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Harga Jual /{formData.satuan_dasar || 'Satuan'}</label>
                            <input required type="number" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.hargaJual} onChange={e => setFormData({...formData, hargaJual: e.target.value === '' ? '' : Number(e.target.value)})} />
                        </div>
                    </div>

                    {formData.satuan_besar && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">💰 Harga Grosir ({formData.satuan_besar})</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Harga Beli /{formData.satuan_besar}</label>
                                    <input type="number" className="w-full p-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" placeholder={`Opsional (default: ${formatRp((formData.hargaBeli || 0) * (formData.rasio_konversi || 1))})`} value={formData.hargaBeli_besar} onChange={e => setFormData({...formData, hargaBeli_besar: e.target.value === '' ? '' : Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Harga Jual /{formData.satuan_besar}</label>
                                    <input type="number" className="w-full p-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" placeholder={`Opsional (default: ${formatRp((formData.hargaJual || 0) * (formData.rasio_konversi || 1))})`} value={formData.hargaJual_besar} onChange={e => setFormData({...formData, hargaJual_besar: e.target.value === '' ? '' : Number(e.target.value)})} />
                                </div>
                            </div>
                            <p className="text-xs text-amber-600">ℹ️ Kosongkan jika harga grosir = harga satuan × rasio konversi</p>
                        </div>
                    )}

                    <button type="submit" disabled={isProcessing} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-4 transition-colors">
                        {isProcessing ? "Memproses..." : (editId ? 'Simpan Perubahan' : 'Simpan Barang')}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
