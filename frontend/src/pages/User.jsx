import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, User as UserIcon } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { getLocalYYYYMMDD } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

// Toggle Switch Component
function ToggleSwitch({ enabled, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={label}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

// Permission Grid Component
function PermissionGrid({ allPermissions, userPermissions, setUserPermissions }) {
    const actions = ['view', 'create', 'edit', 'delete'];

    const moduleLabels = {
        dashboard: 'Dashboard',
        barang_masuk: 'Barang Masuk',
        barang_keluar: 'Barang Keluar',
        barang_return: 'Barang Return',
        penyesuaian_stok: 'Penyesuaian Stok',
        makloon: 'Makloon',
        master_barang: 'Master Barang',
        kategori: 'Kategori',
        satuan: 'Satuan',
        lokasi: 'Lokasi',
        supplier: 'Supplier',
        pelanggan: 'Pelanggan',
        laporan: 'Laporan',
    };

    const isChecked = (module, action) => userPermissions.includes(`${action}_${module}`);

    const toggle = (module, action) => {
        const perm = `${action}_${module}`;
        if (userPermissions.includes(perm)) {
            setUserPermissions(userPermissions.filter(p => p !== perm));
        } else {
            setUserPermissions([...userPermissions, perm]);
        }
    };

    const hasAction = (module, action) => allPermissions[module]?.includes(action);

    const toggleAllModule = (module) => {
        const modulePerms = (allPermissions[module] || []).map(a => `${a}_${module}`);
        const allActive = modulePerms.every(p => userPermissions.includes(p));
        if (allActive) {
            setUserPermissions(userPermissions.filter(p => !modulePerms.includes(p)));
        } else {
            setUserPermissions([...new Set([...userPermissions, ...modulePerms])]);
        }
    };

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_repeat(4,_64px)] bg-slate-50 border-b border-slate-200">
                <div className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Modul</div>
                {actions.map(a => (
                    <div key={a} className="px-2 py-3 text-xs font-bold text-slate-500 uppercase text-center">{a}</div>
                ))}
            </div>
            {/* Rows */}
            {Object.keys(allPermissions).filter(m => m !== 'manajemen_user' && m !== 'laporan').map((module, idx) => (
                <div key={module} className={`grid grid-cols-[1fr_repeat(4,_64px)] items-center ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-100 last:border-b`}>
                    <div className="px-4 py-3 flex items-center gap-2">
                        <button type="button" onClick={() => toggleAllModule(module)} className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">
                            {moduleLabels[module] || module}
                        </button>
                    </div>
                    {actions.map(action => (
                        <div key={action} className="flex justify-center py-3">
                            {hasAction(module, action) ? (
                                <ToggleSwitch
                                    enabled={isChecked(module, action)}
                                    onChange={() => toggle(module, action)}
                                    label={`${action} ${module}`}
                                />
                            ) : (
                                <span className="text-slate-300 text-xs">—</span>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default function User() {
    const { users, setUsers, currentUser, isApiOffline, addLog: addSimulatedLog } = useAppStore();
    const todayString = getLocalYYYYMMDD();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [formData, setFormData] = useState({ username: '', namaLengkap: '', password: '', role: 'Karyawan', masaBerlaku: '' });

    // Permission state
    const [activeModalTab, setActiveModalTab] = useState('info');
    const [allPermissions, setAllPermissions] = useState({});
    const [userPermissions, setUserPermissions] = useState([]);
    const [loadingPerms, setLoadingPerms] = useState(false);

    // Fallback: default permission structure when API hasn't loaded yet
    const defaultPermissions = {
        dashboard: ['view'],
        barang_masuk: ['view', 'create', 'edit', 'delete'],
        barang_keluar: ['view', 'create', 'edit', 'delete'],
        barang_return: ['view', 'create', 'edit', 'delete'],
        penyesuaian_stok: ['view', 'create', 'edit', 'delete'],
        makloon: ['view', 'create', 'edit', 'delete'],
        master_barang: ['view', 'create', 'edit', 'delete'],
        kategori: ['view', 'create', 'edit', 'delete'],
        satuan: ['view', 'create', 'edit', 'delete'],
        lokasi: ['view', 'create', 'edit', 'delete'],
        supplier: ['view', 'create', 'edit', 'delete'],
        pelanggan: ['view', 'create', 'edit', 'delete'],
        laporan: ['view'],
        ai_assistant: ['view'],
        ai_forecasting: ['view'],
    };

    // Use API data if available, otherwise use fallback
    const effectivePermissions = Object.keys(allPermissions).length > 0 ? allPermissions : defaultPermissions;

    const activeUsersCount = users.filter(u => !u.masaBerlaku || u.masaBerlaku >= todayString).length;

    const openAddModal = () => { 
        setEditId(null);
        setSubmitAttempted(false);
        setActiveModalTab('info');
        setFormData({ username: '', namaLengkap: '', password: '', role: 'Karyawan', masaBerlaku: '' }); 
        setUserPermissions([]);
        setModalOpen(true); 
    };

    const handleEdit = (row) => {
        setEditId(row.username);
        setSubmitAttempted(false);
        setActiveModalTab('info');
        setFormData({ 
            username: row.username, 
            namaLengkap: row.namaLengkap, 
            password: '', 
            role: row.role || 'Karyawan', 
            masaBerlaku: row.masaBerlaku || '' 
        });
        setModalOpen(true);
        fetchPermissionsData(row.username);
    };

    const fetchPermissionsData = async (username) => {
        if (isApiOffline) return;
        setLoadingPerms(true);
        try {
            const [permsData, userPermsData] = await Promise.all([
                apiCall('/permissions'),
                apiCall(`/users/${username}/direct-permissions`)
            ]);
            setAllPermissions(permsData);
            setUserPermissions(userPermsData);
        } catch (e) {
            console.error('Failed to fetch permissions:', e);
        } finally {
            setLoadingPerms(false);
        }
    };

    // Fetch all permissions on mount (for add modal)
    useEffect(() => {
        if (!isApiOffline) {
            apiCall('/permissions').then(setAllPermissions).catch(() => {});
        }
    }, []);

    const handleDelete = async (id) => {
        const targetUser = users.find(u => u.username === id);
        if (targetUser?.role === 'Superadmin') {
            toast.error("Akses Ditolak: Akun dengan level 'Superadmin' dilindungi dan tidak dapat dihapus.");
            return;
        }
        if (id === currentUser.username) {
            toast.error("Gagal: Anda tidak dapat menghapus akun Anda sendiri yang sedang login.");
            return;
        }

        try {
            if (!isApiOffline) {
                await apiCall(`/users/${id}`, 'DELETE', { 
                    log_user: currentUser.namaLengkap, 
                    log_detail: `Menghapus user: ${id}`,
                    id_key: 'username' 
                });
            }
            setUsers(users.filter(u => u.username !== id));
            if (isApiOffline) addSimulatedLog('DELETE', 'Users', `Menghapus User: ${id}`);
        } catch (e) { 
            toast.error("Gagal koneksi API: " + e.message); 
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitAttempted(true);
        if ((!editId && formData.password.length < 8) || (editId && formData.password.length > 0 && formData.password.length < 8)) {
            return;
        }
        setIsProcessing(true);
        try {
            if (editId) {
                if (!isApiOffline) {
                    await apiCall(`/users/${editId}`, 'PUT', { 
                        ...formData, 
                        log_user: currentUser.namaLengkap, 
                        id_key: 'username',
                        log_detail: `Mengubah data user: ${editId}` 
                    });
                    // Only sync permissions if on permissions tab or if permissions were explicitly loaded
                    if (formData.role === 'Guest' && !loadingPerms && userPermissions.length > 0) {
                        await apiCall(`/users/${editId}/permissions`, 'PUT', { permissions: userPermissions });
                    }
                    const freshUsers = await apiCall('/users');
                    setUsers(freshUsers);
                } else {
                    setUsers(users.map(u => u.username === editId ? { ...u, ...formData, role: formData.role } : u));
                    addSimulatedLog('UPDATE', 'Users', `Mengubah User: ${editId}`);
                }
            } else {
                if (!isApiOffline) {
                    const { username, ...createData } = formData;
                    await apiCall(`/users`, 'POST', { 
                        ...createData, 
                        log_user: currentUser.namaLengkap, 
                        log_detail: `Tambah User baru` 
                    });
                    const freshUsers = await apiCall('/users');
                    setUsers(freshUsers);
                } else {
                    setUsers([...users, { ...formData, username: 'MJD-AUTO' }]);
                    addSimulatedLog('CREATE', 'Users', `Menambah User baru`);
                }
            }
            setModalOpen(false);
        } catch (e) { toast.error(e.message); } finally { setIsProcessing(false); }
    };

    const columns = [
        { key: 'username', label: 'Username' },
        { key: 'namaLengkap', label: 'Nama Lengkap' },
        { key: 'role', label: 'Role', format: v => <span className={`px-2 py-1 rounded text-[10px] font-bold ${v === 'Superadmin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{v}</span>, exportFormat: v => v },
        { key: 'masaBerlaku', label: 'Masa Berlaku', format: v => v ? v : 'Selamanya' }
    ];

    return (
        <div>
            <div className="space-y-6 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <StatCardMini title="Total User Sistem" value={users.length} icon={Users} bgClass="bg-slate-100" colorClass="text-slate-700" />
                    <StatCardMini title="Total User Aktif" value={activeUsersCount} icon={UserIcon} bgClass="bg-blue-50" colorClass="text-blue-600" />
                </div>

                <DataTable 
                    title="Pengguna Sistem" 
                    data={users} 
                    onAdd={openAddModal} 
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    idKey="username" 
                    filename="Data_Users"
                    hideActions={(row) => row.role === 'Superadmin'}
                    columns={columns}
                />
            </div>

            <ReportPrintTemplate title="LAPORAN DATA PENGGUNA SISTEM" type="master" columns={columns} data={users} />


            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editId ? "Update Data Pengguna" : "Tambah Pengguna"} width="max-w-2xl">
                {/* Tab Navigation (only show permissions tab for Guest role) */}
                {editId && formData.role === 'Guest' && (
                    <div className="flex border-b border-slate-200 mb-5">
                        <button
                            type="button"
                            onClick={() => setActiveModalTab('info')}
                            className={`px-4 py-2.5 text-sm font-semibold border-b transition-colors ${activeModalTab === 'info' ? 'border-b text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Informasi User
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveModalTab('permissions')}
                            className={`px-4 py-2.5 text-sm font-semibold border-b transition-colors ${activeModalTab === 'permissions' ? 'border-b text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Hak Akses Spesifik
                        </button>
                    </div>
                )}

                {/* Tab: Info */}
                {activeModalTab === 'info' && (() => {
                    const isPasswordInvalid = formData.password.length > 0 ? formData.password.length < 8 : (!editId && submitAttempted);
                    return (
                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Username</label>
                            <input disabled className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed:border-blue-500:ring-blue-500" placeholder="Auto-generated by system (e.g., MJDS26001)" value={editId ? formData.username : ''} readOnly/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Nama Lengkap</label>
                            <input required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.namaLengkap} onChange={e=>setFormData({...formData, namaLengkap: e.target.value})}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Password (min. 8 karakter)</label>
                                <input required={!editId} type="password" placeholder={editId ? "Kosongkan jika tidak diubah" : "Min. 8 karakter"} className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${isPasswordInvalid ? 'border-red-400 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-blue-500'}:border-blue-500:ring-blue-500`} value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})}/>
                                {isPasswordInvalid && <span className="text-red-500 text-sm mt-1 block font-medium">Password minimal 8 karakter</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Role</label>
                                <select className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.role} onChange={e=>{
                                    const newRole = e.target.value;
                                    setFormData({...formData, role: newRole});
                                    if (newRole !== 'Guest') setActiveModalTab('info');
                                }}>
                                    <option value="Admin">Admin</option>
                                    <option value="Karyawan">Karyawan</option>
                                    <option value="Guest">Guest</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-400 uppercase text-[10px] font-bold">Masa Berlaku Akun</label>
                            <input type="date" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.masaBerlaku} onChange={e=>setFormData({...formData, masaBerlaku: e.target.value})}/>
                        </div>
                        <button disabled={isProcessing} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-4 flex justify-center items-center transition-colors">
                            {isProcessing ? "Menyimpan..." : (editId ? "Simpan Perubahan" : "Simpan User Baru")}
                        </button>
                    </form>
                    );
                })()}

                {/* Tab: Permissions (only for Guest role) */}
                {activeModalTab === 'permissions' && formData.role === 'Guest' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Custom Permissions Override</h4>
                                <p className="text-xs text-slate-500 mt-0.5">Atur hak akses spesifik untuk user ini. Klik nama modul untuk toggle semua.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const guestPerms = [];
                                        Object.keys(effectivePermissions).forEach(module => {
                                            if (effectivePermissions[module]?.includes('view')) {
                                                guestPerms.push(`view_${module}`);
                                            }
                                        });
                                        setUserPermissions(guestPerms);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
                                >
                                    Set as Guest (Read-Only)
                                </button>
                                <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                                    {userPermissions.length} aktif
                                </span>
                            </div>
                        </div>

                        {loadingPerms ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="loader border-t-blue-500 w-8 h-8"></div>
                                <span className="ml-3 text-sm text-slate-500">Memuat permissions...</span>
                            </div>
                        ) : (
                            <PermissionGrid
                                allPermissions={effectivePermissions}
                                userPermissions={userPermissions}
                                setUserPermissions={setUserPermissions}
                            />
                        )}

                        <button
                            type="button"
                            disabled={isProcessing || loadingPerms}
                            onClick={async () => {
                                setIsProcessing(true);
                                try {
                                    await apiCall(`/users/${editId}/permissions`, 'PUT', { permissions: userPermissions });
                                    toast.success('Permissions berhasil disimpan!');
                                } catch (e) {
                                    toast.error('Gagal menyimpan: ' + e.message);
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center items-center transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? "Menyimpan..." : "Simpan Permissions"}
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
