import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Package } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import useAppStore from '../store/useAppStore';

export default function MasterSatuan() {
    const { satuans, setSatuans, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [namaSatuan, setNamaSatuan] = useState('');

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);

    const openAddModal = () => { setEditId(null); setNamaSatuan(''); setModalOpen(true); };
    const handleEdit = (row) => { setEditId(row.id); setNamaSatuan(row.nama_satuan); setModalOpen(true); };

    const handleDelete = async (id) => {
        try {
            if (!isApiOffline) await apiCall(`/satuans/${id}`, 'DELETE', { log_user: currentUser.namaLengkap, log_detail: `Menghapus Satuan ID: ${id}` });
            setSatuans(satuans.filter(s => s.id !== id));
            if (isApiOffline) addSimulatedLog('DELETE', 'Satuan', `Menghapus Satuan ID: ${id}`);
        } catch (e) { toast.error(e.message || 'Gagal koneksi API.'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            if (editId) {
                if (!isApiOffline) await apiCall(`/satuans/${editId}`, 'PUT', { nama_satuan: namaSatuan, log_user: currentUser.namaLengkap, log_detail: `Mengubah Satuan ID:${editId} menjadi ${namaSatuan}` });
                setSatuans(satuans.map(s => s.id === editId ? { ...s, nama_satuan: namaSatuan } : s));
                if (isApiOffline) addSimulatedLog('UPDATE', 'Satuan', `Mengubah Satuan: ${namaSatuan}`);
            } else {
                const res = isApiOffline ? null : await apiCall('/satuans', 'POST', { nama_satuan: namaSatuan, log_user: currentUser.namaLengkap, log_detail: `Menambah Satuan Baru: ${namaSatuan}` });
                const newSatuan = res?.data || { id: Date.now(), nama_satuan: namaSatuan };
                setSatuans([...satuans, newSatuan]);
                if (isApiOffline) addSimulatedLog('CREATE', 'Satuan', `Menambah Satuan: ${namaSatuan}`);
            }
            setModalOpen(false);
        } catch (e) { toast.error(e.message || 'Gagal koneksi API.'); }
        finally { setIsProcessing(false); }
    };

    const columns = [{ key: 'id', label: 'ID' }, { key: 'nama_satuan', label: 'Nama Satuan' }];

    return (
        <div>
            <div className="space-y-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCardMini title="Total Satuan" value={satuans.length} icon={Package} bgClass="bg-violet-50" colorClass="text-violet-600" />
                </div>

                <DataTable
                    title="Master Satuan" filename="Satuan" data={satuans}
                    onAdd={can('create_satuan') ? openAddModal : null} onEdit={can('edit_satuan') ? handleEdit : null} onDelete={can('delete_satuan') ? handleDelete : null} idKey="id"
                    columns={columns}
                />
            </div>

            <ReportPrintTemplate title="LAPORAN DATA MASTER SATUAN" type="master" columns={columns} data={satuans} />


            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Satuan" : "Tambah Satuan"}>
                <form onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Satuan</label>
                        <input required className="w-full p-2.5 border border-slate-200 rounded-xl:border-blue-500:ring-blue-500" value={namaSatuan} onChange={e => setNamaSatuan(e.target.value)} placeholder="Contoh: Pcs, Dus, Kg, Liter" />
                    </div>
                    <button disabled={isProcessing} className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl mt-4 flex justify-center items-center">{isProcessing ? "Menyimpan..." : 'Simpan'}</button>
                </form>
            </Modal>
        </div>
    );
}
