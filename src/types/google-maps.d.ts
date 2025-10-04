declare global {
  interface Window {
    google: {
      maps: {
        Map: any;
        Marker: any;
        InfoWindow: any;
        Geocoder: any;
        DirectionsService: any;
        DirectionsRenderer: any;
        LatLng: any;
        Size: any;
        Point: any;
        Animation: {
          BOUNCE: any;
          DROP: any;
        };
        marker: {
          AdvancedMarkerElement: any;
        };
        places: {
          Autocomplete: any;
          AutocompleteService: any;
          AutocompleteSuggestion: any;
          AutocompleteSessionToken: any;
          PlacesService: any;
          PlacesServiceStatus: {
            OK: string;
            ZERO_RESULTS: string;
            OVER_QUERY_LIMIT: string;
            REQUEST_DENIED: string;
            INVALID_REQUEST: string;
            NOT_FOUND: string;
          };
        };
        GeocoderStatus: {
          OK: string;
          ZERO_RESULTS: string;
          OVER_QUERY_LIMIT: string;
          REQUEST_DENIED: string;
          INVALID_REQUEST: string;
          ERROR: string;
        };
        event: {
          addListener: (
            instance: any,
            eventName: string,
            handler: Function,
          ) => any;
          removeListener: (listener: any) => void;
          trigger: (instance: any, eventName: string, ...args: any[]) => void;
        };
      };
    };
    initGoogleMaps: () => void;
    googleMapsLoaded: boolean;
  }
}

export {};
