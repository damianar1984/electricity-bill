import { useEffect, useState } from 'preact/hooks';

interface ConsumptionData {
  mieter: string;
  datum: string;
  status: string;
  verbrauch: number;
  gesamtbetrag: number;
}

export function Verbrauchsanalyse() {
  const [data, setData] = useState<ConsumptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    mieter: '',
    status: '',
    datumVon: '',
    datumBis: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-last-data-sheet',
        {
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Verbrauchsdaten');
      }

      const responseData = await response.json();
      setData(responseData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter(item => {
    return (
      (!filters.mieter || item.mieter.includes(filters.mieter)) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.datumVon || new Date(item.datum) >= new Date(filters.datumVon)) &&
      (!filters.datumBis || new Date(item.datum) <= new Date(filters.datumBis))
    );
  });

  return (
    <div className="space-y-6 rounded-xl bg-white p-6 shadow-lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mieter</label>
          <input
            type="text"
            value={filters.mieter}
            onChange={(e) => setFilters({...filters, mieter: (e.target as HTMLInputElement).value})}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            placeholder="Mieter filtern..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: (e.target as HTMLSelectElement).value})}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Alle</option>
            <option value="offen">Offen</option>
            <option value="bezahlt">Bezahlt</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Von</label>
          <input
            type="date"
            value={filters.datumVon}
            onChange={(e) => setFilters({...filters, datumVon: (e.target as HTMLInputElement).value})}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Bis</label>
          <input
            type="date"
            value={filters.datumBis}
            onChange={(e) => setFilters({...filters, datumBis: (e.target as HTMLInputElement).value})}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-600">Lade Verbrauchsdaten...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 rounded bg-red-100 px-4 py-2 text-red-700 hover:bg-red-200"
          >
            Erneut versuchen
          </button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Mieter</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Datum</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Verbrauch</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Gesamtbetrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{item.mieter}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{item.datum}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      item.status === 'bezahlt' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{item.verbrauch} kWh</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{item.gesamtbetrag} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}