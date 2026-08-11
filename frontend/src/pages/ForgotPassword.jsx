import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api/client';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(
        res.data.devOtp
          ? `${res.data.message} (Dev mode - SMTP not configured, your OTP is: ${res.data.devOtp})`
          : res.data.message
      );
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 1500);
    } catch (err) {
      setError(errorMessage(err, 'Could not send OTP'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">Forgot password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your email and we'll send you a one-time code to reset your password.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-sm px-3 py-2">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>

        <div className="text-sm text-center mt-4 flex justify-between">
          <Link to="/login" className="text-brand-600 hover:underline">
            Back to login
          </Link>
          <Link to="/reset-password" className="text-brand-600 hover:underline">
            I already have a code
          </Link>
        </div>
      </div>
    </div>
  );
}
