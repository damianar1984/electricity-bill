import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Initial session check:', session);
      if (session) {
        localStorage.setItem('userId', session.user.email || session.user.id);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };
    checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('userId', session.user.email || session.user.id);
        setIsAuthenticated(true);
        setLoading(false);
        window.history.replaceState({}, document.title, '/');
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const handleMicrosoftLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Starting Microsoft login...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid offline_access',
          redirectTo: 'http://localhost:5200/',
          // prompt: 'login' wird vorerst entfernt, um den Basis-Flow zu testen
        },
      });

      if (error) throw error;
      console.log('OAuth response:', data);
    } catch (err: any) {
      console.error('Fehler beim Microsoft-Login:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      await supabase.auth.signOut();
      localStorage.removeItem('userId');
      setIsAuthenticated(false);
      window.location.href = '/';
    } catch (err: any) {
      console.error('Fehler beim Abmelden:', err);
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-6 bg-white border border-gray-200 p-4 rounded-lg shadow-sm text-gray-900">
        <div className="text-center">
          <h2 className="mt-4 text-2xl font-semibold text-gray-900">
            Stromabrechnung
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Bitte melden Sie sich mit Ihrem Microsoft-Konto an
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {isAuthenticated ? (
          <div className="text-center space-y-4">
            <p className="text-green-600">Erfolgreich angemeldet!</p>
            <p className="mt-2">
              Sie können jetzt die Anwendung nutzen.{' '}
              <a href="/dashboard" className="text-blue-600 hover:underline">
                Zum Dashboard
              </a>
            </p>
            <button
              onClick={handleLogout}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 transition-all duration-200"
            >
              Abmelden
            </button>
          </div>
        ) : (
          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-700 hover:bg-gray-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Wird geladen...
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.5 2.75a.75.75 0 01.75-.75h10a.75.75 0 01.75.75v10a.75.75 0 01-.75.75h-10a.75.75 0 01-.75-.75v-10zm-8 0a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-.75.75h-4a.75.75 0 01-.75-.75v-4zm0 8a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-.75.75h-4a.75.75 0 01-.75-.75v-4zm8 0a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-.75.75h-4a.75.75 0 01-.75-.75v-4z" />
                </svg>
                Mit Microsoft anmelden
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}