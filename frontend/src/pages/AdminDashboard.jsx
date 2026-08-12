import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';

const emptyForm = { name: '', email: '', mobile: '', heightCm: '', dateOfBirth: '', password: '', role: 'USER' };

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function subscriptionStatus(subscriptionStartsAt, subscriptionEndsAt) {
  if (!subscriptionStartsAt && !subscriptionEndsAt) {
    return { label: 'Not yet purchased', className: 'text-gray-500' };
  }

  const today = new Date(new Date().toDateString());
  const startsAt = subscriptionStartsAt ? new Date(subscriptionStartsAt) : null;
  const endsAt = subscriptionEndsAt ? new Date(subscriptionEndsAt) : null;

  if (startsAt && today < startsAt) {
    return { label: 'Not yet purchased', className: 'text-gray-500' };
  }
  if (endsAt && today > endsAt) {
    return { label: 'Subscription ends', className: 'text-red-700' };
  }
  return { label: 'Active', className: 'text-green-700' };
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [subscriptionFilter, setSubscriptionFilter] = useState('ALL');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState('');

  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users', { params: { includeArchived: showArchived } });
      setUsers(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load clients'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [showArchived]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setCreatedInfo('');
    try {
      const res = await api.post('/admin/users', {
        ...form,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        password: form.password || undefined,
      });
      setForm(emptyForm);
      setShowAddForm(false);
      if (res.data.tempPassword) {
        setCreatedInfo(
          `${form.role === 'ADMIN' ? 'Trainer' : 'Client'} "${res.data.user.name}" created. Temporary password: ${res.data.tempPassword} (share this with them securely).`
        );
      } else {
        setCreatedInfo(`${form.role === 'ADMIN' ? 'Trainer' : 'Client'} "${res.data.user.name}" created.`);
      }
      loadUsers();
    } catch (err) {
      setError(errorMessage(err, 'Could not create client'));
    } finally {
      setCreating(false);
    }
  }

  async function toggleArchive(user) {
    setArchivingId(user.id);
    try {
      await api.put(`/admin/users/${user.id}/archive`, { archived: !user.archivedAt });
      loadUsers();
    } catch (err) {
      setError(errorMessage(err, 'Could not update archive status'));
    } finally {
      setArchivingId(null);
    }
  }

  async function confirmDelete(id) {
    setDeletingId(id);
    setError('');
    try {
      await api.delete(`/admin/users/${id}`);
      setDeleteConfirmId(null);
      loadUsers();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete user'));
    } finally {
      setDeletingId(null);
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const displayedUsers = (showArchived ? users.filter((u) => u.archivedAt) : users)
    .filter((u) => roleFilter === 'ALL' || u.role === roleFilter)
    .filter((u) => subscriptionFilter === 'ALL' || subscriptionStatus(u.subscriptionStartsAt, u.subscriptionEndsAt).label === subscriptionFilter)
    .filter(
      (u) =>
        !searchTerm ||
        u.name.toLowerCase().includes(searchTerm) ||
        u.email.toLowerCase().includes(searchTerm) ||
        (u.mobile || '').toLowerCase().includes(searchTerm)
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients &amp; Trainers</h1>
          <p className="text-sm text-gray-500">Manage accounts and their diet plans.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowAddForm((s) => !s)}>
          {showAddForm ? 'Cancel' : '+ Add Account'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      {createdInfo && (
        <div className="rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-sm px-3 py-2">
          {createdInfo}
        </div>
      )}

      {showAddForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">Add a new account</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                required
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="USER">Client</option>
                <option value="ADMIN">Trainer</option>
              </select>
            </div>
            <div>
              <label className="label">Mobile</label>
              <input
                className="input"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="+15551234567"
              />
            </div>
            <div>
              <label className="label">Height (cm)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={form.heightCm}
                onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input
                type="date"
                className="input"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Initial password (optional)</label>
              <input
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Leave blank to auto-generate"
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Name, email, or mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">All roles</option>
            <option value="USER">Client</option>
            <option value="ADMIN">Trainer</option>
          </select>
        </div>
        <div>
          <label className="label">Subscription</label>
          <select className="input" value={subscriptionFilter} onChange={(e) => setSubscriptionFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="Active">Active</option>
            <option value="Subscription ends">Subscription ends</option>
            <option value="Not yet purchased">Not yet purchased</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 py-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived accounts only
        </label>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : displayedUsers.length === 0 ? (
          <p className="text-sm text-gray-500">
            {users.length === 0
              ? 'No accounts yet. Add your first one above.'
              : showArchived
                ? 'No archived accounts match these filters.'
                : 'No accounts match these filters.'}
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Mobile</th>
                <th className="py-2 pr-4">Height</th>
                <th className="py-2 pr-4">Age</th>
                <th className="py-2 pr-4">Latest Weight</th>
                <th className="py-2 pr-4">Last Updated</th>
                <th className="py-2 pr-4">Subscription</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.map((c) => (
                <tr key={c.id} className={`border-b border-gray-100 last:border-0 ${c.archivedAt ? 'opacity-50' : ''}`}>
                  <td className="py-2 pr-4 font-medium">
                    {c.name}
                    {c.archivedAt && <span className="ml-2 text-xs text-gray-400">(archived)</span>}
                  </td>
                  <td className="py-2 pr-4">{c.email}</td>
                  <td className="py-2 pr-4">{c.role === 'ADMIN' ? 'Trainer' : 'Client'}</td>
                  <td className="py-2 pr-4">{c.mobile || '-'}</td>
                  <td className="py-2 pr-4">{c.heightCm ? `${c.heightCm} cm` : '-'}</td>
                  <td className="py-2 pr-4">{calculateAge(c.dateOfBirth) ?? '-'}</td>
                  <td className="py-2 pr-4">{c.latestWeightKg ? `${c.latestWeightKg} kg` : '-'}</td>
                  <td className="py-2 pr-4">
                    {c.latestWeightAt ? new Date(c.latestWeightAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={subscriptionStatus(c.subscriptionStartsAt, c.subscriptionEndsAt).className}>
                      {subscriptionStatus(c.subscriptionStartsAt, c.subscriptionEndsAt).label}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/admin/clients/${c.id}`} className="btn-secondary py-1 px-2 text-xs">
                        View
                      </Link>
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2 text-xs"
                        disabled={archivingId === c.id}
                        onClick={() => toggleArchive(c)}
                      >
                        {archivingId === c.id ? '...' : c.archivedAt ? 'Unarchive' : 'Archive'}
                      </button>
                      {deleteConfirmId === c.id ? (
                        <>
                          <button
                            type="button"
                            className="btn-danger py-1 px-2 text-xs"
                            disabled={deletingId === c.id}
                            onClick={() => confirmDelete(c.id)}
                          >
                            {deletingId === c.id ? 'Deleting...' : 'Confirm delete'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary py-1 px-2 text-xs"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-danger py-1 px-2 text-xs"
                          onClick={() => setDeleteConfirmId(c.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
