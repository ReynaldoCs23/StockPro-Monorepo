import useAppStore from '../store/useAppStore';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Tags } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId } from '../utils/helpers';

export default function Kategori() {
    const { categories, setCategories, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [nama, setNama] = useState('');

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);
    
    const openAddModal = () => { setEditId(null); setNama(''); setModalOpen(true); };
    const handleEdit = (row) => { setEditId(row.idKategori); setNama(row.nama); setModalOpen(true); };
    
    const handleDelete = async (id) => {
        try {
            if(!isApiOffline) await apiCall(`/categories/${id}`, 'DELETE', { log_user: currentUser.namaLengkap, log_detail: `Menghapus Kategori: ${id}`, id_key: 'idKategori' });
            setCategories(categories.filter(c => c.idKategori !== id));
            if(isApiOffline) addSimulatedLog('DELETE', 'Kategori', `Menghapus Kategori: ${id}`);
        } catch(e) { toast.error(e.message || 'Gagal koneksi API.'); }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        setIsProcessing(true);
        
        try {
            if (editId) {
                // UPDATE: Tambahkan id_key dan log_detail
                if(!isApiOffline) await apiCall(`/categories/${editId}`, 'PUT', { 
                    nama: nama, 
                    id_key: 'idKategori', 
                    log_user: currentUser.namaLengkap,
                    log_detail: `Mengubah Kategori ${editId} menjadi ${nama}` // <-- TAMBAHKAN INI
                });

                setCategories(categories.map(c => c.idKategori === editId ? { ...c, nama } : c));
                if(isApiOffline) addSimulatedLog('UPDATE', 'Kategori', `Mengubah Kategori: ${editId}`);
            } else {
                const payload = { idKategori: generateId('KTG', categories, 'idKategori'), nama };
                
                // CREATE: Tambahkan log_detail
                if(!isApiOffline) await apiCall(`/categories`, 'POST', { 
                    ...payload, 
                    log_user: currentUser.namaLengkap,
                    log_detail: `Menambah Kategori Baru: ${nama}` // <-- TAMBAHKAN INI
                });

                setCategories([...categories, payload]);
                if(isApiOffline) addSimulatedLog('CREATE', 'Kategori', `Menambah Kategori: ${nama}`);
            }
            setModalOpen(false); 
        } catch(e) { 
            toast.error(e.message || 'Gagal koneksi API.'); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    const columns = [ { key: 'idKategori', label: 'ID' }, { key: 'nama', label: 'Kategori' } ];

    return (
        <div>
            <div className="space-y-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCardMini title="Total Kategori" value={categories.length} icon={Tags} bgClass="bg-indigo-50" colorClass="text-indigo-600" />
                </div>
                
                <DataTable 
                    title="Kategori Barang" filename="Kategori" data={categories} 
                    onAdd={can('create_kategori') ? openAddModal : null} onEdit={can('edit_kategori') ? handleEdit : null} onDelete={can('delete_kategori') ? handleDelete : null} idKey="idKategori" 
                    columns={columns} 
                />
            </div>

            <ReportPrintTemplate title="LAPORAN DATA KATEGORI BARANG" type="master" columns={columns} data={categories} />

            
            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Kategori" : "Tambah Kategori"}>
                <form onSubmit={handleSubmit}>
                    <div><label className="block text-sm font-medium mb-1">Nama Kategori</label><input required className="w-full p-2.5 border border-slate-200 rounded-xl:border-blue-500:ring-blue-500" value={nama} onChange={e => setNama(e.target.value)} /></div>
                    <button disabled={isProcessing} className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl mt-4 flex justify-center items-center">{isProcessing ? "Menyimpan..." : 'Simpan'}</button>
                </form>
            </Modal>
        </div>
    );
}