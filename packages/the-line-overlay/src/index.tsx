import {
  ClearLocationArg,
  Itinerary,
  MapLocationActionArg,
  Place,
  UserLocation
} from "@opentripplanner/types";
// eslint-disable-next-line prettier/prettier
import React, { useCallback, useMemo, useState } from "react"
import { useControl } from "react-map-gl";
import { GeoJsonLayer, PathLayer, TextLayer } from "@deck.gl/layers/typed";
import { MVTLayer } from "@deck.gl/geo-layers/typed";
import { Color, PickingInfo } from "@deck.gl/core/typed";
import turfAlong from "@turf/along";
import turfCentroid from "@turf/centroid";
import turfLineSliceAlong from "@turf/line-slice-along";
import polyline from "@mapbox/polyline";
import { PathStyleExtension } from "@deck.gl/extensions";
import {
  DeckGlMapboxOverlay,
  DeckGlMapboxOverlayProps
} from "./deck-gl-mapbox-overlay";

function DeckGLOverlay(props: DeckGlMapboxOverlayProps) {
  const overlay = useControl<any>(() => new DeckGlMapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

const iconAtlas = `
<svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 128 64"
        height="64px"
        width="128px"
>
    <circle cx="32" cy="32" r="16" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="32" stroke-opacity="0.3"/>

    <circle cx="85" cy="21" r="16" fill="none" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="10"/>
    <circle cx="85" cy="21" r="6" fill="#FFFFFF" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="10"/>

    <circle cx="72" cy="56" r="7" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" fill-opacity="0.1"/>
    
    <circle cx="90" cy="54" r="9" stroke="#000000" stroke-width="1" fill="#FFFFFF"/>
    <circle cx="90" cy="54" r="4" fill="#000000"/>

    <circle cx="108" cy="52" r="7" stroke="#000000" stroke-width="1" fill="#FFFFFF"/>

    <g transform="translate(106.5, 0) scale(0.05)">
        <path fill="red" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path>
        <path stroke="black" stroke-width="20" fill="white" fill-opacity="0.1" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path>
    </g>
</svg>
`;

const iconMapping = {
  "super station": {
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    mask: true
  },
  station: {
    x: 64,
    y: 0,
    width: 42,
    height: 42,
    mask: true
  },
  stop: {
    x: 64,
    y: 48,
    width: 16,
    height: 16,
    mask: true
  },
  from: {
    x: 80,
    y: 44,
    width: 20,
    height: 20
  },
  place: {
    x: 100,
    y: 44,
    width: 16,
    height: 16
  },
  to: {
    x: 106,
    y: 0,
    width: 20,
    height: 27,
    anchorY: 27
  }
};

function classifyFeature(feature): "super station" | "station" | "stop" {
  if (feature.properties.stationLevel >= 2) {
    return "super station";
  }
  if (feature.properties.stationLevel >= 1) {
    return "station";
  }
  return "stop";
}

function featureFromLocation(
  renderElevation: boolean,
  location: UserLocation,
  type
) {
  return {
    type: "Feature",
    properties: {
      endpoint: type,
      place: location
    },
    geometry: {
      type: "Point",
      coordinates:
        renderElevation && location.elevation
          ? [location.lon, location.lat, location.elevation]
          : [location.lon, location.lat]
    }
  };
}

function featureFromPlace(renderElevation: boolean, place: Place, type) {
  return {
    type: "Feature",
    properties: {
      endpoint: type,
      place
    },
    geometry: {
      type: "Point",
      coordinates:
        renderElevation && place.elevation
          ? [place.lon, place.lat, place.elevation]
          : [place.lon, place.lat]
    }
  };
}

function extendWithElevationProfile(points, legElevation) {
  const linestring = polyline.toGeoJSON(points);
  if (!legElevation) {
    return [linestring];
  }

  const geometries = [];

  const elevationProfile = legElevation.split(",");

  for (let i = 0; i < elevationProfile.length - 2; i += 2) {
    const from = parseFloat(elevationProfile[i]);
    const fromElevation = parseFloat(elevationProfile[i + 1]);
    const to = parseFloat(elevationProfile[i + 2]);
    const toElevation = parseFloat(elevationProfile[i + 3]);

    if (from === to) {
      const alongPoint = turfAlong(linestring, from, { units: "meters" })
        .geometry.coordinates;
      if (!Number.isNaN(fromElevation) && !Number.isNaN(toElevation)) {
        geometries.push({
          type: "LineString",
          coordinates: [
            [...alongPoint, fromElevation],
            [...alongPoint, toElevation]
          ]
        });
      }
    } else {
      geometries.push({
        type: "LineString",
        coordinates: turfLineSliceAlong(linestring, from, to, {
          units: "meters"
        }).geometry.coordinates.map(c =>
          !Number.isNaN(fromElevation) ? [...c, fromElevation] : c
        )
      });
    }
  }

  return geometries;
}

function rgbToArray(rgba: string) {
  return [
    parseInt(rgba.slice(0, 2), 16),
    parseInt(rgba.slice(2, 4), 16),
    parseInt(rgba.slice(4, 6), 16),
    rgba.length === 8 ? parseInt(rgba.slice(6, 8), 16) : 255
  ];
}

export default function TheLineOverlay({
  id,
  clearLocation,
  setLocation,
  fromLocation,
  toLocation,
  tilesBaseUrl,
  otp2Layers,
  itinerary,
  dataUrl,
  showStopsAndStations,
  showTheLine,
  alwaysShow,
  visible
}: {
  id: string;
  name?: string;
  tilesBaseUrl: string;
  otp2Layers: string[];
  dataUrl: string;
  showStopsAndStations?: boolean;
  showTheLine?: boolean;
  itinerary: Itinerary;
  fromLocation: any;
  toLocation: any;
  pending: any;
  clearLocation?: (arg: ClearLocationArg) => void;
  setLocation?: (location: MapLocationActionArg) => void;
  alwaysShow?: boolean;
  visible?: boolean;
}): JSX.Element {
  const [hoveredEntityId, setHoveredEntityId] = useState<string>(null);
  const [farOut, setFarOut] = useState<boolean>(false);
  const [renderElevation, setRenderElevation] = useState<boolean>(false);
  const [visibleLayer15, setVisibleLayer15] = useState<boolean>(false);
  const [visibleLayer14, setVisibleLayer14] = useState<boolean>(false);

  const tileUrl = `${tilesBaseUrl}/${otp2Layers.join(",")}/tilejson.json`;

  const layers: any[] = [];

  const highlightColor: Color = [255, 207, 77];

  /* Only allow picking if there isn't an itinerary visible */
  const allowPicking = !itinerary;
  const allowClicking = !itinerary;
  const opaqueLayer = !!itinerary;

  const showEndpoints = true;

  const transitLegs = itinerary
    ? itinerary.legs.filter(
        leg => leg.transitLeg && (leg.from.elevation || leg.to.elevation)
      )
    : [];
  const transitGeoJson = useMemo(() => {
    const features = [];
    const result = {
      type: "FeatureCollection",
      features
    };

    transitLegs.forEach(leg => {
      extendWithElevationProfile(
        leg.legGeometry.points,
        renderElevation && (leg.from.elevation || leg.to.elevation)
          ? `0,${leg.from.elevation || 0},${leg.distance},${leg.to.elevation ||
              0}`
          : null
      ).forEach(geometry => {
        features.push({
          type: "Feature",
          properties: {
            routeColor: rgbToArray(leg.routeColor),
            routeType: leg.routeType
          },
          geometry
        });
      });
    });

    return result;
  }, [
    transitLegs.map(leg => leg.legGeometry.points).join(" "),
    transitLegs.map(leg => leg.routeColor).join(" "),
    transitLegs.map(leg => leg.routeType).join(" "),
    renderElevation
  ]);

  const walkLegs = itinerary
    ? itinerary.legs.filter(leg => !leg.transitLeg)
    : [];
  const walkGeoJson = useMemo(() => {
    const features = [];
    const result = {
      type: "FeatureCollection",
      features
    };

    walkLegs.forEach(leg => {
      console.log(walkLegs);
      extendWithElevationProfile(
        leg.legGeometry.points,
        renderElevation && leg.legElevation
      ).forEach(geometry => {
        features.push({
          type: "Feature",
          properties: { distance: leg.distance },
          geometry
        });
      });
    });
    console.log(result);
    return result;
  }, [walkLegs.map(leg => leg.legGeometry.points).join(" "), renderElevation]);

  const usedStopAndStationIds = new Set();
  if (itinerary) {
    itinerary.legs
      .map(leg => [
        leg.from.stopId,
        ...(leg.from.parentStopIds || []),
        leg.to.stopId,
        ...(leg.to.parentStopIds || [])
      ])
      .forEach(idGroup =>
        idGroup.forEach(itemId => usedStopAndStationIds.add(itemId))
      );
  }

  const itineraryPlaces = useMemo(() => {
    const features = [];

    (itinerary ? itinerary.legs : []).forEach(leg => {
      if (leg !== itinerary.legs[0]) {
        features.push(featureFromPlace(renderElevation, leg.from, "place"));
      }
      if (leg !== itinerary.legs[itinerary.legs.length - 1]) {
        features.push(featureFromPlace(renderElevation, leg.to, "place"));
      }
    });

    return {
      type: "FeatureCollection",
      features
    };
  }, [
    JSON.stringify(
      itinerary ? itinerary.legs.map(leg => [leg.from, leg.to]) : []
    ),
    renderElevation
  ]);

  if (showTheLine) {
    layers.push(
      new GeoJsonLayer({
        id: "neom-out",
        data: "/neom_out.geojson",
        stroked: false,
        // extruded: true,
        filled: true,
        wireframe: false,
        getLineColor: [255, 255, 255, 180],
        getLineWidth: 0,
        pickable: false,
        visible: true,
        // getElevation: f => f.properties.height,
        getFillColor: [14, 29, 52, 255],
        beforeId: "building-top"
      }),
      new GeoJsonLayer({
        id: "hidden-marina",
        data: "/hidden_marina.geojson",
        // extruded: true,
        stroked: false,
        filled: true,
        pickable: false,
        visible: true,
        // getElevation: f => f.properties.height,
        getFillColor: [14, 29, 52, 255],
        beforeId: "building-top"
      }),
      new GeoJsonLayer({
        id: "roads-overlay",
        data: "/roads_overlay.geojson",
        minZoom: 11,
        maxZoom: 19,
        stroked: true,
        // extruded: true,
        filled: true,
        wireframe: false,
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 20,
        pickable: false,
        visible: true,
        // getElevation: f => f.properties.height,
        getFillColor: [225, 225, 225, 164],
        beforeId: "building-top"
      }),
      new GeoJsonLayer({
        id: "magna-buildings",
        data: "/magna_internal.geojson",
        minZoom: 11,
        maxZoom: 19,
        stroked: true,
        // extruded: true,
        filled: true,
        wireframe: false,
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 1,
        pickable: false,
        visible: true,
        // getElevation: f => f.properties.height,
        getFillColor: [225, 225, 225, 164],
        beforeId: "building-top"
      }),
      new GeoJsonLayer({
        id: "oxagon-internal",
        data: "/oxagon_internal.geojson",
        minZoom: 11,
        maxZoom: 19,
        stroked: true,
        // extruded: true,
        filled: true,
        wireframe: false,
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 1,
        pickable: false,
        visible: true,
        // getElevation: f => f.properties.height,
        getFillColor: [225, 225, 225, 104],
        beforeId: "building-top"
      }),
      new GeoJsonLayer({
        id: "trojena-shape",
        data: "/trojena.geojson",
        stroked: true,
        // extruded: true,
        filled: true,
        wireframe: false,
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 1,
        pickable: false,
        visible: true,
        // getElevation: f => f.properties.height,
        getFillColor: [225, 225, 225, 104],
        beforeId: "building-top"
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-module` as string,
        data: `${dataUrl}?v=1.1` as string,
        updateTriggers: {
          getElevation: [renderElevation],
          getLineColor: [allowClicking, hoveredEntityId],
          getFillColor: [allowClicking, renderElevation, hoveredEntityId]
        },
        stroked: !renderElevation && !farOut,
        filled: true,
        extruded: renderElevation,
        pickable: allowPicking && (farOut || !renderElevation),
        lineWidthUnits: "pixels",
        getElevation: f => (!renderElevation ? 0 : f.properties.height),
        getLineColor: [255, 255, 255, 196],
        getLineWidth: 4,
        getFillColor: feature => {
          if (
            allowClicking &&
            (farOut || !renderElevation) &&
            feature.properties.gtfsId === hoveredEntityId
          ) {
            return [...highlightColor, !renderElevation ? 255 : 128] as [
              number,
              number,
              number,
              number
            ];
          }
          return !renderElevation
            ? [200, 200, 200, 196]
            : farOut
            ? [220, 220, 220, 64]
            : [128, 128, 128, 128];
        },
        onDataLoad: (value: any) => {
          value.features = value.features.filter(
            v => v.properties.module && !v.properties.level
          );
        }
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-level` as string,
        data: `${dataUrl}?v=2` as string,
        updateTriggers: {
          getFillColor: [allowClicking, hoveredEntityId]
        },
        parameters: {
          depthTest: false
        },
        filled: true,
        wireframe: true,
        pickable: allowPicking,
        extruded: true,
        visible: !farOut && renderElevation,
        getElevation: f => f.properties.height,
        getLineColor: [255, 255, 255, 196],
        getLineWidth: 4,
        getFillColor: feature => {
          if (allowClicking && feature.properties.gtfsId === hoveredEntityId) {
            return [...highlightColor, 128] as [number, number, number, number];
          }
          return [0, 0, 0, 0];
        },
        onDataLoad: (value: any) => {
          value.features = value.features.filter(
            v => v.properties.module >= 0 && v.properties.level >= 0
          );
        }
      }),
      new GeoJsonLayer({
        id: "hidden-marina-line",
        data: "/hidden_marina_the_line.geojson",
        minZoom: 15,
        maxZoom: 22,
        parameters: {
          depthTest: false
        },

        updateTriggers: {
          getIconColor: [opaqueLayer, hoveredEntityId],
          getText: [opaqueLayer, hoveredEntityId],
          getTextPixelOffset: [opaqueLayer, hoveredEntityId],
          getTextColor: [opaqueLayer, hoveredEntityId],
          getTextBackgroundColor: [opaqueLayer, hoveredEntityId]
        },

        pickable: true,
        visible: renderElevation,
        pointType: "icon+text",
        iconBillboard: true,
        iconAtlas: `data:image/svg+xml,${encodeURIComponent(iconAtlas)}`,
        iconMapping,
        iconSizeUnits: "pixels",
        iconSizeScale: 1,
        iconSizeMinPixels: 10,
        iconSizeMaxPixels: 100,
        getIconSize: feature => feature && iconMapping.stop.height,
        getIcon: feature => feature && "stop",
        getIconColor: feature => {
          if (usedStopAndStationIds.has(feature.properties.gtfsId)) {
            return [255, 255, 255, 255];
          }
          if (feature.properties.gtfsId === hoveredEntityId) {
            return [...highlightColor, 255];
          }
          return [255, 255, 255, 255];
        },

        getText: feature =>
          feature.properties.gtfsId !== hoveredEntityId
            ? feature.properties.name
            : feature.properties.name,
        getTextAnchor: "middle",
        getTextAlignmentBaseline: "top",
        getTextPixelOffset: feature =>
          feature.properties.gtfsId !== hoveredEntityId
            ? [0, iconMapping[classifyFeature(feature)].width / 2 + 10]
            : [0, iconMapping[classifyFeature(feature)].width / 2 + 10],
        getTextSize: 14,
        getTextColor: feature => {
          if (feature.properties.gtfsId !== hoveredEntityId || opaqueLayer) {
            return [255, 255, 255, 255];
          }

          return [...highlightColor, 255];
        },
        getTextBackgroundColor: feature => {
          if (feature.properties.gtfsId !== hoveredEntityId || opaqueLayer) {
            return [0, 0, 0, 64];
          }

          return [0, 0, 0, 64];
        },
        textBackgroundPadding: [20, 8, 20, 8],
        textBackground: true,
        textFontFamily: "Brown-Regular",
        textFontSettings: {
          fontSize: 36,
          sdf: true,
          fontFamily: "Brown-Regular"
        }
      }),
      new GeoJsonLayer({
        id: "hidden-marina-line-other",
        data: "/hidden_marina_the_line_other.geojson",
        minZoom: 15,
        maxZoom: 22,
        parameters: {
          depthTest: false
        },

        updateTriggers: {
          getIconColor: [opaqueLayer, hoveredEntityId],
          getText: [opaqueLayer, hoveredEntityId],
          getTextPixelOffset: [opaqueLayer, hoveredEntityId],
          getTextColor: [opaqueLayer, hoveredEntityId],
          getTextBackgroundColor: [opaqueLayer, hoveredEntityId]
        },

        pickable: true,
        visible: renderElevation && visibleLayer15,
        pointType: "icon+text",
        iconBillboard: true,
        iconAtlas: `data:image/svg+xml,${encodeURIComponent(iconAtlas)}`,
        iconMapping,
        iconSizeUnits: "pixels",
        iconSizeScale: 1,
        iconSizeMinPixels: 10,
        iconSizeMaxPixels: 100,
        getIconSize: feature => feature && iconMapping.stop.height,
        getIcon: feature => feature && "stop",
        getIconColor: feature => {
          if (usedStopAndStationIds.has(feature.properties.gtfsId)) {
            return [255, 255, 255, 255];
          }
          if (feature.properties.gtfsId === hoveredEntityId) {
            return [...highlightColor, 255];
          }
          return [255, 255, 255, 255];
        },

        getText: feature =>
          feature.properties.gtfsId !== hoveredEntityId
            ? feature.properties.name
            : feature.properties.name,
        getTextAnchor: "middle",
        getTextAlignmentBaseline: "top",
        getTextPixelOffset: feature =>
          feature.properties.gtfsId !== hoveredEntityId
            ? [0, iconMapping[classifyFeature(feature)].width / 2 + 10]
            : [0, iconMapping[classifyFeature(feature)].width / 2 + 10],
        getTextSize: 14,
        getTextColor: feature => {
          if (feature.properties.gtfsId !== hoveredEntityId || opaqueLayer) {
            return [255, 255, 255, 255];
          }

          return [...highlightColor, 255];
        },
        getTextBackgroundColor: feature => {
          if (feature.properties.gtfsId !== hoveredEntityId || opaqueLayer) {
            return [0, 0, 0, 64];
          }

          return [0, 0, 0, 64];
        },
        textBackgroundPadding: [20, 8, 20, 8],
        textBackground: true,
        textFontFamily: "Brown-Regular",
        textFontSettings: {
          fontSize: 36,
          sdf: true,
          fontFamily: "Brown-Regular"
        }
      }),
      new GeoJsonLayer({
        id: "names-line",
        data: "/names_the_line.geojson",
        minZoom: 9,
        maxZoom: 22,
        parameters: {
          depthTest: false
        },
        pickable: false,
        visible: visibleLayer14,
        iconMapping,
        pointType: "text",
        getText: (feature: { properties: { name: any } }) =>
          feature.properties.name,
        getTextAnchor: "middle",
        getTextSize: 14,
        getTextColor: [255, 255, 255, 255],
        textFontFamily: "Brown-Regular",
        textFontSettings: {
          fontSize: 36,
          sdf: true,
          fontFamily: "Brown-Regular"
        }
      }),
      new TextLayer({
        id: `${id}-biglables` as string,
        data: "../biglabels.json",
        background: true,
        backgroundPadding: [20, 8, 20, 8],
        fontFamily: "Brown-Regular",
        getAlignmentBaseline: "center",
        getAngle: 0,
        getColor: [0, 0, 0],
        getPosition: d => d.coordinates,
        getSize: 16,
        getText: d => d.name,
        getTextAnchor: "middle",
        sizeScale: 1,
        pickable: false,
        visible: !opaqueLayer
        // wrapLongitude: false,
      })
    );
  }

  if (itinerary) {
    layers.push(
      new PathLayer({
        id: `${id}-transit-legs` as string,
        data: transitGeoJson.features,
        parameters: {
          depthTest: false
        },

        stroked: true,
        billboard: true,
        capRounded: true,
        joinRounded: true,
        widthUnits: "pixels",
        dashJustified: true,
        getColor: feature => feature.properties.routeColor,
        getWidth: feature =>
          feature.properties.routeType === 3 ||
          feature.properties.routeType === 1600
            ? 6
            : 10,
        getPath: feature => feature.geometry.coordinates

        // beforeId: 'access-leg-labels'
      })
    );

    layers.push(
      new PathLayer({
        id: `${id}-walk-legs` as string,
        data: walkGeoJson.features,
        extensions: [
          new PathStyleExtension({
            dash: true,
            highPrecisionDash: false
          })
        ],
        parameters: {
          depthTest: false
        },

        stroked: true,
        billboard: true,
        capRounded: true,
        joinRounded: true,
        widthUnits: "pixels",
        dashJustified: true,
        getColor: [255, 255, 231, 224],
        getDashArray: [0, 3],
        getWidth: 6,
        getPath: feature => feature.geometry.coordinates,

        beforeId: `${id}-transit-legs`
      })
    );
  }

  if (itineraryPlaces.features.length) {
    layers.push(
      new GeoJsonLayer({
        id: `${id}-place-icon` as string,
        data: itineraryPlaces,

        minZoom: 6,
        maxZoom: 19,
        visible: true,

        pointType: "icon",
        parameters: {
          depthTest: false
        },
        // getText: feature => feature.properties.place.name,
        // getTextSize: 16,
        iconBillboard: true,
        iconAtlas: `data:image/svg+xml,${encodeURIComponent(iconAtlas)}`,
        iconMapping,
        iconSizeUnits: "pixels",
        iconSizeScale: 1,
        iconSizeMinPixels: 10,
        iconSizeMaxPixels: 100,
        getIconSize: feature => iconMapping[feature.properties.endpoint].height,
        getIcon: feature => feature.properties.endpoint
      })
    );
  }

  if (showStopsAndStations) {
    layers.push(
      new MVTLayer({
        id: `${id}-tiles-icons` as string,
        data: tileUrl,
        updateTriggers: {
          getIconColor: [opaqueLayer, hoveredEntityId]
        },

        minZoom: 6,
        maxZoom: 19,
        visible: true,
        pickable: allowPicking,

        pointType: "icon",
        parameters: {
          depthTest: false
        },

        // extensions: [new CollisionFilterExtension()],
        // collisionGroup: 'legend'

        iconBillboard: false,
        iconAtlas: `data:image/svg+xml,${encodeURIComponent(iconAtlas)}`,
        iconMapping,
        iconSizeUnits: "pixels",
        iconSizeScale: 1,
        iconSizeMinPixels: 10,
        iconSizeMaxPixels: 100,
        getIconSize: feature => iconMapping[classifyFeature(feature)].height,
        getIcon: feature => classifyFeature(feature),
        getIconColor: feature => {
          if (usedStopAndStationIds.has(feature.properties.gtfsId)) {
            return [255, 255, 255, 0];
          }
          if (feature.properties.gtfsId === hoveredEntityId) {
            return [...highlightColor, 255];
          }
          if (
            opaqueLayer &&
            !usedStopAndStationIds.has(feature.properties.gtfsId)
          ) {
            return [255, 255, 255, 64];
          }
          return [255, 255, 255, 255];
        }
      }),

      new MVTLayer({
        id: `${id}-tiles-labels` as string,
        data: tileUrl,
        updateTriggers: {
          getTextColor: [opaqueLayer, hoveredEntityId],
          getTextBackgroundColor: [opaqueLayer, hoveredEntityId]
        },

        minZoom: 6,
        maxZoom: 19,
        visible: true,
        pickable: false,

        pointType: "text",
        parameters: {
          depthTest: false
        },
        getText: feature => {
          return classifyFeature(feature) === "stop"
            ? feature.properties.name
            : feature.properties.name.toUpperCase();
        },
        getTextAnchor: feature =>
          classifyFeature(feature) === "super station" ? "middle" : "middle",
        getTextAlignmentBaseline: feature =>
          classifyFeature(feature) === "super station" ? "top" : "top",
        getTextPixelOffset: feature =>
          classifyFeature(feature) === "super station"
            ? [0, iconMapping[classifyFeature(feature)].width / 2 + 25]
            : [0, iconMapping[classifyFeature(feature)].width / 2 + 10],
        getTextSize: feature =>
          classifyFeature(feature) === "super station" ? 16 : 14,
        getTextColor: feature => {
          if (feature.properties.gtfsId !== hoveredEntityId && opaqueLayer) {
            return [0, 0, 0, 0];
          }
          if (feature.properties.name === "LOTL Asset") {
            return [0, 0, 0, 0];
          }

          if (feature.properties.gtfsId === hoveredEntityId) {
            return classifyFeature(feature) === "super station"
              ? [0, 0, 0, 255]
              : [...highlightColor, 255];
          }

          return classifyFeature(feature) === "super station"
            ? [0, 0, 0, 255]
            : [255, 255, 255, 255];
        },
        getTextBackgroundColor: feature => {
          if (feature.properties.gtfsId !== hoveredEntityId && opaqueLayer) {
            return [0, 0, 0, 0];
          }
          if (feature.properties.name === "LOTL Asset") {
            return [0, 0, 0, 0];
          }

          if (feature.properties.gtfsId === hoveredEntityId) {
            return classifyFeature(feature) === "super station"
              ? [...highlightColor, 255]
              : [0, 0, 0, 32];
          }

          return classifyFeature(feature) === "super station"
            ? [255, 255, 255, 255]
            : [0, 0, 0, 32];
        },
        textBackgroundPadding: [20, 8, 20, 8],
        textBackground: true,
        textFontFamily: "Brown-Regular",
        textFontSettings: {
          fontSize: 34,
          sdf: true,
          fontFamily: "Brown-Regular"
        }
      })
    );
  }

  if (showEndpoints) {
    const endpointGeoJson = {
      type: "FeatureCollection",
      features: []
    };

    if (itinerary) {
      endpointGeoJson.features.push(
        featureFromPlace(renderElevation, itinerary.legs[0].from, "from")
      );

      endpointGeoJson.features.push(
        featureFromPlace(
          renderElevation,
          itinerary.legs[itinerary.legs.length - 1].to,
          "to"
        )
      );
    } else {
      if (fromLocation) {
        endpointGeoJson.features.push(
          featureFromLocation(renderElevation, fromLocation, "from")
        );
      }
      if (toLocation) {
        endpointGeoJson.features.push(
          featureFromLocation(renderElevation, toLocation, "to")
        );
      }
    }

    layers.push(
      new GeoJsonLayer({
        id: `${id}-endpoints` as string,
        data: endpointGeoJson,
        updateTriggers: {
          getTextColor: [allowClicking],
          getTextBackgroundColor: [allowClicking]
        },
        minZoom: 6,
        maxZoom: 19,
        visible: true,
        pickable: true,

        pointType: "icon+text",
        parameters: {
          depthTest: false
        },
        getTextSize: 16,
        getText: feature => feature.properties.place.name.toUpperCase(),
        getTextColor: () => (allowClicking ? [0, 0, 0, 0] : [0, 0, 0, 255]),
        getTextBackgroundColor: () =>
          allowClicking ? [255, 255, 255, 0] : [255, 255, 255, 255],
        textBackgroundPadding: [20, 8, 20, 8],
        getTextPixelOffset: [0, -55],
        textBackground: true,
        textFontFamily: "Brown-Regular",
        iconBillboard: true,
        iconAtlas: `data:image/svg+xml,${encodeURIComponent(iconAtlas)}`,
        iconMapping,
        iconSizeUnits: "pixels",
        iconSizeScale: 1,
        iconSizeMinPixels: 10,
        iconSizeMaxPixels: 100,
        getIconSize: feature => iconMapping[feature.properties.endpoint].height,
        getIcon: feature => feature.properties.endpoint
      })
    );
  }

  const onClick = useCallback((info: PickingInfo) => {
    if (allowClicking && info && info.object) {
      if (info.object.properties.endpoint) {
        clearLocation({
          locationType: info.object.properties.endpoint as string
        });
      } else {
        const centroid = turfCentroid(info.object);
        const firstPoint =
          info.object.geometry.type === "Polygon"
            ? info.object.geometry.coordinates[0][0]
            : info.object.geometry.coordinates;
        const elevation =
          firstPoint.length === 3
            ? firstPoint[2]
            : info.object.properties.elevation;

        setLocation({
          locationType: "automatic",
          location: {
            name: info.object.properties.name,
            stopId: info.object.properties.gtfsId,
            lon: centroid.geometry.coordinates[0],
            lat: centroid.geometry.coordinates[1],
            elevation
          }
        });
      }
    }
  }, []);

  const onHover = useCallback((info: PickingInfo): void => {
    if (info?.object?.properties.gtfsId) {
      setHoveredEntityId(info.object.properties.gtfsId);
    } else {
      setHoveredEntityId(null);
    }
  }, []);

  function onViewStateChange({ viewState }) {
    setFarOut(viewState.zoom <= 13);
    setRenderElevation(viewState.pitch > 10);
    setVisibleLayer15(viewState.zoom >= 15);
    setVisibleLayer14(viewState.zoom >= 14);
  }

  function getCursor({ isHovering }): string {
    return isHovering ? "pointer" : "";
  }

  return (
    <>
      <DeckGLOverlay
        id={id}
        layers={layers}
        interleaved
        getCursor={getCursor}
        onClick={onClick}
        onHover={onHover}
        onViewStateChange={onViewStateChange}
        alwaysShow={alwaysShow}
        visible={visible}
      />
    </>
  );
}
