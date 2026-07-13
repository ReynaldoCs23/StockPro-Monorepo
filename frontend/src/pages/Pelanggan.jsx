import useAppStore from '../store/useAppStore';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId } from '../utils/helpers';

export default function Pelanggan() {
    const { customers, setCustomers, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [formData, setFormData] = useState({ nama: '', alamat: '', telp: '', npwp: '', nik: '', penanggung_jawab: '' });

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);

    const openAddModal = () => { 
        setEditId(null); 
        setFormData({ nama: '', alamat: '', telp: '', npwp: '', nik: '', penanggung_jawab: '' }); 
        setModalOpen(true); 
    };

    const handleEdit = (row) => {
        setEditId(row.idPelanggan);
        setFormData({ nama: row.nama, alamat: row.alamat, telp: row.telp, npwp: row.npwp || '', nik: row.nik || '', penanggung_jawab: row.penanggung_jawab || '' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            if (editId) {
                // PERBAIKAN: Menambahkan log_detail menggunakan backticks
                if (!isApiOffline) await apiCall(`/customers/${editId}`, 'PUT', { 
                    ...formData, 
                    alamat_lengkap: formData.alamat, // Fallback alamat_faktur
                    log_user: currentUser.namaLengkap, 
                    id_key: 'idPelanggan',
                    log_detail: `Mengubah data pelanggan ${editId} menjadi ${formData.nama}` 
                });

                setCustomers(customers.map(c => c.idPelanggan === editId ? { ...c, ...formData, alamat_lengkap: formData.alamat } : c));
                if (isApiOffline) addSimulatedLog('UPDATE', 'Pelanggan', `Mengubah Pelanggan: ${editId}`);
            } else {
                const payload = { idPelanggan: generateId('CUS', customers, 'idPelanggan'), ...formData, alamat_lengkap: formData.alamat };
                
                // PERBAIKAN: Menambahkan log_detail pada proses POST
                if (!isApiOffline) await apiCall(`/customers`, 'POST', { 
                    ...payload, 
                    log_user: currentUser.namaLengkap,
                    log_detail: `Menambah pelanggan baru: ${formData.nama}`
                });

                setCustomers([...customers, payload]);
                if (isApiOffline) addSimulatedLog('CREATE', 'Pelanggan', `Menambah Pelanggan: ${payload.nama}`);
            }
            toast.success("Data pelanggan berhasil diperbarui!");
            setModalOpen(false);
        } catch (e) { 
            toast.error(e.message || 'Gagal koneksi API.'); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Hapus pelanggan ini?")) return;
        try {
            if (!isApiOffline) await apiCall(`/customers/${id}`, 'DELETE', { 
                log_user: currentUser.namaLengkap, 
                log_detail: `Menghapus Pelanggan: ${id}`, 
                id_key: 'idPelanggan' 
            });
            setCustomers(customers.filter(c => c.idPelanggan !== id));
            if (isApiOffline) addSimulatedLog('DELETE', 'Pelanggan', `Menghapus Pelanggan: ${id}`);
        } catch (e) { toast.error(e.message); }
    };

    const customerColumns = [
        { key: 'idPelanggan', label: 'ID' },
        { key: 'nama', label: 'Nama Pelanggan' },
        { key: 'npwp', label: 'NPWP', format: v => v || '-', exportFormat: v => v || '-' },
        { key: 'nik', label: 'NIK', format: v => v || '-', exportFormat: v => v || '-' },
        { key: 'alamat', label: 'Alamat' },
        { key: 'telp', label: 'Telp/WA' },
        { key: 'penanggung_jawab', label: 'Penanggung Jawab', format: v => v || '-', exportFormat: v => v || '-' }
    ];

    return (
        <div>
            <div className="space-y-6 print:hidden">
                {/* BOX RINGKASAN PELANGGAN */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCardMini title="Total Pelanggan Terdaftar" value={customers.length} icon={Briefcase} bgClass="bg-blue-50" colorClass="text-blue-600" />
                </div>

                <DataTable 
                    title="Data Pelanggan / Distributor" 
                    filename="Pelanggan" 
                    data={customers} 
                    onAdd={can('create_pelanggan') ? openAddModal : null} 
                    onEdit={can('edit_pelanggan') ? handleEdit : null} 
                    onDelete={can('delete_pelanggan') ? handleDelete : null} 
                    idKey="idPelanggan" 
                    columns={customerColumns}
                />
            </div>
            
            <ReportPrintTemplate title="Laporan Data Master Pelanggan" type="master" columns={customerColumns} data={customers} />

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Data Pelanggan" : "Tambah Pelanggan Baru"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Nama Pelanggan</label>
                        <input required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.nama} onChange={e=>setFormData({...formData, nama: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Alamat Lengkap</label>
                        <textarea required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.alamat} onChange={e=>setFormData({...formData, alamat: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">No. Telp / WhatsApp</label>
                        <input required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.telp} onChange={e=>setFormData({...formData, telp: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">NPWP</label>
                        <input placeholder="Opsional" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.npwp} onChange={e=>setFormData({...formData, npwp: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">NIK</label>
                        <input placeholder="Opsional - Nomor Induk Kependudukan" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.nik} onChange={e=>setFormData({...formData, nik: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Nama Penanggung Jawab</label>
                        <input placeholder="Opsional - PIC untuk tanda tangan Faktur" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.penanggung_jawab} onChange={e=>setFormData({...formData, penanggung_jawab: e.target.value})}/>
                    </div>
                    
                    <button disabled={isProcessing} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-4 transition-colors flex justify-center items-center">
                        {isProcessing ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Memproses...</span>
                            </div>
                        ) : "Simpan Data Pelanggan"}
                    </button>
                </form>
            </Modal>
        </div>
    );
}