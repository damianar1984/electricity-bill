import { useEffect, useState } from 'preact/hooks';

interface HistoryData {
  mieter: string;
  datum: string;
  zaehlerstand: number;
  letzterZaehlerstand: number;
  verbrauch: number;
  betrag: number | null;
  status: string;
  zeitstempelEintragung: string;
  strompreis: number;
  grundpreis: number;
  pdfId: string;
  photoId?: string; // Optional, kann undefined sein
}

export function Abrechnungshistorie() {
  const [data, setData] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMieter, setFilterMieter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [mieterOptions, setMieterOptions] = useState<string[]>([]);
  const [vorschauFoto, setVorschauFoto] = useState<string | null>(null);

  useEffect(() => {
    fetchHistoryData();
  }, []);

  async function fetchHistoryData() {
    try {
      setLoading(true);
      setError(null);

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-tabelle1',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Abrechnungshistorie');
      }

      const rawData = await response.json();
      console.log('Raw Data:', rawData);

      if (!Array.isArray(rawData)) {
        throw new Error('Erwartetes Datenformat ist kein Array');
      }

      // Fehler 1: findLastIndex wird jetzt von ES2023 unterstützt
      const lastEntryIndex = rawData.findLastIndex((row: any[]) => row[0] && row[0].trim() !== '');
      const relevantData = lastEntryIndex >= 0 ? rawData.slice(0, lastEntryIndex + 1) : [];

      const formattedData: HistoryData[] = relevantData
        .filter((row) => row && row.length >= 10)
        .map((row: any[]) => {
          const [
            mieter,
            datum,
            zeitstempelEintragung,
            zaehlerstand,
            letzterZaehlerstand,
            ,
            strompreis,
            grundpreis,
            ,
            status,
            pdfId,
            photoId,
          ] = row;

          const zaehlerstandNum = parseFloat(String(zaehlerstand).replace(',', '.')) || 0;
          const letzterZaehlerstandNum = parseFloat(String(letzterZaehlerstand).replace(',', '.')) || 0;
          const strompreisNum = parseFloat(String(strompreis).replace(',', '.')) || 0;
          const grundpreisNum = parseFloat(String(grundpreis).replace(',', '.')) || 0;
          const verbrauch = zaehlerstandNum - letzterZaehlerstandNum;
          const betrag = status ? verbrauch * strompreisNum + grundpreisNum : null;

          return {
            mieter: mieter || '',
            datum: datum || '',
            zaehlerstand: zaehlerstandNum,
            letzterZaehlerstand: letzterZaehlerstandNum,
            verbrauch,
            betrag,
            status: status || '',
            zeitstempelEintragung: zeitstempelEintragung || '',
            strompreis: strompreisNum,
            grundpreis: grundpreisNum,
            pdfId: pdfId || '',
            photoId: photoId, // Kann undefined sein
          };
        });

      const uniqueMieters = Array.from(new Set(formattedData.map((item) => item.mieter).filter(Boolean)));
      setMieterOptions(uniqueMieters);
      setData(formattedData);
    } catch (err: any) {
      console.error('Fehler:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter((item) => {
    const matchesMieter = !filterMieter || item.mieter === filterMieter;
    const matchesStatus =
      !filterStatus ||
      (filterStatus === 'Eintrag' && !item.status) ||
      (filterStatus === 'Verschickt' && item.status);
    return matchesMieter && matchesStatus;
  });

  const handleDownload = async (item: HistoryData) => {
    if (!item.pdfId) {
      alert('Keine Rechnung verfügbar zum Download');
      return;
    }

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/download-invoice-by-id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pdfId: item.pdfId }),
        }
      );

      if (!response.ok) {
        throw new Error('Fehler beim Abrufen des Download-Links');
      }

      const { downloadUrl } = await response.json();
      if (!downloadUrl) throw new Error('Download-URL nicht gefunden');

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Stromabrechnung_${item.mieter}_${item.datum}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Download Fehler:', err);
      alert(`Fehler beim Herunterladen: ${err.message}`);
    }
  };

  async function zeigeFotoVorschau(photoId: string) {
    if (!photoId) {
      console.log('Keine photoId vorhanden');
      return;
    }

    console.log('Versuche Foto-Vorschau für photoId:', photoId);

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Supabase Anonymous-Key ist nicht definiert.');

      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/get-photo-url',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ photoId }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fehler beim Abrufen der Foto-URL: ${response.status} - ${errorText}`);
      }

      const { downloadUrl } = await response.json();
      console.log('Download-URL:', downloadUrl);
      setVorschauFoto(downloadUrl);
    } catch (error: any) {
      console.error('Fehler beim Laden der Foto-Vorschau:', error.message);
      setError(`Foto-Vorschau konnte nicht geladen werden: ${error.message}`);
      alert(`Fehler beim Laden der Foto-Vorschau: ${error.message}`);
    }
  }

  return (
    <div className="space-y-6 rounded-xl bg-white p-6 shadow-lg">
      {/* Filter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mieter</label>
          <select
            value={filterMieter}
            onChange={(e) => setFilterMieter((e.target as HTMLSelectElement).value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Alle Mieter</option>
            {mieterOptions.map((mieter) => (
              <option key={mieter} value={mieter}>
                {mieter}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Alle</option>
            <option value="Eintrag">Eintrag</option>
            <option value="Verschickt">Verschickt</option>
          </select>
        </div>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-600">Lade Abrechnungshistorie...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchHistoryData}
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
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Zählerstand</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Verbrauch</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Betrag</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{item.mieter}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{item.datum}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.zaehlerstand.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {item.verbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {item.betrag !== null ? `${item.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {item.status ? (
                      <span
                        className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 cursor-pointer"
                        title={`Rechnung verschickt am: ${item.status}`}
                      >
                        Verschickt
                      </span>
                    ) : (
                      <span
                        className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 cursor-pointer"
                        title={`Eintragung am: ${item.zeitstempelEintragung}`}
                      >
                        Eintrag
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.photoId && (
                      // Fehler 2: photoId wird hier geprüft, bevor zeigeFotoVorschau aufgerufen wird
                      <button
                        onClick={() => zeigeFotoVorschau(item.photoId!)} // ! ist sicher, da wir mit item.photoId prüfen
                        className="mr-2 text-gray-600 hover:text-blue-600 cursor-pointer"
                        title="Foto anzeigen"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    )}
                    {item.status && (
                      <button
                        onClick={() => handleDownload(item)}
                        className="text-gray-600 hover:text-blue-600 cursor-pointer"
                        title="Download"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Foto-Vorschau Modal */}
      {vorschauFoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-3xl max-h-[80vh] overflow-auto">
            <img src={vorschauFoto} alt="Zählerstand Foto" className="max-w-full h-auto" />
            <button
              onClick={() => setVorschauFoto(null)}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}