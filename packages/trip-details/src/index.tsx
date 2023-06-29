import flatten from "flat";
import React, { ReactElement } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { humanizeDistanceString } from "@opentripplanner/humanize-distance";
import * as S from "./styled";
import TripDetail from "./trip-detail";
import FareLegTable from "./fare-table";
import { boldText } from "./utils";

import { TripDetailsProps } from "./types";

// Load the default messages.
import defaultEnglishMessages from "../i18n/en-US.yml";

// HACK: We should flatten the messages loaded above because
// the YAML loaders behave differently between webpack and our version of jest:
// - the yaml loader for webpack returns a nested object,
// - the yaml loader for jest returns messages with flattened ids.
const defaultMessages: Record<string, string> = flatten(defaultEnglishMessages);

/**
 * Renders trip details such as departure instructions, fare amount, and minutes active.
 */
export function TripDetails({
  className = "",
  useMetricUnits,
  itinerary
}: TripDetailsProps): ReactElement {
  const intl = useIntl();

  const totalDuration = itinerary.duration;

  const totalTripDistance = itinerary.legs
    .filter(leg => typeof leg.distance === "number")
    .map(leg => leg.distance)
    .reduce((prev, current) => prev + current, 0);
  const formattedTotalTripDistance = humanizeDistanceString(
    totalTripDistance,
    useMetricUnits,
    false,
    intl
  );

  const averageSpeed = Math.round((totalTripDistance / totalDuration) * 3.6);

  return (
    <S.TripDetails className={className}>
      {/* this can be presentation as S.TripDetails is already labeled by this */}
      <S.TripDetailsHeader id="trip-details-header">
        <FormattedMessage
          defaultMessage={defaultMessages["otpUi.TripDetails.title"]}
          description="Title (heading) text of the component."
          id="otpUi.TripDetails.title"
        />
      </S.TripDetailsHeader>
      <S.TripDetailsBody className="trip-details-body">
        {totalTripDistance > 0 && (
          <TripDetail
            summary={
              <S.Timing className="trip-details-distance">
                <FormattedMessage
                  defaultMessage={
                    defaultMessages["otpUi.TripDetails.totalDistance"]
                  }
                  description="Text showing the total distance for a trip."
                  id="otpUi.TripDetails.totalDistance"
                  values={{
                    totalTripDistance: formattedTotalTripDistance,
                    strong: boldText
                  }}
                />
              </S.Timing>
            }
          />
        )}
        {totalDuration > 0 && (
          <TripDetail
            summary={
              <S.Timing className="trip-details-duration">
                <FormattedMessage
                  defaultMessage={
                    defaultMessages["otpUi.TripDetails.totalDuration"]
                  }
                  description="Text showing the total duration for a trip."
                  id="otpUi.TripDetails.totalDuration"
                  values={{
                    minutes: Math.round(totalDuration / 60),
                    strong: boldText
                  }}
                />
              </S.Timing>
            }
          />
        )}
        {averageSpeed > 0 && (
          <TripDetail
            summary={
              <S.Timing className="trip-details-speed">
                <FormattedMessage
                  defaultMessage={
                    defaultMessages["otpUi.TripDetails.averageSpeed"]
                  }
                  description="Text showing the average speed for a trip."
                  id="otpUi.TripDetails.averageSpeed"
                  values={{
                    averageSpeedInKmh: averageSpeed,
                    strong: boldText
                  }}
                />
              </S.Timing>
            }
          />
        )}
      </S.TripDetailsBody>
    </S.TripDetails>
  );
}

export default TripDetails;

// Rename styled components for export.
export { S as Styled, FareLegTable };
