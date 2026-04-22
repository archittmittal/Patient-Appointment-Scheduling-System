import React, { useState, useEffect } from 'react';
import { Send, User, MessageSquare, Search, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const Messages = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

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
                setNewMessage('');
                fetchHistory(selectedUser.other_user_id);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    if (loading) return <div className="p-20 text-center">Loading messages...</div>;

    return (
        <div className="section-container h-[calc(100vh-120px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
            {/* Sidebar / Conversations List */}
            <div className={`apple-card p-6 w-full md:w-80 flex flex-col gap-4 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Search conversations..." className="input-field pl-10 py-2 text-sm" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {conversations.map((conv) => (
                        <div 
                            key={conv.other_user_id}
                            onClick={() => setSelectedUser(conv)}
                            className={`p-4 rounded-xl cursor-pointer transition-all ${selectedUser?.other_user_id === conv.other_user_id ? 'bg-primary text-white' : 'bg-slate-50 hover:bg-slate-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                                    <User size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">User #{conv.other_user_id}</p>
                                    <p className={`text-xs ${selectedUser?.other_user_id === conv.other_user_id ? 'text-white/70' : 'text-slate-500'}`}>
                                        {new Date(conv.last_message_time).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {conversations.length === 0 && <p className="text-center text-slate-400 py-10">No messages yet</p>}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`apple-card p-0 flex-1 flex flex-col overflow-hidden ${!selectedUser ? 'hidden md:flex items-center justify-center bg-slate-50' : 'flex'}`}>
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b flex items-center gap-4">
                            <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 hover:bg-slate-100 rounded-full">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="font-bold">Chat with User #{selectedUser.other_user_id}</p>
                                <p className="text-xs text-emerald-500 font-medium">Online</p>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${msg.sender_id === user.id ? 'bg-primary text-white rounded-br-none' : 'bg-white border rounded-bl-none'}`}>
                                        <p className="text-sm">{msg.content}</p>
                                        <p className={`text-[10px] mt-1 ${msg.sender_id === user.id ? 'text-white/70' : 'text-slate-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={sendMessage} className="p-4 border-t flex gap-4">
                            <input 
                                type="text" 
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..." 
                                className="flex-1 bg-slate-50 border-none focus:ring-2 focus:ring-primary rounded-xl px-4 py-3"
                            />
                            <button type="submit" className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center hover:shadow-lg transition-all">
                                <Send size={20} />
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mx-auto">
                            <MessageSquare size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-500">Select a conversation</h3>
                        <p className="text-slate-400 text-sm">Pick a contact from the left to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messages;
