// Prettier does not support typescript annotation
// eslint-disable-next-line prettier/prettier
import type { AutocompleteQuery, GeocoderConfig, MultiGeocoderResponse, ReverseQuery, SearchQuery, SingleGeocoderResponse } from "./types";

import Geocoder, { GeocoderAPI } from "./abstract-geocoder";
import { OTPGeocoderResponse } from "../apis/otp";
import NoApiGeocoder from "./noapi";

/**
 * Allows fetching results from OTP instance with the geocoder endpoint enabled
 */
export default class OTPGeocoder extends Geocoder {
    private noapi: Geocoder;

    constructor(geocoderApi: GeocoderAPI, geocoderConfig: GeocoderConfig) {
        super(geocoderApi, geocoderConfig);
        this.noapi = new NoApiGeocoder(geocoderApi, geocoderConfig);
    }

    getAutocompleteQuery(query: AutocompleteQuery): AutocompleteQuery {
    const {
      baseUrl,
    } = this.geocoderConfig;
    return {
      url: baseUrl,
      ...query
    };
  }

  rewriteAutocompleteResponse(response: OTPGeocoderResponse): MultiGeocoderResponse {
    return {
        features: response?.results?.map(stop => ({
            geometry: { type: "Point", coordinates: [stop.lng, stop.lat] },
            id: stop.id,
            // TODO: if non-stops are supported, these need to be detected here and 
            // this layer property updated accordingly
            properties: { layer: "stops", source: "otp", name: stop.description, label: stop.description, stopId: stop.id },
            type: "Feature"
        })),
      type: "FeatureCollection"
    };
  }

  search(query: SearchQuery): Promise<MultiGeocoderResponse> {
      return this.noapi.search(query);
  }

  reverse(query: ReverseQuery): Promise<MultiGeocoderResponse | SingleGeocoderResponse> {
      return this.noapi.reverse(query);
  }
}
