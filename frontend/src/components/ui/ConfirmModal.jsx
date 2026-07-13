import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title = 'Konfirmasi', message = 'Yakin ingin melanjutkan?', confirmText = 'Ya, Lanjutkan', cancelText = 'Batal', variant = 'danger' }) {
    if (!isOpen) return null;

    const variants = {
        danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20',
        warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
        info: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                        {cancelText}
                    </button>
                    <button onClick={() => { onConfirm(); onClose(); }} className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${variants[variant]}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
