import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Factory, User, Lock } from '../components/icons/Icons';
import { getLocalYYYYMMDD } from '../utils/helpers';
import logoImg from '/Images/LogoStockPro.png';
import useAppStore from '../store/useAppStore';

export default function Login({ fetchAllData }) {
    const { users, setCurrentUser, isApiOffline, addLog: addSimulatedLog } = useAppStore();
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loginAttempted, setLoginAttempted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const todayString = getLocalYYYYMMDD(new Date());

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoginAttempted(true);

        if (loginData.password.length < 8) {
            return;
        }

        // Offline mode: fallback to local check
        if (isApiOffline) {
            const user = users.find(u => u.username === loginData.username && u.password === String(loginData.password));
            if (user) {
                setCurrentUser(user);
                if (addSimulatedLog) addSimulatedLog('LOGIN', 'Sistem', `User ${user.namaLengkap} berhasil masuk.`);
                if (fetchAllData) fetchAllData();
            } else {
                setError('Username atau password salah / Belum ada akun.');
            }
            return;
        }

        // Online mode: call backend API
        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(loginData),
            });
            const data = await res.json();

            if (!res.ok) {
                const msg = data.message;
                if (res.status === 403) {
                    toast.error(msg || 'Akun Anda tidak dapat diakses. Hubungi Administrator.');
                } else if (res.status === 401) {
                    toast.error(msg || 'Username atau Password salah!');
                } else if (res.status === 422) {
                    toast.error('Format input tidak valid. Periksa kembali data Anda.');
                } else {
                    toast.error('Terjadi kesalahan pada server. Silakan coba lagi nanti.');
                }
                return;
            }

            // Check masa berlaku
            if (data.user.masaBerlaku && data.user.masaBerlaku < todayString) {
                setError('Akun Anda sudah kedaluwarsa. Silakan hubungi Admin.');
                return;
            }

            // Store token for future API calls
            localStorage.setItem('auth_token', data.token);
            toast.success('Login Berhasil! Selamat Datang di StockPro.');
            setCurrentUser(data.user);
            if (fetchAllData) fetchAllData();
        } catch (err) {
            console.error("Login Error:", err);
            toast.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans text-slate-900">
            {/* Left Side - Image & Branding (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-[#0f172a] overflow-hidden">
                {/* Background Image */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950 via-slate-900/80 to-transparent"></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 lg:p-20 w-full h-full">
                    <div>
                        <div className="flex items-center gap-3 text-white mb-6">
                            <img src={logoImg} alt="StockPro Logo" className="w-auto h-16 object-contain drop-shadow-md" />
                            <span className="text-xl font-bold tracking-tight">StockPro</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                            Manajemen Stok <br /> <span className="text-blue-400">Terintegrasi.</span>
                        </h1>
                        <p className="text-slate-300 text-lg max-w-md leading-relaxed">
                            Sistem inventory manajemen stok PT Mara Jaya Dewi Sakti. Kelola barang masuk, keluar, dan produksi dengan efisien dan presisi.
                        </p>

                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col relative bg-white">
                {/* Simulated Offline Warning */}
                {isApiOffline && (
                    <div className="absolute top-0 left-0 right-0 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 px-6 py-3 text-sm font-semibold flex items-center justify-center backdrop-blur-md z-50">
                        <span className="mr-2">⚠️</span> MODE SIMULASI — Koneksi ke database terputus.
                    </div>
                )}

                <div className="flex-1 flex flex-col justify-center px-6 sm:px-16 md:px-24 lg:px-32 relative">
                    <div className="max-w-md w-full mx-auto">
                        <div className="text-center lg:text-left mb-10">
                            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                                <img src={logoImg} alt="StockPro Logo" className="w-auto h-16 object-contain drop-shadow-md" />
                                <span className="text-2xl font-bold tracking-tight text-slate-900">StockPro</span>
                            </div>

                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Selamat Datang </h2>
                            <p className="mt-3 text-slate-500 font-medium">Silakan masuk menggunakan akun Anda untuk mengakses sistem inventory PT Mara Jaya Dewi Sakti.</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 text-sm font-medium rounded-xl flex items-center gap-3 shake">
                                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-6" noValidate>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-b transition-all:border-blue-500:ring-blue-500"
                                        placeholder="Masukkan username"
                                        value={loginData.username}
                                        onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-slate-700">Password</label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        required
                                        type="password"
                                        className={`block w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-medium placeholder-slate-400 focus:bg-white focus:outline-none transition-all ${loginAttempted && loginData.password.length < 8 ? 'border-red-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-b'}:border-blue-500:ring-blue-500`}
                                        placeholder="Masukkan password"
                                        value={loginData.password}
                                        onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                                    />
                                </div>
                                {(loginAttempted || loginData.password.length > 0) && loginData.password.length < 8 && <span className="text-red-500 text-sm mt-1 block font-medium">Password minimal 8 karakter</span>}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLoading ? 'Memproses...' : 'Masuk ke Dashboard'}
                            </button>
                        </form>

                        <div className="mt-10 text-center">
                            <p className="text-sm text-slate-500 font-medium">
                                &copy; {new Date().getFullYear()} PT Mara Jaya Dewi Sakti. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}