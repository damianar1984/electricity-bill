import { useEffect, useState } from 'preact/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from '@heroicons/react/24/solid';

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
  const [zoomLevel, setZoomLevel] = useState(1); // Zustand für Zoom-Level

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
            photoId: photoId,
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
      setZoomLevel(1); // Zoom zurücksetzen, wenn ein neues Foto geöffnet wird
    } catch (error: any) {
      console.error('Fehler beim Laden der Foto-Vorschau:', error.message);
      setError(`Foto-Vorschau konnte nicht geladen werden: ${error.message}`);
      alert(`Fehler beim Laden der Foto-Vorschau: ${error.message}`);
    }
  }

  // Zoom-Funktionen
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3)); // Maximaler Zoom: 3x
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 0.5)); // Minimaler Zoom: 0.5x
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-gray-900"
    >
      {/* Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="filterMieter" className="block text-sm font-medium mb-2 text-gray-700">
            Mieter
          </label>
          <select
            id="filterMieter"
            value={filterMieter}
            onChange={(e) => setFilterMieter((e.target as HTMLSelectElement).value)}
            className="vercel-input"
          >
            <option value="" className="text-gray-600">Alle Mieter</option>
            {mieterOptions.map((mieter) => (
              <option key={mieter} value={mieter} className="text-gray-900">
                {mieter}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filterStatus" className="block text-sm font-medium mb-2 text-gray-700">
            Status
          </label>
          <select
            id="filterStatus"
            value={filterStatus}
            onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value)}
            className="vercel-input"
          >
            <option value="" className="text-gray-600">Alle</option>
            <option value="Eintrag" className="text-gray-900">Eintrag</option>
            <option value="Verschickt" className="text-gray-900">Verschickt</option>
          </select>
        </div>
      </div>

      {/* Tabelle oder Karten */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <motion.div
            className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          />
          <span className="ml-3 text-gray-600 text-base">Lade Abrechnungshistorie...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-500">
          <div className="flex items-center">{error}</div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchHistoryData}
            className="mt-3 w-full vercel-button"
          >
            Erneut versuchen
          </motion.button>
        </div>
      ) : (
        <div className="mt-6">
          {/* Tabelle für Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Mieter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Zählerstand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Verbrauch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Betrag</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <AnimatePresence>
                  {filteredData.map((item, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 text-sm text-gray-900">{item.mieter}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{item.datum}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {item.zaehlerstand.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {item.verbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {item.betrag !== null ? `${item.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {item.status ? (
                          <span
                            className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 cursor-pointer"
                            title={`Rechnung verschickt am: ${item.status}`}
                          >
                            Verschickt
                          </span>
                        ) : (
                          <span
                            className="inline-flex rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700 cursor-pointer"
                            title={`Eintragung am: ${item.zeitstempelEintragung}`}
                          >
                            Eintrag
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 flex space-x-2">
                        {item.photoId && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => zeigeFotoVorschau(item.photoId!)}
                            className="text-gray-600 hover:text-blue-600 cursor-pointer"
                            title="Foto anzeigen"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </motion.button>
                        )}
                        {item.status && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDownload(item)}
                            className="text-gray-600 hover:text-blue-600 cursor-pointer"
                            title="Download"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </motion.button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Karten für Mobile */}
          <div className="md:hidden space-y-4">
            <AnimatePresence>
              {filteredData.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium text-gray-700">Mieter:</div>
                    <div className="text-gray-900">{item.mieter}</div>

                    <div className="font-medium text-gray-700">Datum:</div>
                    <div className="text-gray-900">{item.datum}</div>

                    <div className="font-medium text-gray-700">Zählerstand:</div>
                    <div className="text-gray-900">
                      {item.zaehlerstand.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                    </div>

                    <div className="font-medium text-gray-700">Verbrauch:</div>
                    <div className="text-gray-900">
                      {item.verbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                    </div>

                    <div className="font-medium text-gray-700">Betrag:</div>
                    <div className="text-gray-900">
                      {item.betrag !== null ? `${item.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '-'}
                    </div>

                    <div className="font-medium text-gray-700">Status:</div>
                    <div>
                      {item.status ? (
                        <span
                          className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 cursor-pointer"
                          title={`Rechnung verschickt am: ${item.status}`}
                        >
                          Verschickt
                        </span>
                      ) : (
                        <span
                          className="inline-flex rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700 cursor-pointer"
                          title={`Eintragung am: ${item.zeitstempelEintragung}`}
                        >
                          Eintrag
                        </span>
                      )}
                    </div>

                    <div className="font-medium text-gray-700">Aktionen:</div>
                    <div className="flex space-x-2">
                      {item.photoId && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => zeigeFotoVorschau(item.photoId!)}
                          className="text-gray-600 hover:text-blue-600 cursor-pointer"
                          title="Foto anzeigen"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </motion.button>
                      )}
                      {item.status && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDownload(item)}
                          className="text-gray-600 hover:text-blue-600 cursor-pointer"
                          title="Download"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Foto-Vorschau Modal mit Zoom-Icons */}
      {vorschauFoto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white p-4 rounded-lg max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Bild-Container mit Scroll bei Zoom */}
            <div className="relative w-full h-64 bg-gray-50 flex items-center justify-center overflow-auto">
              <motion.img
                src={vorschauFoto}
                alt="Zählerstand Foto"
                className="object-contain"
                animate={{ scale: zoomLevel }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>
            {/* Zoom-Icons und Schließen-Button */}
            <div className="mt-4 flex justify-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-2 bg-gray-800 text-white rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm hover:bg-gray-700 transition-all duration-200"
                title="Zoom In"
              >
                <MagnifyingGlassPlusIcon className="h-5 w-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-2 bg-gray-800 text-white rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm hover:bg-gray-700 transition-all duration-200"
                title="Zoom Out"
              >
                <MagnifyingGlassMinusIcon className="h-5 w-5" />
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setVorschauFoto(null)}
              className="mt-4 w-full vercel-button"
            >
              Schließen
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}