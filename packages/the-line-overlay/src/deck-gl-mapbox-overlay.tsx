import { MapboxOverlay, MapboxOverlayProps } from "@deck.gl/mapbox/typed";
import { ViewStateChangeParameters } from "@deck.gl/core/typed/controllers/controller";

type Map = any;

export interface DeckGlMapboxOverlayProps extends MapboxOverlayProps {
  alwaysShow?: boolean;
  interleaved?: boolean;
  visible?: boolean;
}

export class DeckGlMapboxOverlay extends MapboxOverlay {
  private map: Map;

  private viewState?: ViewStateChangeParameters;

  private readonly onViewStateChange?: (
    params: ViewStateChangeParameters & { viewId: string }
  ) => any;

  constructor(props: DeckGlMapboxOverlayProps) {
    super(props);
    this.onViewStateChange = props.onViewStateChange;
  }

  onAdd(map: Map): HTMLDivElement {
    this.map = map;
    map.on("render", this.updateViewState);
    return super.onAdd(map);
  }

  onRemove(): void {
    const map = this.map;
    map.off("render", this.updateViewState);
    super.onRemove();
  }

  updateViewState = (): void => {
    const prefix = "_";
    const viewState = this.map[`${prefix}_deck`].props.viewState;
    if (this.onViewStateChange && viewState) {
      const oldViewState = this.viewState;
      const newViewState = {
        viewState,
        interactionState: {},
        oldViewState,
        viewId: ""
      };
      this.viewState = newViewState;
      this.onViewStateChange(newViewState);
    }
  };
}
