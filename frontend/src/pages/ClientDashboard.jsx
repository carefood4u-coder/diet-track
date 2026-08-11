import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/client';
import WeightChart from '../components/WeightChart';
import { useAuth } from '../context/AuthContext';

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

export default function ClientDashboard() {
  const { user, updateUser } = useAuth();

  const [today, setToday] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  const [profile, setProfile] = useState({ name: '', email: '', mobile: '', heightCm: '', age: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [weightLogs, setWeightLogs] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState('');

  const [month, setMonth] = useState(currentMonthStr());
  const [monthPlan, setMonthPlan] = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await api.get('/users/me');
    setProfile({
      name: res.data.name || '',
      email: res.data.email || '',
      mobile: res.data.mobile || '',
      heightCm: res.data.heightCm ?? '',
      age: res.data.age ?? '',
    });
  }, []);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await api.get('/users/me/diet-plan/today');
      setToday(res.data.day);
    } catch (err) {
      console.error(err);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const loadWeightHistory = useCallback(async () => {
    const res = await api.get('/users/me/weight-history');
    setWeightLogs(res.data);
  }, []);

  const loadMonthPlan = useCallback(async () => {
    setMonthLoading(true);
    try {
      const res = await api.get('/users/me/diet-plan', { params: { month } });
      setMonthPlan(res.data && res.data.id ? res.data : null);
    } catch (err) {
      console.error(err);
    } finally {
      setMonthLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadProfile();
    loadToday();
    loadWeightHistory();
  }, [loadProfile, loadToday, loadWeightHistory]);

  useEffect(() => {
    loadMonthPlan();
  }, [loadMonthPlan]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const res = await api.put('/users/me', {
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        heightCm: profile.heightCm === '' ? null : Number(profile.heightCm),
        age: profile.age === '' ? null : Number(profile.age),
      });
      updateUser({ name: res.data.name, email: res.data.email });
      setProfileMessage('Profile updated.');
    } catch (err) {
      setProfileError(errorMessage(err, 'Could not update profile'));
    } finally {
      setProfileSaving(false);
    }
  }

  async function logWeight(e) {
    e.preventDefault();
    setWeightError('');
    if (!newWeight || Number.isNaN(Number(newWeight))) {
      setWeightError('Enter a valid weight in kg');
      return;
    }
    setWeightSaving(true);
    try {
      await api.post('/users/me/weight', { weightKg: Number(newWeight) });
      setNewWeight('');
      await loadWeightHistory();
    } catch (err) {
      setWeightError(errorMessage(err, 'Could not log weight'));
    } finally {
      setWeightSaving(false);
    }
  }

  const latestWeight = weightLogs[weightLogs.length - 1];

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white px-5 py-6 shadow-sm">
        <h1 className="text-2xl font-bold">Hi {user?.name?.split(' ')[0]} 🥗</h1>
        <p className="text-sm text-brand-50">Here's your plan and progress.</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Today's diet plan</h2>
        {todayLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !today || today.meals.length === 0 ? (
          <p className="text-sm text-gray-500">No diet plan set for today. Check back later or contact your trainer.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {today.meals.map((meal) => (
                <div key={meal.id}>
                  <p className="text-gray-500 font-medium">
                    {meal.time} &middot; {meal.name}
                  </p>
                  <p>{meal.description || '-'}</p>
                </div>
              ))}
            </div>
            {today.notes && (
              <div>
                <p className="text-gray-500 font-medium">Notes</p>
                <p>{today.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Your profile</h2>
          {profileError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">
              {profileError}
            </div>
          )}
          {profileMessage && (
            <div className="rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-sm px-3 py-2 mb-3">
              {profileMessage}
            </div>
          )}
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
                <label className="label">Age</label>
                <input
                  type="number"
                  className="input"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Weight tracking</h2>
          {weightError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">
              {weightError}
            </div>
          )}
          <form onSubmit={logWeight} className="flex items-end gap-2 mb-4">
            <div className="flex-1">
              <label className="label">Log new weight (kg)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder={latestWeight ? String(latestWeight.weightKg) : 'e.g. 78.5'}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={weightSaving}>
              {weightSaving ? 'Logging...' : 'Log'}
            </button>
          </form>
          <WeightChart logs={weightLogs} />
          {weightLogs.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto">
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
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-semibold">Month view</h2>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {monthLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !monthPlan ? (
          <p className="text-sm text-gray-500">No diet plan for {month}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Meals</th>
                  <th className="py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {monthPlan.days.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">
                      {d.meals.length === 0 ? (
                        '-'
                      ) : (
                        <ul className="space-y-1">
                          {d.meals.map((meal) => (
                            <li key={meal.id}>
                              <span className="text-gray-500">
                                {meal.time} {meal.name}:
                              </span>{' '}
                              {meal.description || '-'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2 pr-4">{d.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
