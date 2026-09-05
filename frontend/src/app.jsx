import React, { useState, useEffect } from 'react';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { apiCall } from './utils/api';
import { getLocalYYYYMMDD } from './utils/helpers';
import logoImg from '/Images/LogoStockPro.png';
import { LayoutDashboard, Package, Tags, ArrowDownToLine, ArrowUpFromLine, Undo, Users, Briefcase, Factory, MapPin, ClipboardList, LogOut, Menu, Truck, Search, Bell, Calendar, ChevronDown, ChevronRight, UserCircle, MessageSquare, FileText } from './components/icons/Icons.jsx';
import { echo } from './utils/echo';

// Import Zustand Store
import useAppStore from './store/useAppStore';

// Komponen Pelindung Rute (Auth Guards)
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

const GuestRoute = ({ children }) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        return <Navigate to="/dashboard" replace />;
    }
    return children;
};

// Import Pages
import Login from './pages/Login'; 
import Dashboard from './pages/Dashboard';
import MasterBarang from './pages/MasterBarang';
import BarangMasuk from './pages/BarangMasuk';
import BarangKeluar from './pages/BarangKeluar';
import BarangReturn from './pages/BarangReturn';
import Makloon from './pages/Makloon';
import Kategori from './pages/Kategori';
import MasterSatuan from './pages/MasterSatuan';
import Lokasi from './pages/Lokasi';
import Supplier from './pages/Supplier';
import Pelanggan from './pages/Pelanggan.jsx';
import User from './pages/User';
import Logs from './pages/Logs';
import Notifikasi from './pages/Notifikasi';
import SemuaAktivitas from './pages/SemuaAktivitas';
import TransactionCalendar from './pages/TransactionCalendar';
import StockAdjustment from './pages/StockAdjustment';
import AIAssistant from './pages/AIAssistant';
import LaporanMutasi from './pages/LaporanMutasi';
import FloatingAIChat from './components/FloatingAIChat';

