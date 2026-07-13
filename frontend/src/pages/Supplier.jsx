import useAppStore from '../store/useAppStore';
import React, { useState } from 'react';
import { Truck } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId } from '../utils/helpers';

export default function Supplier() {
    const { suppliers, setSuppliers, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState(null);
    const [formData, setFormData] = useState({ nama: '', alamat: '', telp: '', npwp: '', nik: '', penanggung_jawab: '', tipe_partner: 'supplier' });

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);

    const openAddModal = () => { 
        setEditId(null); 
        setFormData({ nama: '', alamat: '', telp: '', npwp: '', nik: '', penanggung_jawab: '', tipe_partner: 'supplier' }); 
        setModalOpen(true); 
    };

    const handleEdit = (row) => { 
        setEditId(row.idSupplier); 
        setFormData({ nama: row.nama, alamat: row.alamat, telp: row.telp, npwp: row.npwp || '', nik: row.nik || '', penanggung_jawab: row.penanggung_jawab || '', tipe_partner: row.tipe_partner || 'supplier' }); 
        setModalOpen(true); 
    };

    const handleDelete = async (id) => {
        if (!confirm("Hapus supplier ini?")) return;
        try {
            if(!isApiOffline) await apiCall(`/suppliers/${id}`, 'DELETE', { 
                log_user: currentUser.namaLengkap, 
                log_detail: `Menghapus Supplier: ${id}`, 
                id_key: 'idSupplier' 
            });
            setSuppliers(suppliers.filter(s => s.idSupplier !== id));
            if(isApiOffline) addSimulatedLog('DELETE', 'Supplier', `Menghapus Supplier: ${id}`);
            setToast({ message: "Supplier berhasil dihapus!", type: "success" });
        } catch(e) { setToast({ message: "Gagal menghapus: " + e.message, type: "error" }); }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        setIsProcessing(true);
        try {
            if(editId) {
                // PERBAIKAN: Menggunakan backticks (`) untuk log_detail dan merapikan payload
                if(!isApiOffline) await apiCall(`/suppliers/${editId}`, 'PUT', { 
                    ...formData, 
                    alamat_lengkap: formData.alamat, // Fallback alamat_faktur
                    id_key: 'idSupplier', 
                    log_user: currentUser.namaLengkap, 
                    log_detail: `Mengubah supplier ${editId} menjadi ${formData.nama}`
                });

                setSuppliers(suppliers.map(s => s.idSupplier === editId ? { ...s, ...formData, alamat_lengkap: formData.alamat } : s));
                if(isApiOffline) addSimulatedLog('UPDATE', 'Supplier', `Mengubah Supplier: ${editId}`);
                setToast({ message: "Supplier berhasil diupdate!", type: "success" });
            } else {
                const generatedPrefix = formData.tipe_partner === 'vendor' ? 'VEN' : 'SUP';
                const payload = { idSupplier: generateId(generatedPrefix, suppliers, 'idSupplier'), ...formData, alamat_lengkap: formData.alamat };
                
                // PERBAIKAN: Menggunakan backticks (`) untuk log_detail pada proses POST
                if(!isApiOffline) await apiCall(`/suppliers`, 'POST', { 
                    ...payload, 
                    log_user: currentUser.namaLengkap,
                    log_detail: `Menambah supplier baru: ${formData.nama}`
                });

                setSuppliers([...suppliers, payload]);
                if(isApiOffline) addSimulatedLog('CREATE', 'Supplier', `Menambah Supplier: ${payload.nama}`);
                setToast({ message: "Supplier berhasil ditambahkan!", type: "success" });
            }
            setModalOpen(false); 
        } catch(e) { 
            setToast({ message: "Gagal menyimpan: " + e.message, type: "error" });
        } finally { 
            setIsProcessing(false); 
        }
    };

    const columns = [ 
        { key: 'idSupplier', label: 'ID' }, 
        { key: 'nama', label: 'Nama' }, 
        { key: 'tipe_partner', label: 'Tipe Partner', format: v => <span className={`px-2 py-1 rounded text-xs font-bold ${v === 'vendor' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{v === 'vendor' ? 'Makloon Vendor' : 'Supplier'}</span>, exportFormat: v => v === 'vendor' ? 'Makloon Vendor' : 'Supplier' },
        { key: 'npwp', label: 'NPWP', format: v => v || '-' },
        { key: 'nik', label: 'NIK', format: v => v || '-' },
        { key: 'alamat', label: 'Alamat' }, 
        { key: 'telp', label: 'Telp' },
        { key: 'penanggung_jawab', label: 'Penanggung Jawab', format: v => v || '-' }
    ];

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="space-y-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCardMini title="Total Supplier Terdaftar" value={suppliers.length} icon={Truck} bgClass="bg-purple-50" colorClass="text-purple-600" />
                </div>
                
                <DataTable 
                    title="Data Supplier / Vendor" filename="Supplier" data={suppliers} 
                    onAdd={can('create_supplier') ? openAddModal : null} onEdit={can('edit_supplier') ? handleEdit : null} onDelete={can('delete_supplier') ? handleDelete : null} idKey="idSupplier" 
                    columns={columns} 
                />
            </div>

            <ReportPrintTemplate title="LAPORAN DATA SUPPLIER / VENDOR" type="master" columns={columns} data={suppliers} />

            
            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Supplier" : "Tambah Supplier"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Nama Supplier / Vendor</label>
                        <input required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.nama} onChange={e=>setFormData({...formData, nama: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Tipe Partner</label>
                        <select required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.tipe_partner} onChange={e=>setFormData({...formData, tipe_partner: e.target.value})}>
                            <option value="supplier">Supplier Umum</option>
                            <option value="vendor">Makloon Vendor</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Alamat</label>
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
                    <button disabled={isProcessing} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-4 flex justify-center items-center transition-colors">
                        {isProcessing ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Menyimpan...</span>
                            </div>
                        ) : 'Simpan Supplier'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}