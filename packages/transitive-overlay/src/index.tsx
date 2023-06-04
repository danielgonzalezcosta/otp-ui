import { SymbolLayout } from "mapbox-gl";
import { util } from "@opentripplanner/base-map";
import React, { useEffect } from "react";
import { Layer, Source, useMap } from "react-map-gl";
import polyline from "@mapbox/polyline";
import {
  Leg,
  TransitiveData,
  TransitiveJourney,
  TransitivePattern
} from "@opentripplanner/types";
import bbox from "@turf/bbox";

import { getRouteLayerLayout, patternToRouteFeature } from "./route-layers";
import { getFromToAnchors, itineraryToTransitive } from "./util";

export { itineraryToTransitive };

// TODO: BETTER COLORS
const modeColorMap = {
  CAR: "#888",
  BICYCLE: "#f00",
  SCOOTER: "#f5a729",
  MICROMOBILITY: "#f5a729",
  MICROMOBILITY_RENT: "#f5a729",
  WALK: "#86cdf9"
};

/**
 * Apply a thin, white halo around the (black) text.
 */
const defaultTextPaintParams = {
  "text-halo-blur": 1,
  "text-halo-color": "#ffffff",
  "text-halo-width": 2
};

/**
 * Common text settings.
 */
const commonTextLayoutParams: SymbolLayout = {
  "symbol-placement": "point",
  "text-allow-overlap": false,
  "text-field": ["get", "name"],
  "text-justify": "auto",
  "text-radial-offset": 1,
  "text-size": 15
};

/**
 * Text size and layout that lets maplibre relocate text space permitting.
 */
const defaultTextLayoutParams: SymbolLayout = {
  ...commonTextLayoutParams,
  "text-variable-anchor": [
    "left",
    "right",
    "top",
    "bottom",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right"
  ]
};

/**
 * Default text + bold default fonts
 */
const defaultBoldTextLayoutParams = {
  ...commonTextLayoutParams,
  // FIXME: find a better way to set a bold font
  "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
  "text-overlap": "never"
};

const routeFilter = ["==", "type", "route"];
const stopFilter = ["==", "type", "stop"];
const accessLegFilter = [
  "match",
  ["get", "type"],
  ["BICYCLE", "SCOOTER", "MICROMOBILITY", "MICROMOBILITY_RENT", "CAR"],
  true,
  false
];

type Props = {
  activeLeg?: Leg;
  disableFlexArc: boolean;
  transitiveData?: TransitiveData;
};

