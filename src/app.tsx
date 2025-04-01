import { useState, useEffect } from 'preact/hooks';
import './index.css';
import { ZaehlerstandErfassen } from './components/ZaehlerstandErfassen';
import { CreateTenantModal } from './components/CreateTenantModal';
import { Abrechnungshistorie } from './components/Abrechnungshistorie';
import { Verbrauchsanalyse } from './components/Verbrauchsanalyse';
import { Auth } from './components/Auth';
import { motion } from 'framer-motion';
import { supabase } from './lib/supabase';

export function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('zaehlerstand');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const checkAuthAndAuthorization = async () => {
      try {
        console.log('Checking authentication...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setLoading(false);
          return;
        }

        const userEmail = session.user.email || session.user.id;
        const userUuid = session.user.id;
        setUserId(userEmail);
        setUserUuid(userUuid);
        localStorage.setItem('userId', userEmail);

        const response = await fetch(
          'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/check-authorization',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: userEmail, userUuid }),
          }
        );

        if (!response.ok) {
          throw new Error(`Authorization check failed: ${response.status}`);
        }

        const result = await response.json();
        setIsAuthorized(result.authorized === true);
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndAuthorization();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        setUserId(session.user.email || session.user.id);
        setUserUuid(session.user.id);
        setLoading(true);
        checkAuthAndAuthorization();
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        setUserUuid(null);
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    const handleBeforeUnload = () => {
      supabase.auth.signOut().catch((err) => console.error('Error during sign out on unload:', err));
      localStorage.removeItem('userId');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('userId');
      setUserId(null);
      setUserUuid(null);
      setIsAuthorized(false);
      setIsUserMenuOpen(false);
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-600"></div>
      </div>
    );
  }

  if (!userId) return <Auth />;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-500 text-xl font-semibold">Zugriff verweigert</div>
      </div>
    );
  }

  // Verwendung von userUuid, um TS6133 zu beheben
  console.log('Current user UUID:', userUuid);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-lg bg-gray-700"></div>
              <span className="ml-3 text-xl font-semibold text-gray-900">Stromabrechnung</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 hover:shadow-md transition-all duration-200"
              >
                Mieter anlegen
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center focus:ring-2 focus:ring-gray-300"
                >
                  <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-gray-200"
                  >
                    <div className="px-4 py-2 text-sm text-gray-600 border-b border-gray-200">{userId}</div>
                    <button
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100"
                    >
                      Abmelden
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex space-x-4">
            {['zaehlerstand', 'historie', 'analyse'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex-1 px-4 py-2 text-base font-medium transition-colors ${
                  activeTab === tab ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                {tab === 'zaehlerstand'
                  ? 'Zählerstand erfassen'
                  : tab === 'historie'
                  ? 'Abrechnungshistorie'
                  : 'Verbrauchsanalyse'}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm"
          >
            {activeTab === 'zaehlerstand' && <ZaehlerstandErfassen />}
            {activeTab === 'historie' && <Abrechnungshistorie />}
            {activeTab === 'analyse' && <Verbrauchsanalyse />}
          </motion.div>
        </div>
      </main>

      <CreateTenantModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}