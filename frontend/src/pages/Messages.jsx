import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare, Search, ArrowLeft, MoreVertical, Paperclip, Smile, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const Messages = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (selectedUser) {
            fetchHistory(selectedUser.other_user_id);
            const interval = setInterval(() => fetchHistory(selectedUser.other_user_id), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedUser]);

    const fetchConversations = async () => {
        try {
            const res = await fetch(`${API}/api/messages/conversations`, { headers: authedHeaders() });
            const data = await res.json();
            setConversations(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            setLoading(false);
        }
    };

    const fetchHistory = async (otherId) => {
        try {
            const res = await fetch(`${API}/api/messages/history/${otherId}`, { headers: authedHeaders() });
            const data = await res.json();
            setMessages(data);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        const optimisticMessage = {
            id: Date.now(),
            sender_id: user.id,
            content: newMessage,
            created_at: new Date().toISOString(),
            is_optimistic: true
        };
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');

        try {
            const res = await fetch(`${API}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authedHeaders() },
                body: JSON.stringify({
                    receiverId: selectedUser.other_user_id,
                    content: newMessage
                })
            });
            if (res.ok) {
                fetchHistory(selectedUser.other_user_id);
                fetchConversations();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-4">
             <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
             <p className="text-sm font-medium text-slate-500 tracking-wide">Securely loading your messages...</p>
        </div>
    );

    return (
        <div className="section-container h-[calc(100vh-140px)] flex flex-col md:flex-row gap-0 overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-2xl shadow-slate-200/50 animate-in fade-in zoom-in-95 duration-700">
            {/* Sidebar / Conversations List */}
            <div className={`w-full md:w-96 flex flex-col bg-slate-50/50 border-r border-slate-100 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-8 pb-4">
                    <h1 className="text-3xl font-bold tracking-tight mb-6">Messages</h1>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search chats..." 
                            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
                    {conversations.map((conv) => (
                        <div 
                            key={conv.other_user_id}
                            onClick={() => setSelectedUser(conv)}
                            className={`p-4 rounded-[1.5rem] cursor-pointer transition-all duration-300 group ${
                                selectedUser?.other_user_id === conv.other_user_id 
                                    ? 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100' 
                                    : 'hover:bg-white/60 hover:shadow-lg hover:shadow-slate-200/30'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm border border-white">
                                        <img 
                                            src={`https://ui-avatars.com/api/?name=User+${conv.other_user_id}&background=0071e3&color=fff&bold=true`} 
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <p className={`font-bold text-[15px] truncate ${selectedUser?.other_user_id === conv.other_user_id ? 'text-primary' : 'text-slate-900'}`}>
                                            User #{conv.other_user_id}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {new Date(conv.last_message_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate font-medium">Click to view conversation history</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {conversations.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 opacity-40">
                            <MessageSquare size={48} className="text-slate-300" />
                            <p className="text-sm font-bold text-slate-400 tracking-tight">No active conversations</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-white overflow-hidden ${!selectedUser ? 'hidden md:flex items-center justify-center bg-slate-50/30' : 'flex'}`}>
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <ArrowLeft size={20} className="text-slate-600" />
                                </button>
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                                    <User size={24} />
                                </div>
                                <div>
                                    <p className="font-extrabold text-slate-900">User #{selectedUser.other_user_id}</p>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Active Now</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:20px_20px]">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === user.id;
                                const showAvatar = idx === 0 || messages[idx-1].sender_id !== msg.sender_id;
                                
                                return (
                                    <div key={msg.id} className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 duration-300`}>
                                        {!isMe && (
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-400 overflow-hidden">
                                                {showAvatar ? <img src={`https://ui-avatars.com/api/?name=U&background=cbd5e1&color=fff`} alt="U" /> : <div className="w-full h-full" />}
                                            </div>
                                        )}
                                        <div className={`group relative max-w-[65%] space-y-1`}>
                                            <div className={`p-4 rounded-3xl text-sm leading-relaxed shadow-sm transition-all hover:shadow-md ${
                                                isMe 
                                                    ? 'bg-primary text-white rounded-br-none' 
                                                    : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
                                            } ${msg.is_optimistic ? 'opacity-70 italic' : ''}`}>
                                                {msg.content}
                                            </div>
                                            <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                {isMe && <div className="w-3 h-3 text-primary opacity-50"><ShieldCheck size={12} /></div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-6 bg-white border-t border-slate-100">
                            <form onSubmit={sendMessage} className="flex items-center gap-3 bg-slate-50 p-2 rounded-[2rem] border border-slate-100 focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/20 transition-all group">
                                <button type="button" className="p-3 text-slate-400 hover:text-primary transition-colors">
                                    <Smile size={22} />
                                </button>
                                <input 
                                    type="text" 
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message here..." 
                                    className="flex-1 bg-transparent border-none outline-none py-3 text-[15px] text-slate-700 placeholder:text-slate-400"
                                />
                                <button type="button" className="p-3 text-slate-400 hover:text-primary transition-colors hidden sm:block">
                                    <Paperclip size={22} />
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!newMessage.trim()}
                                    className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:shadow-xl hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:shadow-none"
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                            <p className="text-[10px] text-center text-slate-400 mt-4 font-medium uppercase tracking-widest">
                                Your messages are end-to-end encrypted
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="text-center space-y-6 max-w-sm px-8">
                        <div className="relative mx-auto w-32 h-32">
                            <div className="absolute inset-0 bg-primary/10 rounded-[3rem] animate-pulse"></div>
                            <div className="absolute inset-4 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-primary/30">
                                <MessageSquare size={56} strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Select a Chat</h3>
                            <p className="text-slate-500 text-[15px] leading-relaxed">
                                Connect with your healthcare provider or patient instantly. Stay informed and secure.
                            </p>
                        </div>
                        <button className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:shadow-lg transition-all">
                            Browse Contacts
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messages;
