import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Sparkles, X, MessageSquare } from './icons/Icons';
import useAppStore from '../store/useAppStore';

const FloatingAIChat = () => {
    const { user } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Halo! Saya Asisten AI StockPro. Ada yang bisa saya bantu hari ini?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto scroll ke bawah tiap ada pesan baru
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('auth_token');
            const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await axios.post(
                `${baseURL}/api/ask-ai`,
                { question: userMsg.text },
                {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            setMessages(prev => [...prev, { role: 'ai', text: res.data.answer }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', text: 'Maaf, gagal terhubung ke AI. Pastikan server nyala.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Box (Muncul saat isOpen true) */}
            {isOpen && (
                <div className="bg-white w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] rounded-2xl shadow-2xl border border-slate-200 mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
                    
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Asisten AI Operasional</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                    <span className="text-xs text-blue-100">Online</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 text-sm">
                        {messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={idx} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                                        isUser 
                                        ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' 
                                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                                    }`}>
                                        <ReactMarkdown
                                            components={{
                                                strong: ({node, ...props}) => <span className="font-bold" {...props} />,
                                                p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                                                ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-1" {...props} />,
                                                ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-1" {...props} />
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            );
                        })}
                        {isLoading && (
                            <div className="flex w-full justify-start">
                                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1.5 items-center">
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-1" />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2 items-end">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            placeholder="Tanya AI..."
                            className="flex-1 max-h-32 min-h-[44px] bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl px-4 py-2.5 resize-none text-sm transition-all shadow-inner"
                            rows="1"
                        />
                        <button 
                            type="submit" 
                            disabled={isLoading || !input.trim()}
                            className="shrink-0 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-md transition-all active:scale-95"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </form>

                </div>
            )}

            {/* Tombol Buble Utama */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-lg hover:shadow-xl text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 border-2 border-white/20"
                >
                    <MessageSquare className="w-6 h-6" />
                    {/* Badge Notif opsional */}
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full"></span>
                </button>
            )}
        </div>
    );
};

export default FloatingAIChat;
