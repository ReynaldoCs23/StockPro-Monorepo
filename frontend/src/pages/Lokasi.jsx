import useAppStore from '../store/useAppStore';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId } from '../utils/helpers';

export default function Lokasi() {
    const { locations, setLocations, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [nama, setNama] = useState('');
    const [tipeLokasi, setTipeLokasi] = useState('internal');

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);
    
    const openAddModal = () => { setEditId(null); setNama(''); setTipeLokasi('internal'); setModalOpen(true); };
    const handleEdit = (row) => { setEditId(row.idLokasi); setNama(row.nama); setTipeLokasi(row.tipe_lokasi || 'internal'); setModalOpen(true); };
    
    const handleDelete = async (id) => {
        try {
            if(!isApiOffline) await apiCall(`/locations/${id}`, 'DELETE', { log_user: currentUser.namaLengkap, log_detail: `Menghapus Lokasi: ${id}`, id_key: 'idLokasi' });
            setLocations(locations.filter(l => l.idLokasi !== id));
            if(isApiOffline) addSimulatedLog('DELETE', 'Lokasi', `Menghapus Lokasi Rak: ${id}`);
        } catch(e) { toast.error("Gagal koneksi API: Pastikan tabel dan API route 'locations' sudah ditambahkan di Backend Laravel."); }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        setIsProcessing(true);
        try {
            if (editId) {
                // PERBAIKAN: Tambahkan id_key dan log_detail
                if(!isApiOffline) await apiCall(`/locations/${editId}`, 'PUT', { 
                    nama: nama, 
                    tipe_lokasi: tipeLokasi,
                    id_key: 'idLokasi', 
                    log_user: currentUser.namaLengkap,
                    log_detail: `Mengubah Lokasi ${editId} menjadi ${nama}` 
                });

                setLocations(locations.map(l => l.idLokasi === editId ? { ...l, nama, tipe_lokasi: tipeLokasi } : l));
                if(isApiOffline) addSimulatedLog('UPDATE', 'Lokasi', `Mengubah Lokasi: ${editId}`);
            } else {
                const payload = { 
                    idLokasi: generateId('LOK', locations, 'idLokasi'), 
                    nama, 
                    tipe_lokasi: tipeLokasi
                };
                
                // PERBAIKAN: Tambahkan log_detail
                if(!isApiOffline) await apiCall(`/locations`, 'POST', { 
                    ...payload, 
                    log_user: currentUser.namaLengkap,
                    log_detail: `Menambah Lokasi Baru: ${nama}` 
                });

                setLocations([...locations, payload]);
                if(isApiOffline) addSimulatedLog('CREATE', 'Lokasi', `Menambah Lokasi Rak: ${nama}`);
            }
            setModalOpen(false); 
        } catch(e) { 
            toast.error("Gagal memproses data: " + e.message); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    const columns = [ 
        { key: 'idLokasi', label: 'ID Lokasi' }, 
        { key: 'nama', label: 'Nama Rak / Area / Vendor' },
        { key: 'tipe_lokasi', label: 'Tipe Lokasi', format: v => (
            <span className={`px-2 py-1 rounded text-xs font-bold ${v === 'vendor' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {v === 'vendor' ? 'Gudang Makloon' : 'Gudang Sendiri'}
            </span>
        ), exportFormat: v => v === 'vendor' ? 'Gudang Makloon' : 'Gudang Sendiri' }
    ];

    return (
        <div>
            <div className="space-y-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCardMini title="Total Lokasi Rak" value={locations.length} icon={MapPin} bgClass="bg-blue-50" colorClass="text-blue-600" />
                </div>
                
                <DataTable 
                    title="Master Lokasi Penyimpanan (Rak)" filename="Lokasi_Gudang" data={locations} 
                    onAdd={can('create_lokasi') ? openAddModal : null} onEdit={can('edit_lokasi') ? handleEdit : null} onDelete={can('delete_lokasi') ? handleDelete : null} idKey="idLokasi" 
                    columns={columns} 
                />
            </div>

            <ReportPrintTemplate title="LAPORAN DATA LOKASI RAK" type="master" columns={columns} data={locations} />

            
            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Lokasi Rak" : "Tambah Lokasi Rak"}>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {tipeLokasi === 'vendor' ? 'Nama Vendor / Pabrik Makloon' : 'Nama Rak / Area Penyimpanan'}
                            </label>
                            <input required placeholder={tipeLokasi === 'vendor' ? 'Contoh: PT Makmur Jaya' : 'Contoh: Rak A-1'} className="w-full p-2.5 border border-slate-200 rounded-xl:border-blue-500:ring-blue-500" value={nama} onChange={e => setNama(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Tipe Lokasi</label>
                            <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white:border-blue-500:ring-blue-500" value={tipeLokasi} onChange={e => setTipeLokasi(e.target.value)}>
                                <option value="internal">Gudang Sendiri (Internal)</option>
                                <option value="vendor">Gudang Makloon (Vendor)</option>
                            </select>
                        </div>
                    </div>
                    <button disabled={isProcessing} className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl mt-4 flex justify-center items-center">
                        {isProcessing ? "Menyimpan..." : 'Simpan'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}