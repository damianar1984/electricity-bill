import { useState, useEffect, useRef } from 'preact/hooks';

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
          hausnummer: data.number || '', // Sollte "22a" enthalten
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
        const hausnummer = streetParts[2] || ''; // "22a" statt nur "22"
        const strasse = streetParts[1].trim() || parts[0];
        const plz = parts[1].match(/^\d{5}/)?.[0] || '';
        const stadt = parts[1].replace(plz, '').trim() || parts[2] || '';
        console.log('Fallback parsed:', { strasse, hausnummer, plz, stadt });
        setFormData((prev) => ({
          ...prev,
          strasse,
          hausnummer, // Buchstaben bleiben erhalten
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Schließen</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Neuen Mieter anlegen
              </h3>
              <div className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="anrede" className="block text-sm font-medium text-gray-700">
                        Anrede
                      </label>
                      <select
                        id="anrede"
                        value={formData.anrede}
                        onChange={(e) => setFormData({ ...formData, anrede: (e.target as HTMLSelectElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      >
                        <option value="">Bitte wählen</option>
                        <option value="Herr">Herr</option>
                        <option value="Frau">Frau</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="vorname" className="block text-sm font-medium text-gray-700">
                        Vorname
                      </label>
                      <input
                        type="text"
                        id="vorname"
                        value={formData.vorname}
                        onChange={(e) => setFormData({ ...formData, vorname: (e.target as HTMLInputElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label htmlFor="nachname" className="block text-sm font-medium text-gray-700">
                        Nachname
                      </label>
                      <input
                        type="text"
                        id="nachname"
                        value={formData.nachname}
                        onChange={(e) => setFormData({ ...formData, nachname: (e.target as HTMLInputElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        E-Mail
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: (e.target as HTMLInputElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      />
                    </div>

                    <div className="sm:col-span-2 relative">
                      <label htmlFor="strasse" className="block text-sm font-medium text-gray-700">
                        Straße (mit Autovervollständigung)
                      </label>
                      <input
                        type="text"
                        id="strasse"
                        value={inputValue}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                        placeholder="Geben Sie eine Adresse ein..."
                      />
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                          {addressSuggestions.map((suggestion) => (
                            <li
                              key={suggestion.place_id}
                              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleSuggestionSelect(suggestion)}
                            >
                              {suggestion.description}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <label htmlFor="hausnummer" className="block text-sm font-medium text-gray-700">
                        Hausnummer
                      </label>
                      <input
                        type="text"
                        id="hausnummer"
                        value={formData.hausnummer}
                        onChange={(e) => setFormData({ ...formData, hausnummer: (e.target as HTMLInputElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label htmlFor="plz" className="block text-sm font-medium text-gray-700">
                        PLZ
                      </label>
                      <input
                        type="text"
                        id="plz"
                        value={formData.plz}
                        onChange={(e) => setFormData({ ...formData, plz: (e.target as HTMLInputElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label htmlFor="stadt" className="block text-sm font-medium text-gray-700">
                        Stadt
                      </label>
                      <input
                        type="text"
                        id="stadt"
                        value={formData.stadt}
                        onChange={(e) => setFormData({ ...formData, stadt: (e.target as HTMLInputElement).value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {statusMessage && (
                    <div
                      className={`mt-4 rounded-lg p-4 text-sm ${
                        statusMessage.includes('Fehler')
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {statusMessage}
                    </div>
                  )}

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:bg-blue-400"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h-8z" />
                        </svg>
                      ) : (
                        'Anlegen'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                      disabled={isLoading}
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}