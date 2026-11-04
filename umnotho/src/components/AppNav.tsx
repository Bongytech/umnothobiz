import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Page = 'barter' | 'my-bids' | 'pricing' | 'profile';

const LINKS: { page: Page; label: string; path: string }[] = [
  { page: 'barter', label: 'Market', path: '/barter' },
  { page: 'my-bids', label: 'My Bids', path: '/my-bids' },
  { page: 'pricing', label: 'Pricing', path: '/pricing' },
  { page: 'profile', label: 'Profile', path: '/profile' },
];

export default function AppNav({ active }: { active?: Page }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Could not sign out:', error);
    }
  };

  return (
    <nav className="h-20 flex justify-between items-center px-6 md:px-12 border-b border-white/5 bg-dark-950/80 backdrop-blur-md sticky top-0 z-40">
      <button
        type="button"
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => navigate('/')}
        aria-label="Go to the Umnotho home page"
      >
        <span className="w-8 h-8 rounded-full bg-umnotho flex items-center justify-center text-dark-950 font-bold text-xl">
          U
        </span>
        <span className="text-xl font-display font-bold text-white tracking-tight hidden sm:block">
          Umnotho
        </span>
      </button>

      <div className="flex items-center gap-1 sm:gap-2">
        {LINKS.map((link) => (
          <button
            key={link.page}
            type="button"
            onClick={() => navigate(link.path)}
            className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
              active === link.page
                ? 'text-umnotho bg-umnotho/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {link.label}
          </button>
        ))}

        <span className="hidden lg:block text-sm text-gray-500 mx-2 max-w-40 truncate">
          {user?.displayName || user?.email}
        </span>

        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm font-medium text-red-400 hover:text-red-300 transition-colors ml-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="text-sm font-medium px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all ml-2"
          >
            Log in
          </button>
        )}
      </div>
    </nav>
  );
}