function MainApp() {
    const todayString = getLocalYYYYMMDD();
    const navigate = useNavigate();
    const location = useLocation();
    
    // UI Local State
    const [isLoadingSystem, setIsLoadingSystem] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedMenu, setExpandedMenu] = useState(null); // For Sidebar Dropdowns
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false); // Profile dropdown
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false); // Change password modal
    const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
    const [pwdAttempted, setPwdAttempted] = useState(false);
    const [passwordProcessing, setPasswordProcessing] = useState(false);
    const [isPengaturanOpen, setIsPengaturanOpen] = useState(false);

    // Global Store State
    const { 
        currentUser, setCurrentUser,
        currentUserPermissions, setCurrentUserPermissions,
        isApiOffline, setIsApiOffline,
        companyProfile, setCompanyProfile,
        items, setAllData, addLog
    } = useAppStore();

    useEffect(() => { document.documentElement.classList.remove('dark'); }, []);
    
    const fetchAllData = () => {
        apiCall('/init')
            .then(data => {
                if (data && data.isGuest) {
                    setIsLoadingSystem(false);
                    return;
                }
                setAllData(data);
                setIsApiOffline(false); 
                setIsLoadingSystem(false);
            })
            .catch(err => {
                setIsApiOffline(true);
                setTimeout(() => {
                    setAllData({
                        users: [{ username: 'admin', password: '123', namaLengkap: 'Admin Demo', role: 'Superadmin' }],
                        items: [{ kodeBarang: 'BRG001', nama: 'Botol 600ml', kategori: 'Kemasan', tipeBarang: 'Bahan Baku', satuan: 'Pcs', stok: 50, minStok: 100, hargaBeli: 800, hargaJual: 2500 }]
                    });
                    setIsLoadingSystem(false);
                }, 800);
            });
    };

    useEffect(() => {
        const initUser = async () => {
            const token = localStorage.getItem('auth_token');
            if (token) {
                try {
                    const user = await apiCall('/me');
                    setCurrentUser(user);
                } catch (e) {
                    localStorage.removeItem('auth_token');
                }
            }
            fetchAllData();
        };
        initUser();

        const channel = echo.channel('inventory-channel');
        channel.listen('.stok.updated', (data) => {
            fetchAllData(); 
        });
        return () => {
            channel.stopListening('.stok.updated');
            echo.leaveChannel('inventory-channel');
        };
    }, []);

    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');

    // Fetch current user's permissions after login
    useEffect(() => {
        if (currentUser && !isApiOffline) {
            // Use permissions from login response immediately if available
            if (currentUser.permissions && currentUser.permissions.length > 0) {
                setCurrentUserPermissions(currentUser.permissions);
            }
            // Also fetch fresh from API to stay in sync
            apiCall(`/users/${currentUser.username}/permissions`)
                .then(perms => setCurrentUserPermissions(perms))
                .catch(() => {});
        }
    }, [currentUser, isApiOffline, setCurrentUserPermissions]);

    // Permission check: Admins/Superadmins have full access, others check direct permissions
    const hasPermission = (permName) => {
        if (isAdminOrSuperadmin) return true;
        return currentUserPermissions.includes(permName);
    };

    if (isLoadingSystem) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-transparent to-indigo-950/30"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <img src={logoImg} alt="StockPro Logo" className="w-auto h-32 object-contain drop-shadow-2xl mb-4 animate-pulse" />
                    <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">StockPro</h1>
                    <p className="text-sm text-slate-400 font-medium mb-10">PT Mara Jaya Dewi Sakti</p>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                        <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                        <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                </div>
            </div>
        );
    }

    const hasToken = !!localStorage.getItem('auth_token');

    if (!currentUser) {
        return (
            <Routes>
                {/* Root Route Logic: Jika ada token arahkan ke dashboard, jika tidak ke login */}
                <Route path="/" element={hasToken ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
                
                {/* Guest Route Logic: Cegah user yang sudah punya token mengakses halaman login */}
                <Route path="/login" element={
                    <GuestRoute>
                        <Login fetchAllData={fetchAllData} />
                    </GuestRoute>
                } />
                
                {/* Fallback Guest Route */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    // --- NAVIGATION STRUCTURE ---
    const navItems = [
        { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
        { id: 'ai-assistant', path: '/ai-assistant', label: 'AI Assistant', icon: MessageSquare, permission: 'view_ai_assistant' },
        { id: 'calendar', path: '/calendar', label: 'Kalender Transaksi', icon: Calendar, permission: 'view_dashboard' },
        { 
            id: 'inventory', label: 'Inventory', icon: Package, isDropdown: true,
            children: [
                { id: 'masuk', path: '/inventory/masuk', label: 'Barang Masuk', icon: ArrowDownToLine, permission: 'view_barang_masuk' },
                { id: 'keluar', path: '/inventory/keluar', label: 'Barang Keluar', icon: ArrowUpFromLine, permission: 'view_barang_keluar' },
                { id: 'return', path: '/inventory/return', label: 'Barang Return', icon: Undo, permission: 'view_barang_return' },
                { id: 'adjustment', path: '/inventory/adjustment', label: 'Penyesuaian Stok', icon: ClipboardList, permission: 'view_barang_masuk' },
                { id: 'makloon', path: '/inventory/makloon', label: 'Makloon', icon: Factory, permission: 'view_makloon' },
            ]
        },
        {
            id: 'master', label: 'Master Data', icon: Briefcase, isDropdown: true,
            children: [
                { id: 'master', path: '/master/barang', label: 'Master Barang', icon: Package, permission: 'view_master_barang' },
                { id: 'kategori', path: '/master/kategori', label: 'Kategori Barang', icon: Tags, permission: 'view_kategori' },
                { id: 'satuan', path: '/master/satuan', label: 'Master Satuan', icon: Package, permission: 'view_satuan' },
                { id: 'lokasi', path: '/master/lokasi', label: 'Lokasi Rak', icon: MapPin, permission: 'view_lokasi' },
                { id: 'supplier', path: '/master/supplier', label: 'Data Supplier', icon: Truck, permission: 'view_supplier' },
                { id: 'pelanggan', path: '/master/pelanggan', label: 'Data Pelanggan', icon: Users, permission: 'view_pelanggan' },
                ...(isAdminOrSuperadmin ? [{ id: 'user', path: '/master/user', label: 'Manajemen User', icon: UserCircle }] : [])
            ]
        },
        { id: 'laporan-mutasi', path: '/laporan/mutasi', label: 'Laporan Mutasi', icon: FileText, permission: 'view_dashboard' },
        ...(isAdminOrSuperadmin ? [
            { id: 'logs', path: '/logs', label: 'System Logs', icon: ClipboardList }
        ] : [])
    ].map(item => {
        if (item.isDropdown) {
            const filteredChildren = item.children.filter(child => !child.permission || hasPermission(child.permission));
            return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
        }
        return (!item.permission || hasPermission(item.permission)) ? item : null;
    }).filter(Boolean);

    const handleNavClick = (item) => {
        if (item.isDropdown) {
            setExpandedMenu(expandedMenu === item.id ? null : item.id);
        } else {
            navigate(item.path);
            setIsMobileMenuOpen(false);
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.clear();
        window.location.href = '/login';
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwdAttempted(true);
        if (passwordForm.new_password.length < 8) {
            return;
        }
        setPasswordProcessing(true);
        try {
            await apiCall('/change-password', 'PUT', passwordForm);
            toast.success('Password berhasil diubah!');
            setIsChangePasswordOpen(false);
            setPwdAttempted(false);
            setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
        } catch (err) {
            toast.error(err.message || 'Gagal mengubah password.');
        } finally {
            setPasswordProcessing(false);
        }
    };

    const getActiveLabel = () => {
        const currentPath = location.pathname;
        if (currentPath === '/notifikasi') return 'Notifikasi Stok';
        if (currentPath === '/semua-aktivitas') return 'Semua Aktivitas';
        for (const item of navItems) {
            if (item.path === currentPath) return item.label;
            if (item.children) {
                const child = item.children.find(c => c.path === currentPath);
                if (child) return child.label;
            }
        }
        return 'Dashboard';
    };

    const hasLowStock = Array.isArray(items) && items.some(item => Number(item.stok) < Number(item.minStok));

    // Fallback for Dashboard setActiveTab
    const handleSetActiveTabFallback = (tabId) => {
        for (const item of navItems) {
            if (item.id === tabId) { navigate(item.path); return; }
            if (item.children) {
                const child = item.children.find(c => c.id === tabId);
                if (child) { navigate(child.path); return; }
            }
        }
        navigate('/dashboard');
    };

    return (
        <div className="h-screen flex text-slate-900 bg-[#f8fafc] relative overflow-hidden font-sans">
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', padding: '14px 20px', fontSize: '14px', background: '#fff', color: '#0f172a' } }} />
            {isApiOffline && <div className="absolute top-0 w-full bg-amber-500 text-slate-900 px-4 py-2 text-sm font-bold text-center z-50 print:hidden shrink-0">⚠️ MODE SIMULASI OFFLINE</div>}
            
            {/* --- SIDEBAR --- */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-[#1e293b] border-r border-transparent text-slate-300 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static print:hidden shadow-2xl flex flex-col h-full shrink-0`}>
                
                {/* Logo Section */}
                <div className="h-20 flex items-center px-6 border-b border-slate-700/50 shrink-0">
                    <div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight">StockPro</h1>
                        <p className="text-[11px] text-slate-400 font-medium">Inventory Management</p>
                    </div>
                    <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>✕</button>
                </div>
                
                {/* Menus */}
                <div className="flex-1 min-h-0 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.children && item.children.some(c => c.path === location.pathname));
                        const isExpanded = expandedMenu === item.id || isActive;

                        return (
                            <div key={item.id} className="mb-1">
                                <button 
                                    onClick={() => handleNavClick(item)} 
                                    className={`w-full flex items-center justify-between px-4 py-3.5 text-[15px] font-medium rounded-xl transition-all duration-200 ${isActive && !item.isDropdown ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                >
                                    <div className="flex items-center">
                                        <item.icon className={`w-5 h-5 mr-3 ${isActive && !item.isDropdown ? 'text-white' : 'text-slate-400'}`} />
                                        {item.label}
                                    </div>
                                    {item.isDropdown && (
                                        isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}
                                </button>
                                
                                {/* Dropdown Items */}
                                {item.isDropdown && (
                                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                        <div className="pl-4 border-l border-slate-700/50 ml-6 space-y-1 py-1">
                                            {item.children.map(child => (
                                                <button 
                                                    key={child.id}
                                                    onClick={() => { navigate(child.path); setIsMobileMenuOpen(false); }}
                                                    className={`w-full flex items-center px-4 py-2.5 text-[14px] font-medium rounded-lg transition-colors ${location.pathname === child.path ? 'text-blue-400 bg-slate-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full mr-3 ${location.pathname === child.path ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                                    {child.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Profile Section Bottom (Fixed) */}
                <div className="mt-auto p-4 shrink-0 relative">
                    {/* Profile Dropdown Menu */}
                    {isProfileMenuOpen && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                            <button
                                onClick={() => { setIsPengaturanOpen(true); setIsProfileMenuOpen(false); }}
                                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3 border-b border-slate-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                Profil Perusahaan
                            </button>
                            <button
                                onClick={() => { setIsChangePasswordOpen(true); setIsProfileMenuOpen(false); }}
                                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Pengaturan Akun
                            </button>
                        </div>
                    )}
                    <div
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className="bg-slate-800/50 rounded-2xl p-4 flex items-center border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
                            {currentUser.namaLengkap.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 overflow-hidden flex-1">
                            <p className="text-[13px] font-bold text-white truncate">{currentUser.namaLengkap}</p>
                            <p className="text-[11px] text-slate-400 truncate">{currentUser.role}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="ml-2 p-2 text-slate-400 hover:text-rose-400 transition-colors bg-slate-800 hover:bg-slate-700 rounded-lg shrink-0" title="Logout">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 lg:hidden print:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative" onClick={() => isProfileMenuOpen && setIsProfileMenuOpen(false)}>
                
                {/* Header */}
                <header className="h-20 bg-white border-b border-slate-200/60 flex items-center justify-between px-6 sm:px-10 z-10 shrink-0 print:hidden shadow-sm">
                    <div className="flex items-center gap-4">
                        <button className="p-2 -ml-2 text-slate-500 lg:hidden hover:bg-slate-100:bg-slate-800 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(true)}>
                            <Menu className="w-6 h-6" />
                        </button>
                        
                        {/* Page Name replaced Search Bar */}
                        <div className="hidden md:flex items-center">
                            <h2 className="text-[20px] font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                                <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                                {getActiveLabel()}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5">

                        
                        {/* Notification */}
                        <button onClick={() => navigate('/notifikasi')} className="p-2.5 text-slate-400 hover:text-blue-600:text-blue-400 hover:bg-blue-50:bg-slate-800 rounded-full transition-colors relative" title="Notifikasi Stok">
                            <Bell className="w-5 h-5" />
                            {hasLowStock && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white shadow-sm"></span>}
                        </button>
                        
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                        
                        {/* Company Name */}
                        <div className="flex items-center">
                            <button onClick={() => setIsPengaturanOpen(true)} className="text-[14px] font-bold text-slate-700 hover:text-blue-600:text-blue-400 transition-colors hidden sm:block text-left">
                                {companyProfile.nama}
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar print:p-0 print:overflow-visible print:h-auto">
                    <div className="max-w-[1400px] mx-auto">
                        {/* Render active page using React Router */}
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            
                            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                            <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
                            <Route path="/notifikasi" element={<ProtectedRoute><Notifikasi /></ProtectedRoute>} />
                            <Route path="/semua-aktivitas" element={<ProtectedRoute><SemuaAktivitas /></ProtectedRoute>} />
                            
                            <Route path="/master/barang" element={<ProtectedRoute><MasterBarang /></ProtectedRoute>} />
                            <Route path="/master/kategori" element={<ProtectedRoute><Kategori /></ProtectedRoute>} />
                            <Route path="/master/satuan" element={<ProtectedRoute><MasterSatuan /></ProtectedRoute>} />
                            <Route path="/master/lokasi" element={<ProtectedRoute><Lokasi /></ProtectedRoute>} />
                            <Route path="/master/supplier" element={<ProtectedRoute><Supplier /></ProtectedRoute>} />
                            <Route path="/master/pelanggan" element={<ProtectedRoute><Pelanggan /></ProtectedRoute>} />
                            
                            <Route path="/inventory/masuk" element={<ProtectedRoute><BarangMasuk /></ProtectedRoute>} />
                            <Route path="/inventory/keluar" element={<ProtectedRoute><BarangKeluar /></ProtectedRoute>} />
                            <Route path="/inventory/return" element={<ProtectedRoute><BarangReturn /></ProtectedRoute>} />
                            <Route path="/inventory/adjustment" element={<ProtectedRoute><StockAdjustment /></ProtectedRoute>} />
                            <Route path="/inventory/makloon" element={<ProtectedRoute><Makloon /></ProtectedRoute>} />
                            <Route path="/calendar" element={<ProtectedRoute><TransactionCalendar /></ProtectedRoute>} />
                            <Route path="/laporan/mutasi" element={<ProtectedRoute><LaporanMutasi /></ProtectedRoute>} />
                            
                            {isAdminOrSuperadmin && <Route path="/master/user" element={<ProtectedRoute><User /></ProtectedRoute>} />}
                            {isAdminOrSuperadmin && <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />}
                            
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </div>
                </div>
            </main>

            {/* Change Password Modal */}
            {isChangePasswordOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => {setIsChangePasswordOpen(false); setPwdAttempted(false);}}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-5">Ubah Password</h3>
                        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password Saat Ini</label>
                                <input type="password" required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={passwordForm.current_password} onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru (min. 8 karakter)</label>
                                <input type="password" required className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${pwdAttempted && passwordForm.new_password.length < 8 ? 'border-red-400 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-blue-500'}:border-blue-500:ring-blue-500`} value={passwordForm.new_password} onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})} />
                                {(pwdAttempted || passwordForm.new_password.length > 0) && passwordForm.new_password.length < 8 && <span className="text-red-500 text-sm mt-1 block">Password minimal 8 karakter</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label>
                                <input type="password" required className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${pwdAttempted && passwordForm.new_password_confirmation.length < 8 ? 'border-red-400 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-blue-500'}:border-blue-500:ring-blue-500`} value={passwordForm.new_password_confirmation} onChange={e => setPasswordForm({...passwordForm, new_password_confirmation: e.target.value})} />
                                {(pwdAttempted || passwordForm.new_password_confirmation.length > 0) && passwordForm.new_password_confirmation.length < 8 && <span className="text-red-500 text-sm mt-1 block">Password minimal 8 karakter</span>}
                                {pwdAttempted && passwordForm.new_password.length >= 8 && passwordForm.new_password_confirmation.length >= 8 && passwordForm.new_password !== passwordForm.new_password_confirmation && <span className="text-red-500 text-sm mt-1 block">Konfirmasi password tidak cocok</span>}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsChangePasswordOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors">Batal</button>
                                <button type="submit" disabled={passwordProcessing} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
                                    {passwordProcessing ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Company Profile Settings Modal */}
            {isPengaturanOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsPengaturanOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-5">Pengaturan Profil Perusahaan</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                const res = await apiCall('/company-profile', 'POST', {
                                    ...companyProfile,
                                    log_user: currentUser.namaLengkap
                                });
                                setCompanyProfile(res.data);
                                toast.success('Profil perusahaan berhasil diperbarui!');
                                setIsPengaturanOpen(false);
                            } catch (err) {
                                toast.error(err.message || 'Gagal menyimpan profil.');
                            }
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Perusahaan <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={companyProfile.nama} onChange={e => setCompanyProfile({...companyProfile, nama: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                                <textarea className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" rows="3" value={companyProfile.alamat} onChange={e => setCompanyProfile({...companyProfile, alamat: e.target.value})}></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">NPWP</label>
                                    <input type="text" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={companyProfile.npwp} onChange={e => setCompanyProfile({...companyProfile, npwp: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Penanggung Jawab</label>
                                    <input type="text" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={companyProfile.penanggung_jawab} onChange={e => setCompanyProfile({...companyProfile, penanggung_jawab: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsPengaturanOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors">Batal</button>
                                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Global Floating AI Chat Widget */}
            <FloatingAIChat />
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <MainApp />
        </BrowserRouter>
    );
}

const container = document.getElementById('root');

// FORCE RESET TO LIGHT MODE (Temporary Cleanup Script)
document.documentElement.classList.remove('dark');
localStorage.removeItem('theme');

if (!window.reactRoot) {
    window.reactRoot = createRoot(container);
}
window.reactRoot.render(<App />);
export default App;
