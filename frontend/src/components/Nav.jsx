import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Nav() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-600">DietTrack</span>
        </Link>

        {isAuthenticated && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:inline">
              {user.name} <span className="text-gray-400">({user.role === 'ADMIN' ? 'Trainer' : 'Client'})</span>
            </span>
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
