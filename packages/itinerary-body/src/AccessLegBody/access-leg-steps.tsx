// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore FIXME: Create TypeScript types for the icons package.
import { DirectionIcon } from "@opentripplanner/icons";
import React, { ReactElement } from "react";
import { Step } from "@opentripplanner/types";

import * as S from "../styled";
import MapillaryButton from "./mapillary-button";
import AccessLegStep from "../defaults/access-leg-step";

interface Props {
  mapillaryCallback?: (id: string) => void;
  mapillaryKey?: string;
  steps: Step[];
  useMetricUnits: boolean;
}

/**
 * Renders a turn-by-turn step of an access leg.
 */
export default function AccessLegSteps({
  steps,
  mapillaryCallback,
  mapillaryKey,
  useMetricUnits
}: Props): ReactElement {
  return (
    <S.Steps>
      {steps.map((step, k) => {
        const { lat, lon, relativeDirection } = step;
        return (
          <S.StepRow key={k}>
            <S.StepIconContainer>
              <DirectionIcon relativeDirection={relativeDirection} />
            </S.StepIconContainer>

            <S.StepDescriptionContainer>
              <AccessLegStep step={step} useMetricUnits={useMetricUnits} />
              <MapillaryButton
                clickCallback={mapillaryCallback}
                coords={{ lat, lon }}
                mapillaryKey={mapillaryKey}
              />
            </S.StepDescriptionContainer>
          </S.StepRow>
        );
      })}
    </S.Steps>
  );
}
