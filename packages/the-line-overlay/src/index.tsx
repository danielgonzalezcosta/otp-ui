import EntityPopup from "@opentripplanner/map-popup";
import { MapLocationActionArg } from "@opentripplanner/types";
// eslint-disable-next-line prettier/prettier
import React, { useCallback, useState } from "react"
import { Popup, useControl } from "react-map-gl";
import { GeoJsonLayer } from "@deck.gl/layers/typed";
import { MVTLayer } from "@deck.gl/geo-layers/typed";
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
    <circle cx="32" cy="32" r="16" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="32" stroke-opacity="0.5"/>

    <circle cx="85" cy="21" r="16" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="10"/>
    <circle cx="85" cy="21" r="6" fill="#FFFFFF" stroke="none"/>

    <circle cx="72" cy="56" r="7" stroke="#FFFFFF" stroke-width="2" fill="none"/>
</svg>
`;

const iconMapping = {
  "super station": {
    x: 0,
    y: 0,
    width: 64,
    height: 64
  },
  station: {
    x: 64,
    y: 0,
    width: 42,
    height: 42
  },
  stop: {
    x: 64,
    y: 48,
    width: 16,
    height: 16
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
  const [clickedEntity, setClickedEntity] = useState<any>(null);
  const [farOut, setFarOut] = useState<boolean>(false);
  const [fromAbove, setFromAbove] = useState<boolean>(false);

  const tileUrl = `${tilesBaseUrl}/${otp2Layers.join(",")}/tilejson.json`;

  const layers = [];

  if (showTheLine) {
    layers.push(
      new GeoJsonLayer({
        id: `${id}-geojson-vertibase` as string,
        data: `${dataUrl}?v=vertibase-${fromAbove}` as string,
        stroked: true,
        filled: true,
        pickable: true,
        visible: false && !farOut,
        pointType: "circle",
        getPointRadius: 50,
        getLineColor: [0, 0, 0],
        getLineWidth: 4,
        getFillColor: [248, 231, 28, 128],
        autoHighlight: true,
        highlightColor: [100, 0, 0, 128],
        onDataLoad: (value: any) => {
          value.features = value.features.filter(
            v => v.properties.point === "vertibase"
          );

          if (fromAbove) {
            value.features.forEach(feature => {
              delete feature.geometry.coordinates[3];
            });
          }
        }
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-level` as string,
        data: `${dataUrl}?v=2` as string,
        stroked: true,
        filled: true,
        pickable: true,
        visible: !farOut && !fromAbove,
        getLineColor: [0, 0, 0, 128],
        getLineWidth: 4,
        getFillColor: [0, 0, 0, 0],
        autoHighlight: true,
        highlightColor: [100, 0, 0, 128],
        onDataLoad: (value: any) => {
          value.features = value.features.filter(
            v => v.properties.module && v.properties.level
          );
        }
      }),
      new GeoJsonLayer({
        id: `${id}-geojson-module-outline` as string,
        data: `${dataUrl}?v=1.1` as string,
        stroked: fromAbove && !farOut,
        extruded: !fromAbove,
        filled: farOut || fromAbove,
        wireframe: !fromAbove,
        pickable: farOut || fromAbove,
        autoHighlight: true,
        highlightColor: [100, 0, 0, 255],
        lineWidthUnits: "pixels",
        getElevation: f => (fromAbove ? 0 : f.properties.height),
        getLineColor: [0, 0, 0, 196],
        getLineWidth: 3,
        getFillColor: fromAbove ? [200, 200, 200, 196] : [220, 220, 220, 64],
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
      })
    );
  }

  if (showStopsAndStations) {
    layers.push(
      new MVTLayer({
        id: `${id}-tiles-bg` as string,
        data: tileUrl,

        minZoom: 6,
        maxZoom: 19,
        pickable: true,

        pointType: "circle",

        stroked: true,
        filled: true,
        getFillColor: [0, 0, 0, 255],
        pointBillboard: false,
        pointRadiusUnits: "pixels",
        uniqueIdProperty: "gtfsId",

        autoHighlight: true,
        highlightColor: [100, 0, 0, 255],
        getPointRadius: feature => {
          return iconMapping[classifyFeature(feature)].height / 2;
        },
        parameters: {
          depthTest: false
        }
      })
    );
    layers.push(
      new MVTLayer({
        id: `${id}-tiles-fg` as string,
        data: tileUrl,

        minZoom: 6,
        maxZoom: 19,
        pickable: false,

        pointType: "icon+text",
        parameters: {
          depthTest: false
        },

        visible: true,
        iconBillboard: false,
        iconAtlas: `data:image/svg+xml,${encodeURIComponent(iconAtlas)}`,
        iconMapping,
        iconSizeUnits: "pixels",
        iconSizeScale: 1,
        iconSizeMinPixels: 10,
        iconSizeMaxPixels: 100,
        getIconSize: feature => {
          return iconMapping[classifyFeature(feature)].height;
        },
        getIcon: feature => {
          return classifyFeature(feature);
        },
        getElevation: feature => {
          return !fromAbove && feature.properties.name.contains("Vertibase")
            ? 500
            : 0;
        },

        getText: feature =>
          classifyFeature(feature) === "stop"
            ? feature.properties.name
            : feature.properties.name.toUpperCase(),
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
        getTextColor: feature =>
          classifyFeature(feature) === "super station"
            ? [0, 0, 0, 255]
            : [255, 255, 255, 255],
        getTextBackgroundColor: feature =>
          classifyFeature(feature) === "super station"
            ? [255, 255, 255, 255]
            : [0, 0, 0, 32],
        textBackgroundPadding: [4, 4, 4, 4],
        textBackground: true,
        textFontWeight: "bold",
        textFontSettings: {
          fontSize: 32,
          sdf: true
        }
      })
    );
  }

  const onClick = useCallback(event => {
    if (event && event.object) {
      const entity = {
        id: undefined,
        name: event.object.properties.name,
        lon: event.coordinate[0],
        lat: event.coordinate[1]
      };

      if (event.object.properties.gtfsId) {
        entity.lon = event.object.geometry.coordinates[0];
        entity.lat = event.object.geometry.coordinates[1];
        entity.id = event.object.properties.gtfsId;
      } else if (event.object.properties.point === "vertibase") {
        entity.lon = event.object.geometry.coordinates[0];
        entity.lat = event.object.geometry.coordinates[1];
        entity.id = `neom:line_${event.object.properties["ref:module"]}_vertibase`;
      } else if (event.object.properties.level) {
        entity.id = `neom:line_${event.object.properties["ref:module"]}_level_${event.object.properties["ref:level"]}`;
      } else if (event.object.properties.module) {
        entity.id = `neom:line_${event.object.properties["ref:module"]}_level_0`;
      }

      setClickedEntity(entity);
    }
  }, []);

  function onViewStateChange({ viewState }) {
    setFarOut(viewState.zoom <= 13);
    setFromAbove(viewState.pitch <= 10);
  }

  function getCursor({ isHovering }) {
    return isHovering ? "pointer" : "";
  }

  return (
    <>
      <DeckGLOverlay
        id={id}
        layers={layers}
        interleaved
        onClick={onClick}
        onViewStateChange={onViewStateChange}
        getCursor={getCursor}
        alwaysShow={alwaysShow}
        visible={visible}
      />
      {clickedEntity && (
        <Popup
          latitude={clickedEntity.lat}
          longitude={clickedEntity.lon}
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
