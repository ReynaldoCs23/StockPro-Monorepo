import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Sparkles, User } from '../components/icons/Icons';
import useAppStore from '../store/useAppStore';

export default function AIAssistant() {
    const { currentUser } = useAppStore();
    const token = localStorage.getItem('auth_token'); // for auth header if needed

    const [messages, setMessages] = useState([
        { role: 'ai', text: "Halo! Saya Asisten AI PT Mara Jaya Dewi Sakti. Ada data stok, return galon, atau performa vendor yang ingin Anda cari tahu hari ini?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

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
            const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            
            const response = await axios.post(`${baseURL}/api/ask-ai`, 
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
                setMessages((prev) => [...prev, { role: 'ai', text: response.data.answer }]);
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

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl print:hidden">
            {/* HEADER */}
            <div className="flex items-center gap-3 p-5 bg-white border-b border-slate-200 z-10 shadow-sm shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <Sparkles className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Asisten AI Operasional</h1>
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online & Siap Membantu
                    </p>
                </div>
            </div>

            {/* AREA OBROLAN (SCROLLABLE) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth bg-slate-50/50">
                <div className="max-w-4xl mx-auto w-full space-y-6">
                    {messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div key={idx} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-full md:max-w-[85%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                
                                {/* Avatar */}
                                <div className="shrink-0 mt-1">
                                    {isUser ? (
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm text-blue-600">
                                            <User className="w-5 h-5" />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-2 border-white shadow-sm text-white">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>

                                {/* Chat Bubble */}
                                <div className={`px-6 py-4 rounded-3xl shadow-sm text-[15px] leading-relaxed ${
                                    isUser 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                                }`}>
                                    <ReactMarkdown
                                        components={{
                                            strong: ({node, ...props}) => <span className="font-bold" {...props} />,
                                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                            li: ({node, ...props}) => <li className="" {...props} />
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex w-full justify-start">
                        <div className="flex max-w-full md:max-w-[85%] gap-4 flex-row">
                            <div className="shrink-0 mt-1">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-2 border-white shadow-sm text-white">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="px-6 py-5 bg-white text-slate-800 border border-slate-200 rounded-3xl rounded-tl-none shadow-sm flex gap-2 items-center">
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
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                <form 
                    onSubmit={handleSend}
                    className="max-w-4xl mx-auto flex items-end gap-3 bg-slate-50 border border-slate-200 p-2 rounded-3xl focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all shadow-sm"
                >
                    <textarea 
                        className="flex-1 max-h-32 min-h-[50px] bg-transparent resize-none p-3 outline-none text-slate-700 placeholder:text-slate-400 text-[15px]"
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
                        className="shrink-0 mb-1 mr-1 w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-md shadow-blue-500/30"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </form>
                <div className="text-center mt-3">
                    <span className="text-[11px] font-medium text-slate-400">Asisten AI dapat berbuat kesalahan. Mohon periksa kembali informasi penting.</span>
                </div>
            </div>
        </div>
    );
}
