import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import WeightChart from '../components/WeightChart';

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

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

const ROUTINE_FIELDS = [
  { key: 'wakeUpTime', label: 'Wake up' },
  { key: 'breakfastTime', label: 'Breakfast' },
  { key: 'lunchTime', label: 'Lunch' },
  { key: 'eveningTeaTime', label: 'Evening tea' },
  { key: 'dinnerTime', label: 'Dinner' },
  { key: 'sleepTime', label: 'Sleep' },
];

const EMPTY_ROUTINE = {
  bloodGroup: '',
  wakeUpTime: '',
  breakfastTime: '',
  lunchTime: '',
  eveningTeaTime: '',
  dinnerTime: '',
  sleepTime: '',
};

function newMealKey() {
  return Math.random().toString(36).slice(2);
}

function newMeal() {
  return { key: newMealKey(), name: '', time: '08:00', description: '' };
}

function mealsFromServer(meals) {
  return (meals || []).map((m) => ({ key: newMealKey(), name: m.name, time: m.time, description: m.description }));
}

// Editable list of {name, time, description} rows, used both for a single
// day and for the bulk-fill template. `meals` items carry a local `key` for
// stable React keys (server ids don't exist yet for new rows).
function MealsEditor({ meals, onChange }) {
  function updateMeal(key, field, value) {
    onChange(meals.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  }
  function removeMeal(key) {
    onChange(meals.filter((m) => m.key !== key));
  }
  function addMeal() {
    onChange([...meals, newMeal()]);
  }

  return (
    <div className="space-y-2">
      {meals.map((meal) => (
        <div key={meal.key} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_2fr_auto] gap-2 items-start">
          <input
            className="input"
            placeholder="Meal name (e.g. Meal 1)"
            value={meal.name}
            onChange={(e) => updateMeal(meal.key, 'name', e.target.value)}
          />
          <input
            type="time"
            className="input"
            value={meal.time}
            onChange={(e) => updateMeal(meal.key, 'time', e.target.value)}
          />
          <textarea
            className="input"
            rows={1}
            placeholder="What to eat"
            value={meal.description}
            onChange={(e) => updateMeal(meal.key, 'description', e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary py-1 px-2 text-xs"
            onClick={() => removeMeal(meal.key)}
            aria-label="Remove meal"
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={addMeal}>
        + Add meal
      </button>
    </div>
  );
}

export default function AdminClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin-editable profile (includes email, unlike the client's own form)
  const [profile, setProfile] = useState({ name: '', email: '', mobile: '', heightCm: '', dateOfBirth: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // Archive / delete
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  // Diet plan state
  const [month, setMonth] = useState(currentMonthStr());
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [savingDayId, setSavingDayId] = useState(null);
  const [dayDrafts, setDayDrafts] = useState({});

  // Bulk-fill state: apply the same meal list to every day in a date range
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkMeals, setBulkMeals] = useState([newMeal()]);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  // Subscription date range
  const [subscriptionStartsAt, setSubscriptionStartsAt] = useState('');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('');
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');

  // Daily routine
  const [routine, setRoutine] = useState(EMPTY_ROUTINE);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [routineMessage, setRoutineMessage] = useState('');

  // Reset password
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const loadClient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/users/${id}`);
      setClient(res.data);
      setProfile({
        name: res.data.name || '',
        email: res.data.email || '',
        mobile: res.data.mobile || '',
        heightCm: res.data.heightCm ?? '',
        dateOfBirth: res.data.dateOfBirth ? res.data.dateOfBirth.slice(0, 10) : '',
      });
      setSubscriptionStartsAt(res.data.subscriptionStartsAt ? res.data.subscriptionStartsAt.slice(0, 10) : '');
      setSubscriptionEndsAt(res.data.subscriptionEndsAt ? res.data.subscriptionEndsAt.slice(0, 10) : '');
      setRoutine({
        bloodGroup: res.data.bloodGroup || '',
        wakeUpTime: res.data.wakeUpTime || '',
        breakfastTime: res.data.breakfastTime || '',
        lunchTime: res.data.lunchTime || '',
        eveningTeaTime: res.data.eveningTeaTime || '',
        dinnerTime: res.data.dinnerTime || '',
        sleepTime: res.data.sleepTime || '',
      });
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
        drafts[d.id] = { meals: mealsFromServer(d.meals), notes: d.notes || '' };
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

  async function saveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    try {
      const res = await api.put(`/admin/users/${id}/profile`, {
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        heightCm: profile.heightCm === '' ? null : Number(profile.heightCm),
        dateOfBirth: profile.dateOfBirth || null,
      });
      setClient((prev) => ({ ...prev, ...res.data }));
      setProfileMessage('Profile saved.');
    } catch (err) {
      setProfileMessage(errorMessage(err, 'Could not save profile'));
    } finally {
      setProfileSaving(false);
    }
  }

  async function toggleArchive() {
    setArchiving(true);
    try {
      const res = await api.put(`/admin/users/${id}/archive`, { archived: !client.archivedAt });
      setClient((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      setError(errorMessage(err, 'Could not update archive status'));
    } finally {
      setArchiving(false);
    }
  }

  async function deleteClient() {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${id}`);
      navigate('/admin');
    } catch (err) {
      setError(errorMessage(err, 'Could not delete client'));
      setDeleting(false);
    }
  }

  async function saveSubscription(e) {
    e.preventDefault();
    setSubscriptionSaving(true);
    setSubscriptionMessage('');
    try {
      await api.put(`/admin/users/${id}/subscription`, {
        subscriptionStartsAt: subscriptionStartsAt || null,
        subscriptionEndsAt: subscriptionEndsAt || null,
      });
      setSubscriptionMessage('Subscription saved.');
    } catch (err) {
      setSubscriptionMessage(errorMessage(err, 'Could not save subscription'));
    } finally {
      setSubscriptionSaving(false);
    }
  }

  function updateRoutineField(field, value) {
    setRoutine((prev) => ({ ...prev, [field]: value }));
  }

  async function saveRoutine(e) {
    e.preventDefault();
    setRoutineSaving(true);
    setRoutineMessage('');
    try {
      await api.put(`/admin/users/${id}/routine`, routine);
      setRoutineMessage('Daily routine saved.');
    } catch (err) {
      setRoutineMessage(errorMessage(err, 'Could not save daily routine'));
    } finally {
      setRoutineSaving(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setResetMessage('');
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setResetMessage('Password must be at least 8 characters.');
      return;
    }
    setResetSaving(true);
    try {
      await api.post(`/admin/users/${id}/reset-password`, { newPassword: resetPasswordValue });
      setResetMessage('Password reset successfully.');
      setResetPasswordValue('');
    } catch (err) {
      setResetMessage(errorMessage(err, 'Could not reset password'));
    } finally {
      setResetSaving(false);
    }
  }

  async function createPlanForMonth() {
    setPlanError('');
    try {
      const res = await api.post('/admin/diet-plans', { userId: Number(id), month });
      setPlan(res.data);
      const drafts = {};
      res.data.days.forEach((d) => {
        drafts[d.id] = { meals: mealsFromServer(d.meals), notes: d.notes || '' };
      });
      setDayDrafts(drafts);
    } catch (err) {
      setPlanError(errorMessage(err, 'Could not create diet plan'));
    }
  }

  function updateDayMeals(dayId, meals) {
    setDayDrafts((prev) => ({ ...prev, [dayId]: { ...prev[dayId], meals } }));
  }

  function updateDayNotes(dayId, notes) {
    setDayDrafts((prev) => ({ ...prev, [dayId]: { ...prev[dayId], notes } }));
  }

  async function applyBulkFill(e) {
    e.preventDefault();
    setBulkMessage('');
    if (!bulkFrom || !bulkTo) {
      setBulkMessage('Pick both a from and to date.');
      return;
    }
    setBulkSaving(true);
    try {
      const res = await api.put(`/admin/diet-plans/${plan.id}/days/bulk-fill`, {
        fromDate: bulkFrom,
        toDate: bulkTo,
        meals: bulkMeals.map(({ name, time, description }) => ({ name, time, description })),
        notes: bulkNotes,
      });
      setBulkMessage(`Applied to ${res.data.updatedCount} day(s).`);
      await loadPlan();
    } catch (err) {
      setBulkMessage(errorMessage(err, 'Could not apply bulk fill'));
    } finally {
      setBulkSaving(false);
    }
  }

  async function saveDay(dayId) {
    setSavingDayId(dayId);
    try {
      const draft = dayDrafts[dayId];
      await api.put(`/admin/diet-plans/${plan.id}/days/${dayId}`, {
        meals: draft.meals.map(({ name, time, description }) => ({ name, time, description })),
        notes: draft.notes,
      });
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin" className="text-sm text-brand-600 hover:underline">
            &larr; Back to clients
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            {client.name}
            {client.archivedAt && <span className="ml-2 text-sm font-normal text-gray-400">(archived)</span>}
          </h1>
          <p className="text-sm text-gray-500">{client.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" disabled={archiving} onClick={toggleArchive}>
            {archiving ? 'Saving...' : client.archivedAt ? 'Unarchive' : 'Archive'}
          </button>
          {deleteConfirming ? (
            <>
              <button type="button" className="btn-danger" disabled={deleting} onClick={deleteClient}>
                {deleting ? 'Deleting...' : 'Confirm delete'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn-danger" onClick={() => setDeleteConfirming(true)}>
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input
                className="input"
                value={profile.mobile}
                onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Height (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={profile.heightCm}
                  onChange={(e) => setProfile({ ...profile, heightCm: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <input
                  type="date"
                  className="input"
                  value={profile.dateOfBirth}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Age: {calculateAge(profile.dateOfBirth) ?? '-'}
              {latest && ` · Latest weight: ${latest.weightKg} kg (${new Date(latest.loggedAt).toLocaleDateString()})`}
            </p>
            <button type="submit" className="btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save'}
            </button>
            {profileMessage && <p className="text-xs text-gray-600">{profileMessage}</p>}
          </form>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Subscription</h2>
          <form onSubmit={saveSubscription} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Start date</label>
                <input
                  type="date"
                  className="input"
                  value={subscriptionStartsAt}
                  onChange={(e) => setSubscriptionStartsAt(e.target.value)}
                />
              </div>
              <div>
                <label className="label">End date</label>
                <input
                  type="date"
                  className="input"
                  value={subscriptionEndsAt}
                  onChange={(e) => setSubscriptionEndsAt(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {(() => {
                if (!subscriptionStartsAt && !subscriptionEndsAt) {
                  return 'Not yet purchased. No dates set.';
                }
                const today = new Date(new Date().toDateString());
                if (subscriptionStartsAt && today < new Date(`${subscriptionStartsAt}T00:00:00.000Z`)) {
                  return 'Not yet purchased. Starts on the date above.';
                }
                if (subscriptionEndsAt && today > new Date(`${subscriptionEndsAt}T00:00:00.000Z`)) {
                  return 'Subscription ends. Ended on the date above.';
                }
                return 'Active.';
              })()}
            </p>
            <div className="flex items-center gap-2">
              <button type="submit" className="btn-primary" disabled={subscriptionSaving}>
                {subscriptionSaving ? 'Saving...' : 'Save'}
              </button>
              {(subscriptionStartsAt || subscriptionEndsAt) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSubscriptionStartsAt('');
                    setSubscriptionEndsAt('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {subscriptionMessage && <p className="text-xs text-gray-600">{subscriptionMessage}</p>}
          </form>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Daily routine</h2>
        <form onSubmit={saveRoutine} className="space-y-3">
          <div>
            <label className="label">Blood group</label>
            <input
              className="input max-w-[160px]"
              placeholder="e.g. O+"
              value={routine.bloodGroup}
              onChange={(e) => updateRoutineField('bloodGroup', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ROUTINE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  type="time"
                  className="input"
                  value={routine[key]}
                  onChange={(e) => updateRoutineField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={routineSaving}>
            {routineSaving ? 'Saving...' : 'Save'}
          </button>
          {routineMessage && <p className="text-xs text-gray-600">{routineMessage}</p>}
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Reset password</h2>
        <form onSubmit={submitReset} className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="label">New password</label>
            <input
              type="text"
              className="input"
              placeholder="At least 8 characters"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={resetSaving}>
            {resetSaving ? 'Saving...' : 'Reset password'}
          </button>
        </form>
        {resetMessage && <p className="text-xs text-gray-600 mt-2">{resetMessage}</p>}
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
          <>
            <form onSubmit={applyBulkFill} className="border border-gray-200 rounded-md p-3 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-2">Fill a date range at once</p>
              <p className="text-xs text-gray-500 mb-3">
                Build the meal list once (name each meal freely, e.g. "Meal 1", "Meal 2" &mdash; add as many as this
                client needs, with their own timing) and apply it to every day in a date range, instead of entering
                each day one by one.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="label">From date</label>
                  <input
                    type="date"
                    className="input"
                    value={bulkFrom}
                    onChange={(e) => setBulkFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">To date</label>
                  <input type="date" className="input" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} />
                </div>
              </div>
              <label className="label">Meals</label>
              <MealsEditor meals={bulkMeals} onChange={setBulkMeals} />
              <div className="mt-3">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary mt-3" disabled={bulkSaving}>
                {bulkSaving ? 'Applying...' : 'Apply to date range'}
              </button>
              {bulkMessage && <p className="text-xs text-gray-600 mt-2">{bulkMessage}</p>}
            </form>

            <div className="space-y-4">
              {plan.days.map((day) => {
                const draft = dayDrafts[day.id] || { meals: [], notes: '' };
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
                    <MealsEditor meals={draft.meals} onChange={(meals) => updateDayMeals(day.id, meals)} />
                    <div className="mt-2">
                      <label className="label">Notes</label>
                      <textarea
                        className="input"
                        rows={1}
                        value={draft.notes}
                        onChange={(e) => updateDayNotes(day.id, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
