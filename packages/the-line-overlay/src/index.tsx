import EntityPopup from "@opentripplanner/map-popup";
import { MapLocationActionArg } from "@opentripplanner/types";
// eslint-disable-next-line prettier/prettier
import React, { useCallback, useState } from "react"
import { Popup, useControl } from "react-map-gl";
import { GeoJsonLayer, TextLayer } from "@deck.gl/layers/typed";
import { MVTLayer } from "@deck.gl/geo-layers/typed";
import { PickingInfo } from "@deck.gl/core/typed";
import turfCentroid from "@turf/centroid";
import {
  DeckGlMapboxOverlay,
  DeckGlMapboxOverlayProps
} from "./deck-gl-mapbox-overlay";

// import { CollisionFilterExtension } from "@deck.gl/extensions";

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

export default function TheLineOverlay({
  id,
  setLocation,
  setViewedStop,
  tilesBaseUrl,
  otp2Layers,
  itinerary,
  pending,
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
  itinerary: any;
  pending: any;
  /**
   * A method fired when a stop is selected as from or to in the default popup. If this method
   * is not passed, the from/to buttons will not be shown.
   */
  setLocation?: (location: MapLocationActionArg) => void;
  /**
   * A method fired when the stop viewer is opened in the default popup. If this method is
   * not passed, the stop viewer link will not be shown.
   */
  setViewedStop?: ({ stopId }: { stopId: string }) => void;
  alwaysShow?: boolean;
  visible?: boolean;
}): JSX.Element {
  const [hoveredEntityId, setHoveredEntityId] = useState<string>(null);
  const [clickedEntity, setClickedEntity] = useState<any>(null);
  const [farOut, setFarOut] = useState<boolean>(false);
  const [fromAbove, setFromAbove] = useState<boolean>(false);

  const tileUrl = `${tilesBaseUrl}/${otp2Layers.join(",")}/tilejson.json`;

  const layers: any[] = [];

  const highlightColor = [255, 207, 77];

  if (showTheLine) {
    layers.push(
      new GeoJsonLayer({
        id: `${id}-geojson-building-base` as string,
        data: `${dataUrl}?v=1` as string,
        stroked: false,
        extruded: !fromAbove,
        filled: true,
        wireframe: false,
        pickable: false,
        visible: farOut || fromAbove,
        getElevation: f => (fromAbove ? 0 : f.properties.height),
        getFillColor: [225, 225, 225, 64],
        onDataLoad: (value: any) => {
          value.features = value.features.filter(v => v.properties.building);
        }
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-level` as string,
        data: `${dataUrl}?v=2` as string,
        updateTriggers: {
          getFillColor: [hoveredEntityId]
        },
        stroked: true,
        filled: true,
        pickable: true,
        visible: !farOut && !fromAbove,
        getLineColor: [0, 0, 0, 128],
        getLineWidth: 4,
        getFillColor: feature => {
          if (feature.properties.gtfsId === hoveredEntityId) {
            return [...highlightColor, 128] as [number, number, number, number];
          }
          return [0, 0, 0, 0];
        },
        onDataLoad: (value: any) => {
          value.features = value.features.filter(
            v => v.properties.module && v.properties.level
          );
        }
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-module-outline` as string,
        data: `${dataUrl}?v=1.1` as string,
        updateTriggers: {
          getElevation: [fromAbove],
          getFillColor: [fromAbove, hoveredEntityId]
        },
        stroked: fromAbove && !farOut,
        extruded: !fromAbove,
        filled: farOut || fromAbove,
        wireframe: !fromAbove,
        pickable: farOut || fromAbove,
        lineWidthUnits: "pixels",
        getElevation: f => (fromAbove ? 0 : f.properties.height),
        getLineColor: [0, 0, 0, 196],
        getLineWidth: 3,
        getFillColor: feature => {
          if (feature.properties.gtfsId === hoveredEntityId) {
            return [...highlightColor, fromAbove ? 255 : 128] as [
              number,
              number,
              number,
              number
            ];
          }
          return fromAbove ? [200, 200, 200, 196] : [220, 220, 220, 64];
        },
        onDataLoad: (value: any) => {
          value.features = value.features.filter(
            v => v.properties.module && !v.properties.level
          );
        }
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-building-fill` as string,
        data: `${dataUrl}?v=1` as string,
        stroked: false,
        extruded: true,
        filled: true,
        wireframe: false,
        getLineColor: [0, 0, 0, 16],
        getLineWidth: 4,
        pickable: false,
        visible: !farOut && !fromAbove,
        getElevation: f => f.properties.height,
        getFillColor: [225, 225, 225, 64],
        onDataLoad: (value: any) => {
          value.features = value.features.filter(v => v.properties.building);
        }
      }),
      new TextLayer({
        id: "biglabels",
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
        visible: true
        // wrapLongitude: false,
      })
    );
  }

  if (showStopsAndStations) {
    layers.push(
      new MVTLayer({
        id: `${id}-tiles-icons` as string,
        data: tileUrl,
        updateTriggers: {
          getIconColor: [!!itinerary, !!pending, hoveredEntityId],
          getText: [!!itinerary, !!pending, hoveredEntityId],
          getTextColor: [!!itinerary, !!pending, hoveredEntityId],
          getTextBackgroundColor: [!!itinerary, !!pending, hoveredEntityId]
        },

        minZoom: 6,
        maxZoom: 19,
        visible: true,
        pickable: true,

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
          if (feature.properties.gtfsId === hoveredEntityId) {
            return highlightColor;
          }
          return [255, 255, 255, itinerary || pending ? 64 : 255];
        }
      }),

      new MVTLayer({
        id: `${id}-tiles-labels` as string,
        data: tileUrl,
        updateTriggers: {
          getIconColor: [!!itinerary, !!pending, hoveredEntityId],
          getText: [!!itinerary, !!pending, hoveredEntityId],
          getTextColor: [!!itinerary, !!pending, hoveredEntityId],
          getTextBackgroundColor: [!!itinerary, !!pending, hoveredEntityId]
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
          classifyFeature(feature) === "super station" ? "middle" : "end",
        getTextAlignmentBaseline: feature =>
          classifyFeature(feature) === "super station" ? "top" : "center",
        getTextPixelOffset: feature =>
          classifyFeature(feature) === "super station"
            ? [0, iconMapping[classifyFeature(feature)].width / 2 + 10]
            : [-(iconMapping[classifyFeature(feature)].width / 2) - 4, 0],
        getTextSize: feature =>
          classifyFeature(feature) === "super station" ? 14 : 10,
        getTextColor: feature => {
          if (
            feature.properties.gtfsId !== hoveredEntityId &&
            (itinerary || pending)
          ) {
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
          if (
            feature.properties.gtfsId !== hoveredEntityId &&
            (itinerary || pending)
          ) {
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
          fontSize: 32,
          sdf: true,
          fontFamily: "Brown-Regular"
        }
      })
    );
  }

  const onClick = useCallback((info: PickingInfo) => {
    if (info && info.object) {
      const centroid = turfCentroid(info.object);
      const entity = {
        id: info.object.properties.gtfsId,
        name: info.object.properties.name,
        lon: centroid.geometry.coordinates[0],
        lat: centroid.geometry.coordinates[1],
        popupLon: info.coordinate[0],
        popupLat: info.coordinate[1]
      };

      setClickedEntity(entity);
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
    setFromAbove(viewState.pitch <= 10);
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
      {clickedEntity && (
        <Popup
          latitude={clickedEntity.popupLat}
          longitude={clickedEntity.popupLon}
          maxWidth="100%"
          onClose={() => setClickedEntity(null)}
        >
          <EntityPopup
            entity={{ ...clickedEntity, id: clickedEntity.id }}
            setLocation={
              setLocation
                ? location => {
                    setClickedEntity(null);
                    setLocation(location);
                  }
                : null
            }
            setViewedStop={setViewedStop}
          />
        </Popup>
      )}
    </>
  );
}
