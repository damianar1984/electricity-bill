import { useEffect, useState, useRef } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';
import flatpickr from 'flatpickr';
import { German } from 'flatpickr/dist/l10n/de.js';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilIcon, CameraIcon, XMarkIcon } from '@heroicons/react/24/solid';

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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sendInvoice, setSendInvoice] = useState<boolean>(false);
  const [speicherStatus, setSpeicherStatus] = useState<string | null>(null);
  const [datum, setDatum] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
  });
  const [isDragging, setIsDragging] = useState(false);
  const datepickerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    holeMieter();
    holeLetzterZaehlerstand();

    if (datepickerRef.current) {
      flatpickr(datepickerRef.current, {
        dateFormat: 'd.m.Y',
        locale: German,
        maxDate: 'today',
        defaultDate: datum,
        onChange: (_, dateStr) => setDatum(dateStr),
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
      if (!anonKey) {
        console.error('Supabase Anonymous-Key ist nicht definiert.');
        throw new Error('Supabase Anonymous-Key ist nicht definiert.');
      }

      console.log('Fetching mieter with anonKey:', anonKey);

      const response = await fetch('https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-tenant-sheet', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP-Fehler:', response.status, errorText);
        throw new Error(`HTTP-Fehler ${response.status}: ${errorText}`);
      }

      const data: MieterAntwort = await response.json();
      console.log('Mieter data:', data);
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
      if (!anonKey) {
        console.error('Supabase Anonymous-Key ist nicht definiert.');
        throw new Error('Supabase Anonymous-Key ist nicht definiert.');
      }

      console.log('Fetching last zaehlerstand with anonKey:', anonKey);

      const response = await fetch('https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-last-data-sheet', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP-Fehler:', response.status, errorText);
        throw new Error(`HTTP-Fehler ${response.status}: ${errorText}`);
      }

      const data: ZaehlerstandAntwort = await response.json();
      console.log('Zaehlerstand data:', data);
      setLetzterZaehlerstand(formatGermanNumber(data.lastZaehlerstand));
      setStrompreis(formatGermanNumber(data.strompreis));
      setGrundpreis(formatGermanNumber(data.grundpreis));
    } catch (error: any) {
      console.error('Fehler beim Laden des letzten Zählerstands:', error.message);
      setFehler(`Der letzte Zählerstand konnte nicht geladen werden: ${error.message}`);
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement; // Typisieren und sicherstellen, dass target nicht null ist
    const file = target.files?.[0] || null; // Null-Check mit Fallback auf null
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0] || null; // Null-Check mit Fallback auf null
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      setPhotoPreview(null);
    } catch (error: any) {
      console.error('Fehler beim Erfassen des Zählerstands:', error.message);
      setSpeicherStatus(`Fehler: ${error.message}`);
    }
  }

  // Varianten für die Button-Animation
  const buttonVariants = {
    inactive: {
      background: '#1F2937', // Entspricht bg-gray-800
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
    active: {
      background: 'linear-gradient(to right, #3B82F6, #A855F7)', // Entspricht bg-gradient-to-r from-blue-500 to-purple-500
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
  };

  // Varianten für die Text-Animation
  const textVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.3, ease: 'easeInOut' } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-gray-900"
    >
      {/* Mieter auswählen */}
      <div className="mb-6">
        <label htmlFor="mieter" className="block text-sm font-medium mb-2 text-gray-700">
          Mieter auswählen
        </label>
        {ladevorgang ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600"></div>
            <span className="ml-3 text-gray-600 text-base">Lade Mieter...</span>
          </div>
        ) : fehler ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-500">
            <div className="flex items-center">{fehler}</div>
            <button
              onClick={() => { holeMieter(); holeLetzterZaehlerstand(); }}
              className="mt-3 w-full vercel-button"
            >
              Erneut versuchen
            </button>
          </div>
        ) : (
          <select
            id="mieter"
            value={ausgewaehlterMieter}
            onChange={(e) => setAusgewaehlterMieter((e.target as HTMLSelectElement).value)}
            className="vercel-input"
          >
            <option value="" className="text-gray-600">Bitte wählen Sie einen Mieter</option>
            {mieter.map((mieterName, index) => (
              <option key={index} value={mieterName} className="text-gray-900">{mieterName}</option>
            ))}
          </select>
        )}
      </div>

      {/* Letzter Zählerstand, Strompreis und Grundpreis in einer Zeile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="sm:col-span-1">
          <label htmlFor="letzterZaehlerstand" className="block text-sm font-medium mb-2 text-gray-700">
            Letzter Zählerstand
          </label>
          <div
            id="letzterZaehlerstand"
            className="w-full h-16 px-4 py-4 bg-gray-100 border border-gray-200 rounded-2xl text-gray-600 text-lg font-semibold shadow-sm flex items-center justify-center"
          >
            {letzterZaehlerstand ? `${letzterZaehlerstand} kWh` : 'Laden...'}
          </div>
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="strompreis" className="block text-sm font-medium mb-2 text-gray-700">
            Strompreis pro kWh
          </label>
          <input
            id="strompreis"
            value={strompreis ? `${strompreis} €` : 'Laden...'}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStrompreis((e.target as HTMLInputElement).value.replace(' €', '').replace(/[^0-9,]/g, ''))}
            className="w-full h-16 px-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-900 text-lg font-semibold placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center justify-center"
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="grundpreis" className="block text-sm font-medium mb-2 text-gray-700">
            Grundpreis
          </label>
          <input
            id="grundpreis"
            value={grundpreis ? `${grundpreis} €` : 'Laden...'}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGrundpreis((e.target as HTMLInputElement).value.replace(' €', '').replace(/[^0-9,]/g, ''))}
            className="w-full h-16 px-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-900 text-lg font-semibold placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center justify-center"
          />
        </div>
      </div>

      {/* Neuer Zählerstand */}
      <div className="mb-6">
        <label htmlFor="neuerZaehlerstand" className="block text-sm font-medium mb-2 text-gray-700">
          Neuer Zählerstand
        </label>
        <div className="relative">
          <input
            id="neuerZaehlerstand"
            value={neuerZaehlerstand}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNeuerZaehlerstand((e.target as HTMLInputElement).value.replace(/[^0-9,]/g, ''))}
            placeholder="z. B. 564,50"
            className="vercel-input"
          />
          <PencilIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
        </div>
      </div>

      {/* Erfassungsdatum */}
      <div className="mb-6">
        <label htmlFor="datum" className="block text-sm font-medium mb-2 text-gray-700">
          Erfassungsdatum
        </label>
        <input
          id="datum"
          ref={datepickerRef}
          value={datum}
          className="vercel-input"
        />
      </div>

      {/* Zählerstandsfoto */}
      <div className="mb-6">
        <label htmlFor="photo" className="block text-sm font-medium mb-2 text-gray-700">
          Zählerstandsfoto
        </label>
        {!photoPreview ? (
          <div
            className={`relative w-full h-32 border-2 border-dashed rounded-lg flex items-center justify-center transition-all duration-200 ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id="photo"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <CameraIcon className="h-6 w-6 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Foto hierher ziehen oder <span className="text-blue-500 hover:underline">auswählen</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
            <img
              src={photoPreview}
              alt="Zählerstandsfoto"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={handleRemovePhoto}
              className="absolute top-2 right-2 bg-gray-800 text-white rounded-full p-1 hover:bg-gray-700 transition-all duration-200"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Rechnung Toggle */}
      <div className="mb-6 flex justify-end">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700 mr-3">Rechnung</span>
          <div
            className={`relative inline-block w-12 h-6 rounded-full cursor-pointer transition-all duration-300 ${
              sendInvoice ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-300'
            }`}
            onClick={() => setSendInvoice(!sendInvoice)}
          >
            <motion.span
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md"
              animate={{ x: sendInvoice ? 24 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* Button mit Animation */}
      <motion.button
        variants={buttonVariants}
        initial="inactive"
        animate={sendInvoice ? 'active' : 'inactive'}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleZaehlerstandErfassen}
        className="w-full text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={sendInvoice ? 'with-invoice' : 'without-invoice'}
            variants={textVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {sendInvoice ? 'Zählerstand erfassen + Rechnung verschicken' : 'Zählerstand erfassen'}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Statusmeldung */}
      {speicherStatus && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-4 rounded-lg p-4 ${speicherStatus.includes('Fehler') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}
        >
          {speicherStatus}
        </motion.div>
      )}
    </motion.div>
  );
}