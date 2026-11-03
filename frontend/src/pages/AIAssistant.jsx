import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import toast from 'react-hot-toast';
import { Send, Loader2, Sparkles, User, Copy, Download, ChevronDown, FileText } from '../components/icons/Icons';
import useAppStore from '../store/useAppStore';
import { normalizeAiMarkdown } from '../utils/aiMarkdown';
import { getApiBaseUrl } from '../utils/api';
import '../../css/ai-message.css';

// Komponen markdown: hanya pembungkus tabel (scroll horizontal); sisanya diatur .ai-message-content
const MARKDOWN_COMPONENTS = {
    table: ({ node, ...props }) => (
        <div className="ai-table-wrap"><table {...props} /></div>
    ),
};

// Nama file PDF: Analisis-AI_PT-Mara-Jaya-Dewi-Sakti_{YYYY-MM-DD}_{HHmm}.pdf (zona Asia/Jakarta)
const buildPdfFilename = (date = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map((x) => [x.type, x.value]));
    return `Analisis-AI_PT-Mara-Jaya-Dewi-Sakti_${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}.pdf`;
};

export default function AIAssistant() {
    const { currentUser } = useAppStore();
    const token = localStorage.getItem('auth_token'); // for auth header if needed

    const [messages, setMessages] = useState([
        { role: 'ai', text: "Selamat datang di Pusat Analisis Data StockPro. Saya adalah Asisten AI untuk PT Mara Jaya Dewi Sakti. Bagaimana saya dapat membantu Anda menganalisis data stok, mutasi barang, atau metrik keuangan hari ini?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [openMenuIdx, setOpenMenuIdx] = useState(null);
    const [exportingIdx, setExportingIdx] = useState(null);
    const messagesEndRef = useRef(null);

    // Tutup menu unduh saat klik di luar menu
    useEffect(() => {
        if (openMenuIdx === null) return;
        const close = (e) => { if (!e.target.closest('[data-download-menu]')) setOpenMenuIdx(null); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [openMenuIdx]);

    // Auto-scroll ke bawah saat pesan bertambah
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        
        const question = input.trim();
        if (!question) return;

        // Masukkan pesan user ke state
        const newMessages = [...messages, { role: 'user', text: question }];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Konfigurasi axios jika backend ada di port berbeda atau butuh token
            const apiBaseUrl = getApiBaseUrl();
            
            const response = await axios.post(`${apiBaseUrl}/ask-ai`, 
                { question: question },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            // Jika respons berhasil didapat, masukkan answer ke messages
            if (response.data && response.data.answer) {
                setMessages((prev) => [...prev, { role: 'ai', text: response.data.answer, question }]);
            } else {
                setMessages((prev) => [...prev, { role: 'ai', text: "Maaf, saya tidak mengerti respon dari server." }]);
            }
        } catch (error) {
            console.error("AI Error:", error);
            setMessages((prev) => [...prev, { role: 'ai', text: "Maaf, mesin AI sedang sibuk atau terjadi kesalahan jaringan. Silakan coba lagi." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    // Salin markdown yang sudah dirapikan (bukan HTML)
    const handleCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(normalizeAiMarkdown(text));
            toast.success('Jawaban disalin ke clipboard');
        } catch {
            toast.error('Gagal menyalin jawaban');
        }
    };

    // Format unduhan lama (.md) dipertahankan sebagai opsi
    const handleDownload = (text) => {
        setOpenMenuIdx(null);
        const blob = new Blob([normalizeAiMarkdown(text)], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI_Response_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // PDF dibuat di server (teks tetap bisa diseleksi), hanya berisi jawaban AI
    const handleDownloadPdf = async (msg, idx) => {
        setOpenMenuIdx(null);
        if (exportingIdx !== null) return;
        setExportingIdx(idx);
        try {
            const response = await axios.post(`${getApiBaseUrl()}/ai/export-pdf`, {
                markdown: normalizeAiMarkdown(msg.text),
                title: 'Analisis Asisten AI StockPro',
                question: msg.question || null,
            }, {
                responseType: 'blob',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/pdf' },
            });
            const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = buildPdfFilename();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success('PDF berhasil diunduh');
        } catch (error) {
            console.error('Export PDF Error:', error);
            const status = error?.response?.status;
            if (status === 401) toast.error('Sesi Anda berakhir. Silakan login ulang untuk mengunduh PDF.');
            else if (status === 422 || status === 413) toast.error('Jawaban terlalu panjang atau tidak valid untuk dijadikan PDF.');
            else toast.error('Gagal membuat PDF. Silakan coba lagi.');
        } finally {
            setExportingIdx(null);
        }
    };

    return (
        <div className="-m-4 sm:-m-8 flex flex-col h-[calc(100vh-64px)] bg-white print:hidden">
            {/* AREA OBROLAN (SCROLLABLE) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth bg-slate-50/30">
                <div className="max-w-4xl mx-auto w-full space-y-5">
                    {messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div key={idx} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-full gap-3 ${isUser ? 'md:max-w-[80%] flex-row-reverse' : 'md:max-w-[85%] min-w-0 flex-row'}`}>
                                
                                {/* Avatar */}
                                <div className="shrink-0 mt-1">
                                    {isUser ? (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <User className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>

                                {/* Chat Bubble & Actions */}
                                <div className="flex flex-col gap-2 w-full min-w-0">
                                    <div className={`px-5 py-3.5 rounded-2xl text-[14px] leading-relaxed ${
                                        isUser 
                                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                                        : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm shadow-sm'
                                    }`}>
                                        {isUser ? (
                                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                        ) : (
                                            <div className="ai-message-content">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    rehypePlugins={[rehypeSanitize]}
                                                    components={MARKDOWN_COMPONENTS}
                                                >
                                                    {normalizeAiMarkdown(msg.text)}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons (Only for AI) */}
                                    {!isUser && (
                                        <div className="flex items-center gap-2 px-1">
                                            <button 
                                                onClick={() => handleCopy(msg.text)}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" /> Salin
                                            </button>
                                            <div className="relative" data-download-menu>
                                                <button
                                                    onClick={() => setOpenMenuIdx(openMenuIdx === idx ? null : idx)}
                                                    disabled={exportingIdx === idx}
                                                    aria-haspopup="menu"
                                                    aria-expanded={openMenuIdx === idx}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                                                >
                                                    {exportingIdx === idx
                                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Membuat PDF...</>
                                                        : <><Download className="w-3.5 h-3.5" /> Unduh <ChevronDown className="w-3 h-3" /></>}
                                                </button>
                                                {openMenuIdx === idx && (
                                                    <div role="menu" className="absolute left-0 bottom-full mb-1 z-20 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                                                        <button role="menuitem" onClick={() => handleDownloadPdf(msg, idx)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 text-left">
                                                            <FileText className="w-3.5 h-3.5" /> Unduh PDF
                                                        </button>
                                                        <button role="menuitem" onClick={() => handleDownload(msg.text)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 text-left">
                                                            <Download className="w-3.5 h-3.5" /> Unduh Markdown (.md)
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex w-full justify-start">
                        <div className="flex max-w-full md:max-w-[80%] gap-3 flex-row">
                            <div className="shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="px-5 py-4 bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5 items-center">
                                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Reference for Auto Scroll */}
                <div ref={messagesEndRef} className="h-4" />
                </div>
            </div>

            {/* AREA INPUT (STICKY BOTTOM) */}
            <div className="px-4 md:px-8 py-3 bg-white border-t border-slate-100 shrink-0">
                <form 
                    onSubmit={handleSend}
                    className="max-w-4xl mx-auto flex items-end gap-3 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all"
                >
                    <textarea 
                        className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none p-3 outline-none text-slate-700 placeholder:text-slate-400 text-[14px]"
                        placeholder="Tanyakan sesuatu pada AI..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        rows={1}
                    />
                    <button 
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="shrink-0 mb-0.5 mr-0.5 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-md shadow-blue-500/25"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </form>
                <div className="text-center mt-2">
                    <span className="text-[11px] font-medium text-slate-400">Asisten AI dapat berbuat kesalahan. Mohon periksa kembali informasi penting.</span>
                </div>
            </div>
        </div>
    );
}
