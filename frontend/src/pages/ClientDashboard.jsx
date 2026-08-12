import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/client';
import WeightChart from '../components/WeightChart';
import VeggieBackground from '../components/VeggieBackground';
import { useAuth } from '../context/AuthContext';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr, opts) {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString(undefined, opts);
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

export default function ClientDashboard() {
  const { user, updateUser } = useAuth();

  const [today, setToday] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    mobile: '',
    heightCm: '',
    dateOfBirth: '',
    bloodGroup: '',
    wakeUpTime: '',
    breakfastTime: '',
    lunchTime: '',
    eveningTeaTime: '',
    dinnerTime: '',
    sleepTime: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [weightLogs, setWeightLogs] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState('');

  const [viewMode, setViewMode] = useState('window'); // 'window' | 'custom'
  const [centerDate, setCenterDate] = useState(todayStr());
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [rangeDays, setRangeDays] = useState([]);
  const [rangeLoading, setRangeLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await api.get('/users/me');
    setProfile({
      name: res.data.name || '',
      email: res.data.email || '',
      mobile: res.data.mobile || '',
      heightCm: res.data.heightCm ?? '',
      dateOfBirth: res.data.dateOfBirth ? res.data.dateOfBirth.slice(0, 10) : '',
      bloodGroup: res.data.bloodGroup || '',
      wakeUpTime: res.data.wakeUpTime || '',
      breakfastTime: res.data.breakfastTime || '',
      lunchTime: res.data.lunchTime || '',
      eveningTeaTime: res.data.eveningTeaTime || '',
      dinnerTime: res.data.dinnerTime || '',
      sleepTime: res.data.sleepTime || '',
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

  const loadRange = useCallback(async () => {
    const from = viewMode === 'custom' ? customFrom : addDaysStr(centerDate, -1);
    const to = viewMode === 'custom' ? customTo : addDaysStr(centerDate, 1);
    if (viewMode === 'custom' && (!customFrom || !customTo)) return;

    setRangeLoading(true);
    try {
      const res = await api.get('/users/me/diet-plan/range', { params: { from, to } });
      setRangeDays(res.data.days);
    } catch (err) {
      console.error(err);
    } finally {
      setRangeLoading(false);
    }
  }, [viewMode, centerDate, customFrom, customTo]);

  useEffect(() => {
    loadProfile();
    loadToday();
    loadWeightHistory();
  }, [loadProfile, loadToday, loadWeightHistory]);

  useEffect(() => {
    loadRange();
  }, [loadRange]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const res = await api.put('/users/me', {
        name: profile.name,
        mobile: profile.mobile,
        heightCm: profile.heightCm === '' ? null : Number(profile.heightCm),
        dateOfBirth: profile.dateOfBirth || null,
        bloodGroup: profile.bloodGroup,
        wakeUpTime: profile.wakeUpTime,
        breakfastTime: profile.breakfastTime,
        lunchTime: profile.lunchTime,
        eveningTeaTime: profile.eveningTeaTime,
        dinnerTime: profile.dinnerTime,
        sleepTime: profile.sleepTime,
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
    <div className="space-y-6 relative">
      <VeggieBackground />
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
              <input type="email" className="input bg-gray-100 text-gray-500" value={profile.email} disabled />
              <p className="text-xs text-gray-500 mt-1">Contact your trainer to change your email address.</p>
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
            <p className="text-xs text-gray-500">Age: {calculateAge(profile.dateOfBirth) ?? '-'}</p>
            <div>
              <label className="label">Blood group</label>
              <input
                className="input max-w-[160px]"
                placeholder="e.g. O+"
                value={profile.bloodGroup}
                onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
              />
            </div>
            <div>
              <p className="label mb-2">Daily routine</p>
              <div className="grid grid-cols-2 gap-3">
                {ROUTINE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      type="time"
                      className="input"
                      value={profile[key]}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    />
                  </div>
                ))}
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
          <h2 className="font-semibold">Diet plan</h2>
          <button
            type="button"
            className="btn-secondary py-1 px-2 text-xs"
            onClick={() => {
              if (viewMode === 'custom') {
                setViewMode('window');
              } else {
                setCustomFrom(centerDate);
                setCustomTo(centerDate);
                setViewMode('custom');
              }
            }}
          >
            {viewMode === 'custom' ? 'Back to 3-day view' : 'Custom date range'}
          </button>
        </div>

        {viewMode === 'window' ? (
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              type="button"
              className="btn-secondary py-1 px-3"
              aria-label="Previous day"
              onClick={() => setCenterDate((d) => addDaysStr(d, -1))}
            >
              &larr;
            </button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {formatDateLabel(addDaysStr(centerDate, -1), { month: 'short', day: 'numeric' })}
              {' – '}
              {formatDateLabel(addDaysStr(centerDate, 1), { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              type="button"
              className="btn-secondary py-1 px-3"
              aria-label="Next day"
              onClick={() => setCenterDate((d) => addDaysStr(d, 1))}
            >
              &rarr;
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-3 mb-4 flex-wrap">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {rangeLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-3">
            {(viewMode === 'window'
              ? [addDaysStr(centerDate, -1), centerDate, addDaysStr(centerDate, 1)]
              : rangeDays.map((d) => d.date.slice(0, 10))
            ).map((dateStr) => {
              const day = rangeDays.find((d) => d.date.slice(0, 10) === dateStr);
              return (
                <div key={dateStr} className="border border-gray-200 rounded-md p-3">
                  <p className="font-medium text-sm mb-2">
                    {formatDateLabel(dateStr, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {dateStr === todayStr() && <span className="ml-2 text-xs text-brand-600">Today</span>}
                  </p>
                  {!day || day.meals.length === 0 ? (
                    <p className="text-sm text-gray-500">No plan set for this day.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {day.meals.map((meal) => (
                        <li key={meal.id}>
                          <span className="text-gray-500">
                            {meal.time} {meal.name}:
                          </span>{' '}
                          {meal.description || '-'}
                        </li>
                      ))}
                    </ul>
                  )}
                  {day?.notes && (
                    <p className="text-sm mt-2">
                      <span className="text-gray-500">Notes:</span> {day.notes}
                    </p>
                  )}
                </div>
              );
            })}
            {viewMode === 'custom' && rangeDays.length === 0 && (
              <p className="text-sm text-gray-500">No diet plan entries in this range.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
