import { useState, useEffect, useRef } from 'preact/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Prediction {
  description: string;
  place_id: string;
}

export function CreateTenantModal({ isOpen, onClose }: CreateTenantModalProps) {
  const [formData, setFormData] = useState({
    anrede: '',
    vorname: '',
    nachname: '',
    email: '',
    strasse: '',
    hausnummer: '',
    plz: '',
    stadt: ''
  });
  const [inputValue, setInputValue] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<Prediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimeoutRef = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null); // Ref für das Modal-Inhaltselement

  // Debounce-Funktion
  const debounce = (func: () => void, delay: number) => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(func, delay) as any;
    };
  };

  // Autovervollständigung
  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 3) {
      console.log('Input zu kurz oder leer:', input);
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    console.log('Fetching suggestions for:', input);

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Supabase Anonymous-Key ist nicht definiert.');

      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/autocomplete-address',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: input }),
        }
      );

      const data = await response.json();
      console.log('Response from Supabase:', data);

      if (response.ok) {
        setAddressSuggestions(data.predictions || []);
        setShowSuggestions(true);
      } else {
        console.error('Fehler bei Autocomplete:', data.error);
        setStatusMessage(`Fehler bei Autocomplete: ${data.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der Vorschläge:', error);
      setStatusMessage('Fehler beim Laden der Adressvorschläge.');
    }
  };

  // Debounced Fetch bei Änderung von inputValue
  useEffect(() => {
    const debouncedFetch = debounce(() => {
      console.log('Debounced fetch triggered with:', inputValue);
      fetchSuggestions(inputValue);
    }, 500);

    if (isOpen) {
      debouncedFetch();
    }

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [inputValue, isOpen]);

  const handleInputChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    console.log('Input changed to:', value);
    setInputValue(value);
  };

  const handleSuggestionSelect = async (suggestion: Prediction) => {
    console.log('Selected suggestion:', suggestion);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Supabase Anonymous-Key ist nicht definiert.');

      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/autocomplete-address',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ place_id: suggestion.place_id }),
        }
      );

      const data = await response.json();
      console.log('Place Details Response:', data);

      if (response.ok) {
        setFormData((prev) => ({
          ...prev,
          strasse: data.street || '',
          hausnummer: data.number || '',
          plz: data.postalCode || '',
          stadt: data.city || '',
        }));
        setInputValue(data.street || '');
      } else {
        console.error('Fehler bei Place Details:', data.error);
        setStatusMessage(`Fehler bei Place Details: ${data.error}`);
        // Fallback: Intelligentes Parsen mit Buchstaben
        const parts = suggestion.description.split(', ');
        const streetParts = parts[0].match(/^(.*?)\s*(\d+\w*)$/) || [parts[0], parts[0], ''];
        const hausnummer = streetParts[2] || '';
        const strasse = streetParts[1].trim() || parts[0];
        const plz = parts[1].match(/^\d{5}/)?.[0] || '';
        const stadt = parts[1].replace(plz, '').trim() || parts[2] || '';
        console.log('Fallback parsed:', { strasse, hausnummer, plz, stadt });
        setFormData((prev) => ({
          ...prev,
          strasse,
          hausnummer,
          plz,
          stadt,
        }));
        setInputValue(strasse);
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der Adressdetails:', error);
      setStatusMessage('Fehler beim Laden der Adressdetails.');
    }
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const { anrede, vorname, nachname, email, strasse, hausnummer, plz, stadt } = formData;
    if (!anrede || !vorname || !nachname || !email || !strasse || !hausnummer || !plz || !stadt) {
      setStatusMessage('Fehler: Alle Felder sind erforderlich.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) {
        throw new Error('Supabase Anonymous-Key ist nicht definiert.');
      }

      const response = await fetch(
        'https://kfosgimkfydlbranmqvv.supabase.co/functions/v1/read-tenant-sheet',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setStatusMessage(result.message || 'Fehler: Dieser Mieter existiert bereits.');
        } else {
          throw new Error(result.error || `HTTP-Fehler ${response.status}`);
        }
      } else {
        setStatusMessage(result.message || 'Mieter erfolgreich angelegt!');
        setFormData({
          anrede: '',
          vorname: '',
          nachname: '',
          email: '',
          strasse: '',
          hausnummer: '',
          plz: '',
          stadt: ''
        });
        setInputValue('');
      }
    } catch (error: any) {
      console.error('Fehler beim Anlegen des Mieters:', error.message);
      setStatusMessage(`Fehler: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup bei Modal-Schließen
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        anrede: '',
        vorname: '',
        nachname: '',
        email: '',
        strasse: '',
        hausnummer: '',
        plz: '',
        stadt: ''
      });
      setInputValue('');
      setStatusMessage(null);
      setAddressSuggestions([]);
      setShowSuggestions(false);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    }
  }, [isOpen]);

  // Klicks innerhalb des Modals abfangen, um das Schließen zu verhindern
  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Verhindert, dass der Klick das Overlay erreicht
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:p-0">
        {/* Hintergrund-Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-gray-500 z-40" // z-index niedriger als Modal
          onClick={onClose}
        />

        {/* Modal-Inhalt */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="relative inline-block transform overflow-hidden rounded-2xl bg-white px-4 pb-4 pt-5 text-left align-bottom shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle z-50" // z-index höher als Overlay
          onClick={handleModalClick} // Klicks innerhalb des Modals abfangen
        >
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              disabled={isLoading}
            >
              <span className="sr-only">Schließen</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Neuen Mieter anlegen
            </h3>
            <div className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Anrede */}
                  <div>
                    <label htmlFor="anrede" className="block text-sm font-medium mb-2 text-gray-700">
                      Anrede
                    </label>
                    <select
                      id="anrede"
                      value={formData.anrede}
                      onChange={(e) => setFormData({ ...formData, anrede: (e.target as HTMLSelectElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    >
                      <option value="" className="text-gray-600">Bitte wählen</option>
                      <option value="Herr" className="text-gray-900">Herr</option>
                      <option value="Frau" className="text-gray-900">Frau</option>
                    </select>
                  </div>

                  {/* Vorname */}
                  <div>
                    <label htmlFor="vorname" className="block text-sm font-medium mb-2 text-gray-700">
                      Vorname
                    </label>
                    <input
                      type="text"
                      id="vorname"
                      value={formData.vorname}
                      onChange={(e) => setFormData({ ...formData, vorname: (e.target as HTMLInputElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Nachname */}
                  <div>
                    <label htmlFor="nachname" className="block text-sm font-medium mb-2 text-gray-700">
                      Nachname
                    </label>
                    <input
                      type="text"
                      id="nachname"
                      value={formData.nachname}
                      onChange={(e) => setFormData({ ...formData, nachname: (e.target as HTMLInputElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    />
                  </div>

                  {/* E-Mail */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700">
                      E-Mail
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: (e.target as HTMLInputElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Straße (mit Autovervollständigung) */}
                  <div className="sm:col-span-2 relative">
                    <label htmlFor="strasse" className="block text-sm font-medium mb-2 text-gray-700">
                      Straße (mit Autovervollständigung)
                    </label>
                    <input
                      type="text"
                      id="strasse"
                      value={inputValue}
                      onChange={handleInputChange}
                      className="vercel-input"
                      disabled={isLoading}
                      placeholder="Geben Sie eine Adresse ein..."
                      autoFocus={false} // Autofokus deaktivieren
                    />
                    <AnimatePresence>
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <motion.ul
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg"
                        >
                          {addressSuggestions.map((suggestion) => (
                            <motion.li
                              key={suggestion.place_id}
                              whileHover={{ backgroundColor: '#f3f4f6' }}
                              className="px-4 py-2 text-sm text-gray-700 cursor-pointer"
                              onClick={() => handleSuggestionSelect(suggestion)}
                            >
                              {suggestion.description}
                            </motion.li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Hausnummer */}
                  <div>
                    <label htmlFor="hausnummer" className="block text-sm font-medium mb-2 text-gray-700">
                      Hausnummer
                    </label>
                    <input
                      type="text"
                      id="hausnummer"
                      value={formData.hausnummer}
                      onChange={(e) => setFormData({ ...formData, hausnummer: (e.target as HTMLInputElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    />
                  </div>

                  {/* PLZ */}
                  <div>
                    <label htmlFor="plz" className="block text-sm font-medium mb-2 text-gray-700">
                      PLZ
                    </label>
                    <input
                      type="text"
                      id="plz"
                      value={formData.plz}
                      onChange={(e) => setFormData({ ...formData, plz: (e.target as HTMLInputElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Stadt */}
                  <div>
                    <label htmlFor="stadt" className="block text-sm font-medium mb-2 text-gray-700">
                      Stadt
                    </label>
                    <input
                      type="text"
                      id="stadt"
                      value={formData.stadt}
                      onChange={(e) => setFormData({ ...formData, stadt: (e.target as HTMLInputElement).value })}
                      className="vercel-input"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Statusmeldung */}
                <AnimatePresence>
                  {statusMessage && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`mt-4 rounded-lg p-4 text-sm ${
                        statusMessage.includes('Fehler') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                      }`}
                    >
                      {statusMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Buttons */}
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex w-full justify-center bg-gray-800 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:col-start-2 disabled:bg-gray-500"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <motion.div
                        className="h-5 w-5 rounded-full border-4 border-white border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      />
                    ) : (
                      'Anlegen'
                    )}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="mt-3 inline-flex w-full justify-center border border-gray-300 bg-white text-gray-700 font-medium py-2 px-4 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:col-start-1 sm:mt-0 disabled:bg-gray-200 disabled:text-gray-400"
                    disabled={isLoading}
                  >
                    Abbrechen
                  </motion.button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}