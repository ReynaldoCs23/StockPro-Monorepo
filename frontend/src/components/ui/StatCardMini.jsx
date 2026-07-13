import React from 'react';
import { ArrowUpFromLine, ArrowDownToLine } from '../icons/Icons';

export default function StatCardMini({ title, value, icon: Icon, colorClass, bgClass, percentage, isPositive, subtitle }) {
    return (
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${bgClass} ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {percentage && (
                    <div className="flex items-center gap-1">
                        {isPositive ? <ArrowUpFromLine className="w-3 h-3 text-emerald-500" /> : <ArrowDownToLine className="w-3 h-3 text-rose-500" />}
                        <span className={`text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>{percentage}</span>
                    </div>
                )}
            </div>
            <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight">{value}</h3>
                {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
}