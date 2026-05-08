import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Pencil } from 'lucide-react';
import apiClient from '../services/apiClient';

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white/50";

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 });
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(null); // 'doctor' | 'patient' | 'edit' | null
    const [formData, setFormData] = useState({});
    const [editId, setEditId] = useState(null);
    const [editRole, setEditRole] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [filterRole, setFilterRole] = useState('ALL');
    const [sortBy, setSortBy] = useState('id');
    const [order, setOrder] = useState('ASC');

    const fetchUsers = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const query = new URLSearchParams({
                page,
                limit: 10,
                role: filterRole,
                sort_by: sortBy,
                order
            });
            const data = await apiClient.get(`/api/admin/users?${query.toString()}`);
            if (data.data) {
                setUsers(data.data);
                setMeta(data.meta);
            } else {
                setUsers(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [filterRole, sortBy, order]);

    useEffect(() => { fetchUsers(1); }, [fetchUsers]);

    const handleDelete = async (id, role) => {
        if (!confirm(`Are you sure you want to remove this ${role.toLowerCase()}? This will also delete all their appointments.`)) return;
        const endpoint = role === 'DOCTOR' ? `/api/admin/doctors/${id}` : `/api/admin/patients/${id}`;
        try {
            await apiClient.delete(endpoint);
            fetchUsers(meta.page);
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = async (id, role) => {
        setError('');
        try {
            const endpoint = role === 'DOCTOR' ? `/api/doctors/${id}` : `/api/patients/${id}`;
            const data = await apiClient.get(endpoint);
            setFormData({
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                specialty: data.specialty || '',
                degree: data.degree || '',
                experience_years: data.experience_years || '',
                location_room: data.location_room || '',
                phone: data.phone || '',
                address: data.address || '',
                blood_group: data.blood_group || '',
            });
            setEditId(id);
            setEditRole(role);
            setShowForm('edit');
        } catch (err) {
            setError('Failed to fetch user details');
        }
    };

    const handleFormChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const closeModal = () => { setShowForm(null); setFormData({}); setError(''); setEditId(null); setEditRole(null); };

    const handleSubmitDoctor = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await apiClient.post('/api/admin/doctors', formData);
            closeModal();
            fetchUsers(1);
        } catch (err) { 
            setError(err.message || 'Server error'); 
        } finally { 
            setSubmitting(false); 
        }
    };

    const handleSubmitPatient = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await apiClient.post('/api/admin/patients', formData);
            closeModal();
            fetchUsers(1);
        } catch (err) { 
            setError(err.message || 'Server error'); 
        } finally { 
            setSubmitting(false); 
        }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const endpoint = editRole === 'DOCTOR'
                ? `/api/doctors/${editId}`
                : `/api/patients/${editId}`;
            await apiClient.patch(endpoint, formData);
            closeModal();
            fetchUsers(1);
        } catch (err) { 
            setError(err.message || 'Server error'); 
        } finally { 
            setSubmitting(false); 
        }
    };

    return (
        <div className="section-container pb-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
                    <p className="text-gray-500 mt-1">Add, edit, or remove doctors and patients.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setShowForm('doctor'); setFormData({}); setError(''); }} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm">
                        <Plus size={16} /> Add Doctor
                    </button>
                    <button onClick={() => { setShowForm('patient'); setFormData({}); setError(''); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors text-sm">
                        <Plus size={16} /> Add Patient
                    </button>
                </div>
            </div>

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="glass-modal w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto rounded-[2rem]">
                        <button onClick={closeModal} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-xl transition-all">
                            <X size={18} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 mb-6">
                            {showForm === 'edit'
                                ? `Edit ${editRole === 'DOCTOR' ? 'Doctor' : 'Patient'}`
                                : showForm === 'doctor' ? 'Add New Doctor' : 'Add New Patient'}
                        </h2>
                        {error && <p className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</p>}

                        {/* Edit doctor */}
                        {showForm === 'edit' && editRole === 'DOCTOR' && (
                            <form onSubmit={handleSubmitEdit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label><input name="first_name" value={formData.first_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label><input name="last_name" value={formData.last_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Specialty</label><input name="specialty" value={formData.specialty || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Degree</label><input name="degree" value={formData.degree || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Experience (years)</label><input name="experience_years" type="number" value={formData.experience_years || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Room / Location</label><input name="location_room" value={formData.location_room || ''} onChange={handleFormChange} className={inputClass} /></div>
                                </div>
                                <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60">{submitting ? 'Saving...' : 'Save Changes'}</button>
                            </form>
                        )}

                        {/* Edit patient */}
                        {showForm === 'edit' && editRole === 'PATIENT' && (
                            <form onSubmit={handleSubmitEdit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label><input name="first_name" value={formData.first_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label><input name="last_name" value={formData.last_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Blood Group</label>
                                        <select name="blood_group" value={formData.blood_group || ''} onChange={handleFormChange} className={inputClass}>
                                            <option value="">Select</option>
                                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input name="phone" value={formData.phone || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Address</label><input name="address" value={formData.address || ''} onChange={handleFormChange} className={inputClass} /></div>
                                </div>
                                <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60">{submitting ? 'Saving...' : 'Save Changes'}</button>
                            </form>
                        )}

                        {/* Add doctor */}
                        {showForm === 'doctor' && (
                            <form onSubmit={handleSubmitDoctor} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label><input name="first_name" required value={formData.first_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label><input name="last_name" required value={formData.last_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input name="email" type="email" required value={formData.email || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Password</label><input name="password" type="password" required value={formData.password || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Specialty</label><input name="specialty" required value={formData.specialty || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Degree</label><input name="degree" value={formData.degree || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Experience (years)</label><input name="experience_years" type="number" value={formData.experience_years || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Room / Location</label><input name="location_room" value={formData.location_room || ''} onChange={handleFormChange} className={inputClass} /></div>
                                </div>
                                <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60">{submitting ? 'Adding...' : 'Add Doctor'}</button>
                            </form>
                        )}

                        {/* Add patient */}
                        {showForm === 'patient' && (
                            <form onSubmit={handleSubmitPatient} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label><input name="first_name" required value={formData.first_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label><input name="last_name" required value={formData.last_name || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input name="email" type="email" required value={formData.email || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Password</label><input name="password" type="password" required value={formData.password || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label><input name="dob" type="date" value={formData.dob || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Blood Group</label>
                                        <select name="blood_group" value={formData.blood_group || ''} onChange={handleFormChange} className={inputClass}>
                                            <option value="">Select</option>
                                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input name="phone" value={formData.phone || ''} onChange={handleFormChange} className={inputClass} /></div>
                                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Address</label><input name="address" value={formData.address || ''} onChange={handleFormChange} className={inputClass} /></div>
                                </div>
                                <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60">{submitting ? 'Adding...' : 'Add Patient'}</button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2">
                {['ALL', 'DOCTOR', 'PATIENT'].map(r => (
                    <button key={r} onClick={() => setFilterRole(r)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterRole === r ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50'}`}>
                        {r === 'ALL' ? 'All Users' : r === 'DOCTOR' ? 'Doctors' : 'Patients'}
                    </button>
                ))}
            </div>

            {/* Users table */}
            {isLoading ? (
                <div className="text-center text-slate-400 animate-pulse py-20 flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <span>Loading users...</span>
                </div>
            ) : (
                <div className="glass-card rounded-[2rem] overflow-hidden border-none shadow-xl">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortBy('name'); setOrder(order === 'ASC' ? 'DESC' : 'ASC'); }}>Name {sortBy === 'name' ? (order === 'ASC' ? '↑' : '↓') : ''}</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortBy('role'); setOrder(order === 'ASC' ? 'DESC' : 'ASC'); }}>Role {sortBy === 'role' ? (order === 'ASC' ? '↑' : '↓') : ''}</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === 'DOCTOR' ? 'bg-blue-500' : u.role === 'PATIENT' ? 'bg-green-500' : 'bg-gray-500'}`}>
                                                {u.name?.charAt(0) || '?'}
                                            </div>
                                            <span className="font-medium text-gray-900 text-sm">{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${u.role === 'DOCTOR' ? 'bg-blue-100 text-blue-700' : u.role === 'PATIENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {u.role === 'DOCTOR' && <span>{u.specialty}</span>}
                                        {u.role === 'PATIENT' && <span className="text-red-500 font-medium">{u.blood_group}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {u.role !== 'ADMIN' && (
                                                <button onClick={() => handleEdit(u.id, u.role)} className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light rounded-lg transition-colors" title="Edit">
                                                    <Pencil size={15} />
                                                </button>
                                            )}
                                            {u.role !== 'ADMIN' && (
                                                <button onClick={() => handleDelete(u.id, u.role)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && (
                        <div className="py-12 text-center text-gray-400">No users found.</div>
                    )}
                    {meta.total_pages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
                            <span className="text-sm text-gray-500">
                                Showing {((meta.page - 1) * meta.limit) + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    disabled={meta.page <= 1} 
                                    onClick={() => fetchUsers(meta.page - 1)}
                                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                    Previous
                                </button>
                                <button 
                                    disabled={meta.page >= meta.total_pages} 
                                    onClick={() => fetchUsers(meta.page + 1)}
                                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
