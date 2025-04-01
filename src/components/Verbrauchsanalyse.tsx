import { useEffect, useState } from 'preact/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ConsumptionData {
  mieter: string;
  datum: string;
  status: string;
  verbrauch: number;
  gesamtbetrag: number;
}

interface ChartData {
  month: string;
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
    year: '',
  });
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [mieterOptions, setMieterOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Mieter-Optionen extrahieren
    const uniqueMieters = Array.from(new Set(data.map((item) => item.mieter).filter(Boolean)));
    setMieterOptions(uniqueMieters);

    // Jahre aus den Daten extrahieren
    const years = Array.from(
      new Set(
        data.map((item) => {
          const date = new Date(item.datum.split('.').reverse().join('-'));
          return String(date.getFullYear());
        })
      )
    ).sort((a, b) => b.localeCompare(a)); // Sortiere absteigend (neuestes Jahr zuerst)
    setYearOptions(years);

    // Standardmäßig das neueste Jahr auswählen
    if (years.length > 0 && !filters.year) {
      setFilters((prev) => ({ ...prev, year: years[0] }));
    }

    // Chart-Daten vorbereiten
    if (filters.mieter && filters.year) {
      const filteredByMieterAndYear = data.filter(
        (item) =>
          item.mieter === filters.mieter &&
          new Date(item.datum.split('.').reverse().join('-')).getFullYear() === parseInt(filters.year)
      );

      // Alle Monate des Jahres initialisieren (Januar bis Dezember)
      const monthlyData: { [key: string]: { verbrauch: number; gesamtbetrag: number } } = {};
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${filters.year}-${String(month).padStart(2, '0')}`; // YYYY-MM
        monthlyData[monthKey] = { verbrauch: 0, gesamtbetrag: 0 };
      }

      // Daten nach Monat aggregieren
      filteredByMieterAndYear.forEach((item) => {
        const date = new Date(item.datum.split('.').reverse().join('-')); // Konvertiere DD.MM.YYYY zu YYYY-MM-DD
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { verbrauch: 0, gesamtbetrag: 0 };
        }
        monthlyData[monthKey].verbrauch += item.verbrauch;
        monthlyData[monthKey].gesamtbetrag += item.gesamtbetrag;
      });

      // Chart-Daten erstellen
      const chartDataArray = Object.keys(monthlyData)
        .map((month) => ({
          month: new Date(month).toLocaleString('de-DE', { month: 'short' }), // Monatsname (z. B. "Jan")
          verbrauch: monthlyData[month].verbrauch,
          gesamtbetrag: monthlyData[month].gesamtbetrag,
        }))
        .sort((a, b) => {
          const monthOrder = [
            'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
          ];
          return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
        });

      setChartData(chartDataArray);
    } else {
      setChartData([]);
    }
  }, [data, filters.mieter, filters.year]);

  async function fetchData() {
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
        throw new Error('Fehler beim Laden der Verbrauchsdaten');
      }

      const rawData = await response.json();
      console.log('Raw Data:', rawData);

      if (!Array.isArray(rawData)) {
        throw new Error('Erwartetes Datenformat ist kein Array');
      }

      // Letzten Eintrag finden, der nicht leer ist
      const lastEntryIndex = rawData.findLastIndex((row: any[]) => row[0] && row[0].trim() !== '');
      const relevantData = lastEntryIndex >= 0 ? rawData.slice(0, lastEntryIndex + 1) : [];

      // Daten in das ConsumptionData-Format umwandeln
      const formattedData: ConsumptionData[] = relevantData
        .filter((row) => row && row.length >= 10)
        .map((row: any[]) => {
          const [
            mieter, // Spalte A
            datum,  // Spalte B
            ,       // Spalte C (überspringen)
            ,       // Spalte D (überspringen)
            ,       // Spalte E (überspringen)
            verbrauch, // Spalte F
            ,       // Spalte G (überspringen)
            ,       // Spalte H (überspringen)
            gesamtbetrag, // Spalte I
            status, // Spalte J
          ] = row;

          const verbrauchNum = parseFloat(String(verbrauch).replace(',', '.')) || 0;
          const gesamtbetragNum = parseFloat(String(gesamtbetrag).replace(',', '.')) || 0;

          return {
            mieter: mieter || '',
            datum: datum || '',
            status: status ? 'bezahlt' : 'offen',
            verbrauch: verbrauchNum,
            gesamtbetrag: gesamtbetragNum,
          };
        });

      setData(formattedData);
    } catch (err: any) {
      console.error('Fehler:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter((item) => {
    const itemDate = new Date(item.datum.split('.').reverse().join('-')); // Konvertiere DD.MM.YYYY zu YYYY-MM-DD
    return (
      (!filters.mieter || item.mieter === filters.mieter) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.year || String(itemDate.getFullYear()) === filters.year)
    );
  });

  // Summen berechnen
  const totalVerbrauch = filteredData.reduce((sum, item) => sum + item.verbrauch, 0);
  const totalGesamtbetrag = filteredData.reduce((sum, item) => sum + item.gesamtbetrag, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-gray-900"
    >
      {/* Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="mieter" className="block text-sm font-medium mb-2 text-gray-700">
            Mieter
          </label>
          <select
            id="mieter"
            value={filters.mieter}
            onChange={(e) => setFilters({ ...filters, mieter: (e.target as HTMLSelectElement).value })}
            className="vercel-input"
          >
            <option value="" className="text-gray-600">Mieter auswählen</option>
            {mieterOptions.map((mieter) => (
              <option key={mieter} value={mieter} className="text-gray-900">
                {mieter}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-2 text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: (e.target as HTMLSelectElement).value })}
            className="vercel-input"
          >
            <option value="" className="text-gray-600">Alle</option>
            <option value="offen" className="text-gray-900">Offen</option>
            <option value="bezahlt" className="text-gray-900">Bezahlt</option>
          </select>
        </div>
        <div>
          <label htmlFor="year" className="block text-sm font-medium mb-2 text-gray-700">
            Jahr
          </label>
          <select
            id="year"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: (e.target as HTMLSelectElement).value })}
            className="vercel-input"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year} className="text-gray-900">
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hinweis, wenn kein Mieter ausgewählt ist */}
      {!filters.mieter && !loading && !error && (
        <div className="mb-6 text-center text-gray-600">
          Bitte wählen Sie einen Mieter aus, um die Verbrauchsdaten anzuzeigen.
        </div>
      )}

      {/* Chart-Auswahl und Chart */}
      {filters.mieter && filters.year && chartData.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Verbrauch und Kosten für {filters.mieter} ({filters.year})
            </h3>
            <div>
              <label htmlFor="chartType" className="text-sm font-medium text-gray-700 mr-2">
                Diagrammart
              </label>
              <select
                id="chartType"
                value={chartType}
                onChange={(e) => setChartType((e.target as HTMLSelectElement).value as 'bar' | 'line')}
                className="vercel-input inline-block w-auto"
              >
                <option value="bar">Balkendiagramm</option>
                <option value="line">Liniendiagramm</option>
              </select>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis yAxisId="left" stroke="#6b7280" label={{ value: 'Verbrauch (kWh)', angle: -90, position: 'insideLeft', offset: 10, fill: '#6b7280' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" label={{ value: 'Kosten (€)', angle: 90, position: 'insideRight', offset: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${name === 'verbrauch' ? 'kWh' : '€'}`,
                      name === 'verbrauch' ? 'Verbrauch' : 'Kosten'
                    ]}
                  />
                  <Legend formatter={(value) => (value === 'verbrauch' ? 'Verbrauch' : 'Kosten')} />
                  <Bar yAxisId="left" dataKey="verbrauch" fill="#3B82F6" name="verbrauch" />
                  <Bar yAxisId="right" dataKey="gesamtbetrag" fill="#A855F7" name="gesamtbetrag" />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis yAxisId="left" stroke="#6b7280" label={{ value: 'Verbrauch (kWh)', angle: -90, position: 'insideLeft', offset: 10, fill: '#6b7280' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" label={{ value: 'Kosten (€)', angle: 90, position: 'insideRight', offset: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${name === 'verbrauch' ? 'kWh' : '€'}`,
                      name === 'verbrauch' ? 'Verbrauch' : 'Kosten'
                    ]}
                  />
                  <Legend formatter={(value) => (value === 'verbrauch' ? 'Verbrauch' : 'Kosten')} />
                  <Line yAxisId="left" type="monotone" dataKey="verbrauch" stroke="#3B82F6" name="verbrauch" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="gesamtbetrag" stroke="#A855F7" name="gesamtbetrag" strokeWidth={2} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>
      ) : filters.mieter && filters.year ? (
        <div className="mb-6 text-center text-gray-600">
          Keine Daten für {filters.mieter} im Jahr {filters.year} verfügbar.
        </div>
      ) : null}

      {/* Tabelle oder Karten */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <motion.div
            className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          />
          <span className="ml-3 text-gray-600 text-base">Lade Verbrauchsdaten...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-500">
          <div className="flex items-center">{error}</div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchData}
            className="mt-3 w-full vercel-button"
          >
            Erneut versuchen
          </motion.button>
        </div>
      ) : filters.mieter ? (
        <div className="mt-6">
          {/* Tabelle für Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Mieter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Verbrauch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Gesamtbetrag</th>
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
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.status === 'bezahlt' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {item.verbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {item.gesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {/* Summenzeile */}
                {filteredData.length > 0 && (
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-4 text-sm text-gray-900" colSpan={3}>Summe</td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {totalVerbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {totalGesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                  </tr>
                )}
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

                    <div className="font-medium text-gray-700">Status:</div>
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.status === 'bezahlt' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="font-medium text-gray-700">Verbrauch:</div>
                    <div className="text-gray-900">
                      {item.verbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                    </div>

                    <div className="font-medium text-gray-700">Gesamtbetrag:</div>
                    <div className="text-gray-900">
                      {item.gesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>
                </motion.div>
              ))}
              {/* Summenfeld für Mobile */}
              {filteredData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-100 border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                    <div className="text-gray-700">Summe Verbrauch:</div>
                    <div className="text-gray-900">
                      {totalVerbrauch.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                    </div>
                    <div className="text-gray-700">Summe Gesamtbetrag:</div>
                    <div className="text-gray-900">
                      {totalGesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}