const TransitiveCanvasOverlay = ({
  activeLeg,
  disableFlexArc,
  transitiveData
}: Props): JSX.Element => {
  const { current: map } = useMap();

  const placeFeatures = [];

  const streetEdgeFeatures = (
    (transitiveData && transitiveData.journeys) ||
    []
  ).flatMap((journey: TransitiveJourney) =>
    journey.segments
      .filter(segment => segment.streetEdges?.length > 0)
      .map(segment => ({
        ...segment,
        geometries: segment.streetEdges.map(edge => {
          return transitiveData.streetEdges.find(
            entry => entry.edge_id === edge
          );
        })
      }))
      .flatMap(segment => {
        return segment.geometries.map(geometry => {
          return {
            type: "Feature",
            properties: {
              type: "street-edge",
              color: modeColorMap[segment.type] || "#008",
              mode: segment.type
            },
            geometry: polyline.toGeoJSON(geometry.geometry.points)
          };
        });
      })
  );

  // Extract the first and last stops of each transit segment for display.
  const stopFeatures = ((transitiveData && transitiveData.journeys) || [])
    .flatMap(journey => journey.segments)
    .filter(segment => segment.type === "TRANSIT")
    .map(segment =>
      transitiveData.patterns.find(
        p => p.pattern_id === segment.patterns[0]?.pattern_id
      )
    )
    .filter(pattern => !!pattern)
    .flatMap(pattern =>
      pattern.stops.filter(
        (_, index, stopsArr) => index === 0 || index === stopsArr.length - 1
      )
    )
    .filter(
      pStop =>
        !placeFeatures.find(
          feature => feature.properties.stopId === pStop.stop_id
        )
    )
    .map(pStop =>
      // pStop (from pattern.stops) only has an id (and sometimes line geometry)
      transitiveData.stops.find(stop => stop.stop_id === pStop.stop_id)
    )
    .filter((value, index, array) => array.indexOf(value) === index)
    .map(stop => ({
      type: "Feature",
      properties: { name: stop.stop_name, type: "stop" },
      geometry: {
        type: "Point",
        coordinates: [stop.stop_lon, stop.stop_lat]
      }
    }));

  const routeFeatures = (
    (transitiveData && transitiveData.patterns) ||
    []
  ).flatMap((pattern: TransitivePattern) =>
    patternToRouteFeature(disableFlexArc, pattern, transitiveData.routes)
  );

  const geojson: GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    Record<string, unknown>
  > = {
    type: "FeatureCollection",
    features: [
      ...placeFeatures,
      ...streetEdgeFeatures,
      ...stopFeatures,
      ...routeFeatures
    ]
  };

  const zoomToGeoJSON = geoJson => {
    const b = bbox(geoJson);
    const bounds: [number, number, number, number] = [b[0], b[1], b[2], b[3]];

    if (map && bounds.length === 4 && bounds.every(Number.isFinite)) {
      map.fitBounds(bounds, {
        duration: 500,
        padding: util.getFitBoundsPadding(map, 0.2)
      });
    }
  };

  useEffect(() => {
    zoomToGeoJSON(geojson);
  }, [transitiveData]);

  useEffect(() => {
    if (!activeLeg?.legGeometry) return;
    zoomToGeoJSON(polyline.toGeoJSON(activeLeg.legGeometry.points));
  }, [activeLeg]);

  if (!transitiveData) return <></>;

  const { fromAnchor, toAnchor } = getFromToAnchors(transitiveData);

  // Generally speaking, text/symbol layers placed first will be rendered in a lower layer
  // (or, if it is text, rendered with a lower priority or not at all if higher-priority text overlaps).
  return (
    <Source data={geojson} id="itinerary" type="geojson">
      {/* First, render access legs then transit lines so that all lines appear under any text or circle
          and transit lines appears above access legs. Walking legs are under a separate layer
          because they use a different line dash that cannot be an expression. */}
      <Layer
        // This layer is for other modes - dashed path
        filter={["all", ["==", "type", "street-edge"], ["!=", "mode", "WALK"]]}
        id="street-edges"
        layout={{
          "line-cap": "butt"
        }}
        paint={{
          // TODO: get from transitive properties
          "line-color": ["get", "color"],
          "line-dasharray": [2, 1],
          // TODO: get from transitive properties
          "line-width": 4,
          "line-opacity": 0.9
        }}
        type="line"
      />
      <Layer
        filter={routeFilter}
        id="routes"
        layout={{
          "line-join": "round",
          "line-cap": "round"
        }}
        paint={{
          "line-color": ["get", "color"],
          // Apply a thinner line (width = 6) for bus routes (route_type = 3), set width to 10 otherwise.
          "line-width": ["match", ["get", "routeType"], 3, 6, 10],
          "line-opacity": 1
        }}
        type="line"
      />

      {/* Render access leg places (lowest priority) then transit stop and route labels, then origin/destination (highest priority)
          so the text appears above all graphics. */}
      <Layer
        filter={accessLegFilter}
        id="access-leg-labels"
        layout={defaultTextLayoutParams}
        paint={defaultTextPaintParams}
        type="symbol"
      />
      <Layer
        filter={stopFilter}
        id="stops-labels"
        layout={defaultTextLayoutParams}
        paint={defaultTextPaintParams}
        type="symbol"
      />
      <Layer
        // Render a solid background of fixed height using the uppercase route name.
        filter={routeFilter}
        id="routes-labels-background"
        layout={getRouteLayerLayout("nameUpper")}
        paint={{
          "text-color": ["get", "color"],
          "text-halo-color": ["get", "color"],
          "text-halo-width": 4 // Max value is 1/4 of text size per maplibre docs.
        }}
        type="symbol"
      />
      <Layer
        // This layer renders transit route names (foreground).
        filter={routeFilter}
        id="routes-labels"
        layout={getRouteLayerLayout("name")}
        paint={{
          "text-color": ["get", "textColor"]
        }}
        type="symbol"
      />
      <Layer
        filter={["==", "type", "from"]}
        id="from-label"
        layout={{
          ...defaultBoldTextLayoutParams,
          "text-anchor": fromAnchor
        }}
        paint={defaultTextPaintParams}
        type="symbol"
      />
      <Layer
        filter={["==", "type", "to"]}
        id="to-label"
        layout={{
          ...defaultBoldTextLayoutParams,
          "text-anchor": toAnchor
        }}
        paint={{
          ...defaultTextPaintParams,
          "text-color": "#910818"
        }}
        type="symbol"
      />
    </Source>
  );
};

export default TransitiveCanvasOverlay;
