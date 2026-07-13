import React from 'react';
import { X } from '../icons/Icons';

export default function Modal({ isOpen, onClose, title, children, width }) {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${width || 'max-w-md'} overflow-hidden transition-all duration-200 scale-100`}>
                
                {/* Header Modal */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 rounded-lg transition-colors">
                        <X className="w-5 h-5"/>
                    </button>
                </div>
                
                {/* Isi / Form Modal (Ini yang sebelumnya hilang!) */}
                <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {children} 
                </div>
                
            </div>
        </div>
    );
}