import { useEffect, useState } from 'preact/hooks';

interface MieterAntwort {
  mieter: string[];
}

export function ZaehlerstandErfassen() {
  const [mieter, setMieter] = useState<string[]>([]);
  const [ladevorgang, setLadevorgang] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ausgewaehlterMieter, setAusgewaehlterMieter] = useState<string>('');

  useEffect(() => {
    holeMieter();
  }, []);

  async function holeMieter() {
    try {
      setLadevorgang(true);
      setFehler(null);

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) {
        throw new Error('Supabase Anonymous-Key ist nicht definiert. Bitte überprüfen Sie Ihre Umgebungsvariablen.');
      }

      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-tenant-sheet',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP-Fehler ${response.status}: ${errorText}`);
      }

      const data: MieterAntwort = await response.json();

      if (!data?.mieter || !Array.isArray(data.mieter)) {
        console.error('Unerwartetes Antwortformat:', data);
        throw new Error('Keine gültigen Mieterdaten in der Antwort erhalten.');
      }

      setMieter(data.mieter);
    } catch (error: any) {
      console.error('Fehler beim Laden der Mieter:', error.message);
      setFehler(`Die Mieterdaten konnten nicht geladen werden: ${error.message}`);
    } finally {
      setLadevorgang(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl">
      <div className="mb-4">
        <label
          htmlFor="mieter"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          Mieter auswählen
        </label>
        {ladevorgang ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-gray-300 border-t-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Lade Mieter...</span>
          </div>
        ) : fehler ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            <div className="flex items-center">
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {fehler}
            </div>
            <button
              onClick={() => holeMieter()}
              className="mt-3 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Erneut versuchen
            </button>
          </div>
        ) : (
          <select
            id="mieter"
            value={ausgewaehlterMieter}
            onChange={(e) => setAusgewaehlterMieter((e.target as HTMLSelectElement).value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Bitte wählen Sie einen Mieter</option>
            {mieter.map((mieterName, index) => (
              <option key={index} value={mieterName}>
                {mieterName}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}