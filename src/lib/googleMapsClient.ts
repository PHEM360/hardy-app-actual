type LatLng = { lat: number; lng: number };

export type PlaceSuggestion = {
  id: string;
  label: string;
  secondary?: string;
  prediction: any;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

export type TravelEstimate = {
  minutes: number;
  distanceMeters: number;
};

declare global {
  interface Window {
    google?: any;
  }
}

let mapsPromise: Promise<any> | null = null;

export function googleMapsConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
}

export async function loadGoogleMaps(): Promise<any> {
  if (window.google?.maps?.importLibrary) return window.google.maps;
  if (mapsPromise) return mapsPromise;

  const key = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  if (!key) throw new Error("Google Maps is not configured.");

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hardy-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google?.maps));
      existing.addEventListener("error", () => reject(new Error("Could not load Google Maps.")));
      return;
    }

    const script = document.createElement("script");
    script.dataset.hardyGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("Google Maps did not initialise."));
    script.onerror = () => reject(new Error("Could not load Google Maps."));
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export async function createPlacesSessionToken(): Promise<any | null> {
  if (!googleMapsConfigured()) return null;
  const maps = await loadGoogleMaps();
  const { AutocompleteSessionToken } = await maps.importLibrary("places");
  return new AutocompleteSessionToken();
}

export async function getPlaceSuggestions(
  input: string,
  sessionToken?: any,
  origin?: LatLng | null,
): Promise<PlaceSuggestion[]> {
  if (!googleMapsConfigured() || input.trim().length < 2) return [];
  const maps = await loadGoogleMaps();
  const { AutocompleteSuggestion } = await maps.importLibrary("places");
  const request: Record<string, unknown> = {
    input: input.trim(),
    sessionToken: sessionToken || undefined,
    includedRegionCodes: ["gb"],
  };
  if (origin) request.origin = origin;
  const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
  return (result.suggestions || [])
    .map((suggestion: any) => {
      const prediction = suggestion.placePrediction;
      if (!prediction) return null;
      const label = prediction.text?.toString?.() || prediction.mainText?.toString?.() || "";
      const secondary = prediction.secondaryText?.toString?.() || "";
      return {
        id: String(prediction.placeId || label),
        label,
        secondary,
        prediction,
      } as PlaceSuggestion;
    })
    .filter(Boolean) as PlaceSuggestion[];
}

export async function getPlaceDetails(suggestion: PlaceSuggestion): Promise<PlaceDetails> {
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location"] });
  const location = place.location;
  return {
    placeId: String(place.id || suggestion.id),
    name: String(place.displayName || suggestion.label),
    address: String(place.formattedAddress || suggestion.label),
    lat: typeof location?.lat === "function" ? location.lat() : location?.lat,
    lng: typeof location?.lng === "function" ? location.lng() : location?.lng,
  };
}

export function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Allow location access to calculate travel time.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  });
}

export async function computeDrivingTravelTime(origin: LatLng, destination: LatLng | string): Promise<TravelEstimate> {
  const maps = await loadGoogleMaps();
  const { Route } = await maps.importLibrary("routes");
  const result = await Route.computeRoutes({
    origin,
    destination,
    travelMode: "DRIVING",
    routingPreference: "TRAFFIC_AWARE",
    fields: ["durationMillis", "distanceMeters"],
  });
  const route = result.routes?.[0];
  if (!route) throw new Error("No driving route was found.");
  return {
    minutes: Math.max(1, Math.round(Number(route.durationMillis || 0) / 60_000)),
    distanceMeters: Number(route.distanceMeters || 0),
  };
}

export function googleMapsDirectionsUrl(address: string, placeId?: string) {
  const params = new URLSearchParams({ api: "1", destination: address, travelmode: "driving", dir_action: "navigate" });
  if (placeId) params.set("destination_place_id", placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function appleMapsDirectionsUrl(address: string) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;
}
