import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import WeightChart from '../components/WeightChart';

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

const MEAL_FIELDS = ['breakfast', 'lunch', 'dinner', 'snacks', 'notes'];

export default function AdminClientDetail() {
  const { id } = useParams();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Notify settings form state
  const [notifyTime, setNotifyTime] = useState('08:00');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifySaving, setNotifySaving] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');

  // Diet plan state
  const [month, setMonth] = useState(currentMonthStr());
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [savingDayId, setSavingDayId] = useState(null);
  const [dayDrafts, setDayDrafts] = useState({});

  const loadClient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/users/${id}`);
      setClient(res.data);
      setNotifyTime(res.data.notifyTime || '08:00');
      setNotifyEmail(!!res.data.notifyEmail);
      setNotifyWhatsapp(!!res.data.notifyWhatsapp);
    } catch (err) {
      setError(errorMessage(err, 'Could not load client'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadPlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError('');
    try {
      const res = await api.get(`/admin/diet-plans/${id}`, { params: { month } });
      const loadedPlan = res.data && res.data.id ? res.data : null;
      setPlan(loadedPlan);
      const drafts = {};
      (loadedPlan?.days || []).forEach((d) => {
        drafts[d.id] = { breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner, snacks: d.snacks, notes: d.notes || '' };
      });
      setDayDrafts(drafts);
    } catch (err) {
      setPlanError(errorMessage(err, 'Could not load diet plan'));
    } finally {
      setPlanLoading(false);
    }
  }, [id, month]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  async function saveNotifySettings(e) {
    e.preventDefault();
    setNotifySaving(true);
    setNotifyMessage('');
    try {
      await api.put(`/admin/users/${id}/notify-settings`, { notifyTime, notifyEmail, notifyWhatsapp });
      setNotifyMessage('Notification settings saved.');
    } catch (err) {
      setNotifyMessage(errorMessage(err, 'Could not save settings'));
    } finally {
      setNotifySaving(false);
    }
  }

  async function createPlanForMonth() {
    setPlanError('');
    try {
      const res = await api.post('/admin/diet-plans', { userId: Number(id), month });
      setPlan(res.data);
      const drafts = {};
      res.data.days.forEach((d) => {
        drafts[d.id] = { breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner, snacks: d.snacks, notes: d.notes || '' };
      });
      setDayDrafts(drafts);
    } catch (err) {
      setPlanError(errorMessage(err, 'Could not create diet plan'));
    }
  }

  function updateDraft(dayId, field, value) {
    setDayDrafts((prev) => ({ ...prev, [dayId]: { ...prev[dayId], [field]: value } }));
  }

  async function saveDay(dayId) {
    setSavingDayId(dayId);
    try {
      await api.put(`/admin/diet-plans/${plan.id}/days/${dayId}`, dayDrafts[dayId]);
    } catch (err) {
      setPlanError(errorMessage(err, 'Could not save day'));
    } finally {
      setSavingDayId(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>;
  if (!client) return null;

  const weightLogs = client.weightLogs || [];
  const latest = weightLogs[weightLogs.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin" className="text-sm text-brand-600 hover:underline">
          &larr; Back to clients
        </Link>
        <h1 className="text-2xl font-bold mt-2">{client.name}</h1>
        <p className="text-sm text-gray-500">{client.email}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Profile</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Mobile</dt>
            <dd>{client.mobile || '-'}</dd>
            <dt className="text-gray-500">Height</dt>
            <dd>{client.heightCm ? `${client.heightCm} cm` : '-'}</dd>
            <dt className="text-gray-500">Age</dt>
            <dd>{client.age ?? '-'}</dd>
            <dt className="text-gray-500">Latest weight</dt>
            <dd>{latest ? `${latest.weightKg} kg (${new Date(latest.loggedAt).toLocaleDateString()})` : '-'}</dd>
          </dl>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Notification settings</h2>
          <form onSubmit={saveNotifySettings} className="space-y-3">
            <div>
              <label className="label">Delivery time (server local, HH:mm)</label>
              <input
                type="time"
                className="input"
                value={notifyTime}
                onChange={(e) => setNotifyTime(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyWhatsapp}
                  onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                />
                WhatsApp
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={notifySaving}>
              {notifySaving ? 'Saving...' : 'Save settings'}
            </button>
            {notifyMessage && <p className="text-xs text-gray-600">{notifyMessage}</p>}
          </form>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Weight history</h2>
        <WeightChart logs={weightLogs} />
        {weightLogs.length > 0 && (
          <div className="mt-4 max-h-56 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-1 pr-4">Date</th>
                  <th className="py-1 pr-4">Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {[...weightLogs].reverse().map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-1 pr-4">{new Date(log.loggedAt).toLocaleString()}</td>
                    <td className="py-1 pr-4">{log.weightKg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-semibold">Diet plan editor</h2>
          <div className="flex items-center gap-2">
            <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>

        {planError && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-4">
            {planError}
          </div>
        )}

        {planLoading ? (
          <p className="text-sm text-gray-500">Loading plan...</p>
        ) : !plan ? (
          <div>
            <p className="text-sm text-gray-500 mb-3">No diet plan exists for {month} yet.</p>
            <button type="button" className="btn-primary" onClick={createPlanForMonth}>
              Create plan for {month}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {plan.days.map((day) => {
              const draft = dayDrafts[day.id] || {};
              return (
                <div key={day.id} className="border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {new Date(day.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary py-1 px-2 text-xs"
                      disabled={savingDayId === day.id}
                      onClick={() => saveDay(day.id)}
                    >
                      {savingDayId === day.id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MEAL_FIELDS.map((field) => (
                      <div key={field}>
                        <label className="label capitalize">{field}</label>
                        <textarea
                          className="input"
                          rows={2}
                          value={draft[field] || ''}
                          onChange={(e) => updateDraft(day.id, field, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
