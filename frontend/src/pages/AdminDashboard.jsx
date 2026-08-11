import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';

const emptyForm = { name: '', email: '', mobile: '', heightCm: '', age: '', password: '' };

function subscriptionStatus(subscriptionEndsAt) {
  if (!subscriptionEndsAt) return { label: 'Not set', className: 'text-gray-500' };
  const endsAt = new Date(subscriptionEndsAt);
  const isActive = endsAt >= new Date(new Date().toDateString());
  return {
    label: `${isActive ? 'Active' : 'Expired'} (${endsAt.toLocaleDateString()})`,
    className: isActive ? 'text-green-700' : 'text-red-700',
  };
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState('');

  const [resettingId, setResettingId] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load clients'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setCreatedInfo('');
    try {
      const res = await api.post('/admin/users', {
        ...form,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        age: form.age ? Number(form.age) : undefined,
        password: form.password || undefined,
      });
      setForm(emptyForm);
      setShowAddForm(false);
      if (res.data.tempPassword) {
        setCreatedInfo(
          `Client "${res.data.user.name}" created. Temporary password: ${res.data.tempPassword} (share this with them securely).`
        );
      } else {
        setCreatedInfo(`Client "${res.data.user.name}" created.`);
      }
      loadUsers();
    } catch (err) {
      setError(errorMessage(err, 'Could not create client'));
    } finally {
      setCreating(false);
    }
  }

  function startReset(id) {
    setResettingId(id);
    setResetPasswordValue('');
    setResetMessage('');
  }

  async function submitReset(id) {
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setResetMessage('Password must be at least 8 characters.');
      return;
    }
    try {
      await api.post(`/admin/users/${id}/reset-password`, { newPassword: resetPasswordValue });
      setResetMessage('Password reset successfully.');
      setTimeout(() => setResettingId(null), 1200);
    } catch (err) {
      setResetMessage(errorMessage(err, 'Could not reset password'));
    }
  }

  const clients = users.filter((u) => u.role !== 'ADMIN');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-gray-500">Manage your clients and their diet plans.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowAddForm((s) => !s)}>
          {showAddForm ? 'Cancel' : '+ Add Client'}
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
          <h2 className="font-semibold mb-4">Add a new client</h2>
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
              <label className="label">Age</label>
              <input
                type="number"
                className="input"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
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
                {creating ? 'Creating...' : 'Create client'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-gray-500">No clients yet. Add your first client above.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
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
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-4">{c.email}</td>
                  <td className="py-2 pr-4">{c.mobile || '-'}</td>
                  <td className="py-2 pr-4">{c.heightCm ? `${c.heightCm} cm` : '-'}</td>
                  <td className="py-2 pr-4">{c.age ?? '-'}</td>
                  <td className="py-2 pr-4">{c.latestWeightKg ? `${c.latestWeightKg} kg` : '-'}</td>
                  <td className="py-2 pr-4">
                    {c.latestWeightAt ? new Date(c.latestWeightAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={subscriptionStatus(c.subscriptionEndsAt).className}>
                      {subscriptionStatus(c.subscriptionEndsAt).label}
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
                        onClick={() => startReset(c.id)}
                      >
                        Reset Password
                      </button>
                    </div>
                    {resettingId === c.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="New password"
                          className="input text-xs py-1"
                          value={resetPasswordValue}
                          onChange={(e) => setResetPasswordValue(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-primary py-1 px-2 text-xs"
                          onClick={() => submitReset(c.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-secondary py-1 px-2 text-xs"
                          onClick={() => setResettingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {resettingId === c.id && resetMessage && (
                      <p className="text-xs mt-1 text-gray-600">{resetMessage}</p>
                    )}
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
