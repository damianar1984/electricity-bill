import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMicrosoftLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email',
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Stromabrechnung
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Bitte melden Sie sich mit Ihrem Microsoft-Konto an
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleMicrosoftLogin}
          disabled={loading}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
        >
          {loading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Wird geladen...
            </div>
          ) : (
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 2.75a.75.75 0 01.75-.75h10a.75.75 0 01.75.75v10a.75.75 0 01-.75.75h-10a.75.75 0 01-.75-.75v-10zm-8 0a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-.75.75h-4a.75.75 0 01-.75-.75v-4zm0 8a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-.75.75h-4a.75.75 0 01-.75-.75v-4zm8 0a.75.75 0 01.75-.75h4a.75.75 0 01.75.75v4a.75.75 0 01-.75.75h-4a.75.75 0 01-.75-.75v-4z" />
              </svg>
              Mit Microsoft anmelden
            </div>
          )}
        </button>
      </div>
    </div>
  );
}