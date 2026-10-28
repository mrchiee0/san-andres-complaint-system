import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, MapPin, AlertCircle, CheckCircle2, X, LocateFixed, ExternalLink, Check, Edit3, Compass } from 'lucide-react';
import { Button } from './ui/button';

export interface LocationResult {
  latitude: number;
  longitude: number;
  address: string;
  insideBoundary: boolean;
  zone?: string | null;
}

interface SearchSuggestion {
  address: string;
  short_name?: string;
  latitude: number;
  longitude: number;
  is_in_san_andres?: boolean;
  matched_zone?: string | null;
}

interface LocationSearchPickerProps {
  value?: LocationResult | null;
  onChange: (result: LocationResult | null) => void;
  onQueryChange?: (query: string) => void;
  token?: string;
}

export default function LocationSearchPicker({ value, onChange, onQueryChange, token }: LocationSearchPickerProps) {
  const [query, setQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!value?.insideBoundary);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    if (value?.address) {
      setQuery(value.address);
      onQueryChange?.(value.address);
      if (value.insideBoundary) {
        setIsEditing(false);
      }
    }
  }, [value, onQueryChange]);

  const validateAndSelect = useCallback(
    async (lat: number | null, lon: number | null, addressText: string) => {
      const trimmed = addressText.trim();
      if (!trimmed) {
        setValidationError('Please enter an incident address.');
        return;
      }

      setIsValidating(true);
      setValidationError(null);

      try {
        const res = await fetch('/api/location/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            latitude: lat,
            longitude: lon,
            address: trimmed,
          }),
        });
        const data = await res.json();

        const isInside = Boolean(data.valid && (data.insideSanAndres ?? data.in_san_andres));

        if (!res.ok || !isInside) {
          setValidationError(
            data.message ||
              'This location is outside the coverage of Barangay San Andres, Cainta, Rizal. Only incidents within the barangay can be filed.'
          );
          onChange(null);
        } else {
          setValidationError(null);
          const resolvedLat = Number(data.latitude ?? lat ?? 14.5682);
          const resolvedLon = Number(data.longitude ?? lon ?? 121.1078);
          const resolvedZone = data.zone || data.matched_zone || null;

          onChange({
            latitude: resolvedLat,
            longitude: resolvedLon,
            address: trimmed,
            insideBoundary: true,
            zone: resolvedZone,
          });
          setIsEditing(false);
          setShowSuggestions(false);
        }
      } catch {
        setValidationError('Unable to validate location at this time. Please check your connection.');
        onChange(null);
      } finally {
        setIsValidating(false);
      }
    },
    [onChange, token]
  );

  const fetchSuggestions = useCallback(
    (q: string) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      setIsLoadingSuggestions(true);
      fetch(`/api/location/search?q=${encodeURIComponent(q)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data) => {
          // Normalize results array whether data is { results: [...] } or direct array [...]
          const raw = Array.isArray(data) ? data : data?.results || [];
          const normalized: SearchSuggestion[] = raw.map((item: any) => ({
            address: item.address || item.display_name || '',
            short_name: item.short_name || item.name || '',
            latitude: Number(item.latitude ?? item.lat),
            longitude: Number(item.longitude ?? item.lon),
            is_in_san_andres: item.is_in_san_andres ?? true,
            matched_zone: item.matched_zone || null,
          }));
          setSuggestions(normalized.slice(0, 8));
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setIsLoadingSuggestions(false));
    },
    [token]
  );

  // Helper to extract decimal coordinates if user pasted from Google Maps
  const extractCoordinates = (text: string): { lat: number; lng: number } | null => {
    const match = text.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onQueryChange?.(val);
    setValidationError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleChooseSuggestion = (s: SearchSuggestion) => {
    setQuery(s.address);
    onQueryChange?.(s.address);
    setShowSuggestions(false);
    validateAndSelect(s.latitude, s.longitude, s.address);
  };

  const handleConfirmCurrentQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setValidationError('Please enter an incident address or location name to verify.');
      inputRef.current?.focus();
      return;
    }

    // 1. Check if user typed or pasted coordinates (e.g. from Google Maps: 14.5682, 121.1078)
    const coords = extractCoordinates(trimmed);
    if (coords) {
      validateAndSelect(coords.lat, coords.lng, trimmed);
      return;
    }

    // 2. Check if query matches one of the loaded suggestions
    const exactMatch = suggestions.find(
      (s) => s.address.toLowerCase() === trimmed.toLowerCase() || s.short_name?.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      validateAndSelect(exactMatch.latitude, exactMatch.longitude, exactMatch.address);
      return;
    }

    // 3. If there are suggestions in the dropdown, use the first suggestion's coordinates
    if (suggestions.length > 0) {
      validateAndSelect(suggestions[0].latitude, suggestions[0].longitude, trimmed);
      return;
    }

    // 4. Otherwise, perform a quick search to resolve coordinates for this text
    setIsValidating(true);
    setValidationError(null);
    try {
      const searchRes = await fetch(`/api/location/search?q=${encodeURIComponent(trimmed)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const searchData = await searchRes.json();
      const raw = Array.isArray(searchData) ? searchData : searchData?.results || [];
      if (raw.length > 0 && raw[0].latitude && raw[0].longitude) {
        validateAndSelect(Number(raw[0].latitude), Number(raw[0].longitude), trimmed);
        return;
      }
    } catch {
      // Continue to fallback
    }

    // 5. Fallback: validate with San Andres center coordinates (14.5682, 121.1078)
    validateAndSelect(14.5682, 121.1078, trimmed);
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setValidationError('Device GPS is not supported in this browser.');
      return;
    }
    setIsValidating(true);
    setValidationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const defaultName = query.trim() || 'Current Device Location, San Andres, Cainta';
        validateAndSelect(coords.latitude, coords.longitude, defaultName);
      },
      () => {
        setIsValidating(false);
        setValidationError('Unable to retrieve device GPS. Please type your address or search via Google Maps.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const startChangingAddress = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  const googleMapsUrl = value?.latitude && value?.longitude
    ? `https://www.google.com/maps?q=${value.latitude},${value.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query.trim() ? `${query.trim()}, San Andres, Cainta, Rizal` : 'Barangay San Andres, Cainta, Rizal'
      )}`;

  return (
    <div className="space-y-3">
      {/* Google Maps Locator Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs">
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-primary" />
            Google Maps Incident Locator
          </p>
          <p className="text-[11px] text-muted-foreground">
            Search or pinpoint your exact location on Google Maps, then enter the street name or address below.
          </p>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Google Maps
        </a>
      </div>

      {/* Confirmed Official Address Card */}
      {value?.insideBoundary && !isEditing ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-sm space-y-3 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Official Incident Address Confirmed
                </span>
              </div>
              <p className="text-base font-bold text-foreground">
                {value.address}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                {value.zone && (
                  <span className="rounded bg-background/80 px-2 py-0.5 font-medium border border-border/50">
                    Zone: {value.zone}
                  </span>
                )}
                <span className="font-mono text-[11px]">
                  Coords: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
                </span>
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  • Verified inside Barangay San Andres
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startChangingAddress}
              className="text-xs h-8 gap-1.5 shrink-0 bg-background"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Change Address
            </Button>
          </div>
        </div>
      ) : (
        /* Address Input & Search Form */
        <div className="space-y-2">
          <form onSubmit={handleConfirmCurrentQuery} className="relative">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 flex items-center rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                <input
                  ref={inputRef}
                  type="text"
                  id="location-search-input"
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Type street, subdivision, or landmark (e.g. Greenpark, Vista Verde, Brookside)..."
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmCurrentQuery();
                    }
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setSuggestions([]);
                      inputRef.current?.focus();
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground p-1"
                    aria-label="Clear address text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {isLoadingSuggestions && (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent ml-2" />
                )}
              </div>

              <Button
                type="submit"
                disabled={isValidating || !query.trim()}
                className="gap-1.5 text-xs font-semibold h-10 px-4 shrink-0"
              >
                {isValidating ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Set as Official Address
                  </>
                )}
              </Button>
            </div>

            {/* Suggestions Dropdown List */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-in fade-in-50 duration-150">
                <div className="bg-muted/60 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  Select matching address in San Andres:
                </div>
                <ul role="listbox" className="max-h-60 overflow-y-auto divide-y divide-border/40">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleChooseSuggestion(s);
                      }}
                      className="flex cursor-pointer items-start justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors duration-150 group hover:bg-primary hover:text-white"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary group-hover:text-white transition-colors" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground group-hover:text-white transition-colors truncate">
                            {s.short_name || s.address}
                          </p>
                          <p className="text-[11px] text-muted-foreground group-hover:text-white/90 transition-colors truncate">
                            {s.address}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary group-hover:bg-white group-hover:text-primary transition-all self-center shadow-xs">
                        Select Address
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>

          {/* Quick Helper Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={useDeviceLocation}
              disabled={isValidating}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LocateFixed className="h-3.5 w-3.5 text-primary" />
              Use my current GPS location
            </button>
            {value?.insideBoundary && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Cancel change
              </button>
            )}
          </div>
        </div>
      )}

      {/* Validation Feedback Messages */}
      {isValidating && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
          <span>Checking boundary coverage in Barangay San Andres, Cainta...</span>
        </div>
      )}

      {!isValidating && validationError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Unable to set address</p>
            <p className="mt-0.5 leading-relaxed">{validationError}</p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong>Tip:</strong> You can click <em>Open in Google Maps</em> to inspect your location, then enter your subdivision, street, landmark, or coordinates above and click <strong>Set as Official Address</strong>.
      </p>
    </div>
  );
}
