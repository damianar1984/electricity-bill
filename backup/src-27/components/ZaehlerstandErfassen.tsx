import { useEffect, useState, useRef } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat'; // Typen aus preact/compat importieren
import flatpickr from 'flatpickr';
import { German } from 'flatpickr/dist/l10n/de.js';

interface MieterAntwort {
  mieter: string[];
}

interface ZaehlerstandAntwort {
  lastZaehlerstand: string;
  strompreis: string;
  grundpreis: string;
}

export function ZaehlerstandErfassen() {
  const [mieter, setMieter] = useState<string[]>([]);
  const [ladevorgang, setLadevorgang] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ausgewaehlterMieter, setAusgewaehlterMieter] = useState<string>('');
  const [letzterZaehlerstand, setLetzterZaehlerstand] = useState<string>('');
  const [neuerZaehlerstand, setNeuerZaehlerstand] = useState<string>('');
  const [strompreis, setStrompreis] = useState<string>('');
  const [grundpreis, setGrundpreis] = useState<string>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [sendInvoice, setSendInvoice] = useState<boolean>(false);
  const [speicherStatus, setSpeicherStatus] = useState<string | null>(null);
  const [datum, setDatum] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
  });
  const datepickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    holeMieter();
    holeLetzterZaehlerstand();

    if (datepickerRef.current) {
      flatpickr(datepickerRef.current, {
        dateFormat: 'd.m.Y',
        locale: German,
        maxDate: 'today',
        defaultDate: datum,
        onChange: (_, dateStr) => {
          setDatum(dateStr);
        },
      });
    }
  }, []);

  function formatGermanNumber(value: any): string {
    const strValue = String(value ?? '0');
    const num = parseFloat(strValue.replace(',', '.'));
    return isNaN(num) ? '0,00' : num.toFixed(2).replace('.', ',');
  }

  async function holeMieter() {
    try {
      setLadevorgang(true);
      setFehler(null);

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Supabase Anonymous-Key ist nicht definiert.');

      const response = await fetch('https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-tenant-sheet', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

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

  async function holeLetzterZaehlerstand() {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Supabase Anonymous-Key ist nicht definiert.');

      const response = await fetch('https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-last-data-sheet', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP-Fehler ${response.status}: ${errorText}`);
      }

      const data: ZaehlerstandAntwort = await response.json();
      setLetzterZaehlerstand(formatGermanNumber(data.lastZaehlerstand));
      setStrompreis(formatGermanNumber(data.strompreis));
      setGrundpreis(formatGermanNumber(data.grundpreis));
    } catch (error: any) {
      console.error('Fehler beim Laden des letzten Zählerstands:', error.message);
      setFehler(`Der letzte Zählerstand konnte nicht geladen werden: ${error.message}`);
    }
  }

  async function handleZaehlerstandErfassen() {
    try {
      if (!ausgewaehlterMieter) {
        setSpeicherStatus('Bitte wählen Sie einen Mieter aus.');
        return;
      }
      if (!neuerZaehlerstand) {
        setSpeicherStatus('Bitte geben Sie einen neuen Zählerstand ein.');
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Supabase Anonymous-Key ist nicht definiert.');

      const writeResponse = await fetch('https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/write-meter-reading', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mieter: ausgewaehlterMieter,
          zaehlerstand: neuerZaehlerstand.replace(',', '.'),
          strompreis: strompreis.replace(',', '.'),
          grundpreis: grundpreis.replace(',', '.'),
          datum,
          sendInvoice: false,
        }),
      });

      if (!writeResponse.ok) {
        const errorText = await writeResponse.text();
        throw new Error(`Fehler beim Speichern des Zählerstands: ${writeResponse.status} - ${errorText}`);
      }

      const writeResult = await writeResponse.json();
      setSpeicherStatus(writeResult.message);

      if (sendInvoice) {
        const formData = new FormData();
        formData.append('mieter', ausgewaehlterMieter);
        if (photo) formData.append('photo', photo);
        formData.append('sendInvoice', 'true');

        const invoiceResponse = await fetch('https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/generate-invoice', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${anonKey}`,
          },
          body: formData,
        });

        if (!invoiceResponse.ok) {
          const errorText = await invoiceResponse.text();
          throw new Error(`Fehler beim Generieren der Rechnung: ${invoiceResponse.status} - ${errorText}`);
        }

        const invoiceResult = await invoiceResponse.json();
        setSpeicherStatus(`${writeResult.message} und ${invoiceResult.message}`);
      }

      await holeLetzterZaehlerstand();
      setNeuerZaehlerstand('');
      setPhoto(null);
    } catch (error: any) {
      console.error('Fehler beim Erfassen des Zählerstands:', error.message);
      setSpeicherStatus(`Fehler: ${error.message}`);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl">
      <div className="mb-4">
        <label htmlFor="mieter" className="mb-2 block text-sm font-semibold text-gray-700">
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
              onClick={() => {
                holeMieter();
                holeLetzterZaehlerstand();
              }}
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

      <div className="mb-4">
        <label htmlFor="letzterZaehlerstand" className="mb-2 block text-sm font-semibold text-gray-700">
          Letzter Zählerstand
        </label>
        <input
          id="letzterZaehlerstand"
          value={letzterZaehlerstand ? `${letzterZaehlerstand} kWh` : 'Laden...'}
          readOnly
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-700 shadow-sm focus:outline-none sm:text-sm"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="neuerZaehlerstand" className="mb-2 block text-sm font-semibold text-gray-700">
          Neuer Zählerstand
        </label>
        <input
          id="neuerZaehlerstand"
          value={neuerZaehlerstand}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const target = e.target as HTMLInputElement; // Typ explizit setzen
            setNeuerZaehlerstand(target.value.replace(/[^0-9,]/g, ''));
          }}
          placeholder="z.B. 564,50"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="mb-4 flex space-x-4">
        <div className="flex-1">
          <label htmlFor="strompreis" className="mb-2 block text-sm font-semibold text-gray-700">
            Strompreis pro kWh
          </label>
          <input
            id="strompreis"
            value={strompreis ? `${strompreis} €` : 'Laden...'}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const target = e.target as HTMLInputElement; // Typ explizit setzen
              const value = target.value.replace(' €', '').replace(/[^0-9,]/g, '');
              setStrompreis(value);
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="grundpreis" className="mb-2 block text-sm font-semibold text-gray-700">
            Grundpreis
          </label>
          <input
            id="grundpreis"
            value={grundpreis ? `${grundpreis} €` : 'Laden...'}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const target = e.target as HTMLInputElement; // Typ explizit setzen
              const value = target.value.replace(' €', '').replace(/[^0-9,]/g, '');
              setGrundpreis(value);
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="datum" className="mb-2 block text-sm font-semibold text-gray-700">
          Erfassungsdatum
        </label>
        <input
          id="datum"
          ref={datepickerRef}
          value={datum}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="photo" className="mb-2 block text-sm font-semibold text-gray-700">
          Zählerstandsfoto
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto((e.target as HTMLInputElement).files?.[0] || null)}
          className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div className="mb-4 flex justify-end items-center">
        <span className="mr-3 text-sm font-semibold text-gray-700">Rechnung</span>
        <div
          className={`relative inline-block w-10 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
            sendInvoice ? 'bg-blue-600' : 'bg-gray-300'
          }`}
          onClick={() => setSendInvoice(!sendInvoice)}
        >
          <span
            className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out transform ${
              sendInvoice ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleZaehlerstandErfassen}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Zählerstand erfassen
        </button>
      </div>

      {speicherStatus && (
        <div
          className={`mt-4 rounded-lg p-4 text-sm ${
            speicherStatus.includes('Fehler') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}
        >
          {speicherStatus}
        </div>
      )}
    </div>
  );
}