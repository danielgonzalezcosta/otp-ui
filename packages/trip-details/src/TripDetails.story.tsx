import flatten from "flat";
import React, { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { Meta, Story as StoryType } from "@storybook/react";
import styled from "styled-components";
// The below eslint-disable is due to https://github.com/storybookjs/storybook/issues/13408
// eslint-disable-next-line import/no-named-as-default
import TripDetails from ".";
import * as TripDetailsClasses from "./styled";
import {
  CaloriesDetailsProps,
  DepartureDetailsProps,
  FareDetailsProps,
  TripDetailsProps
} from "./types";

import englishMessages from "../i18n/en-US.yml";
import frenchMessages from "../i18n/fr.yml";
import customMessages from "../__mocks__/custom-messages.yml";

/**
 * Describes args passed to stories.
 */
interface StoryArgs {
  locale?: string;
  useCustomMessages?: boolean;
  useLocalizedMessages?: boolean;
}

// import mock itinaries. These are all trip plan outputs from OTP.
const bikeOnlyItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/bike-only.json");
const bikeRentalItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/bike-rental.json");
const bikeRentalTransitBikeRentalItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/bike-rental-transit-bike-rental.json");
const bikeTransitBikeItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/bike-transit-bike.json");
const eScooterRentalItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/e-scooter-rental.json");
const eScooterRentalTransiteScooterRentalItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/e-scooter-transit-e-scooter.json");
const parkAndRideItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/park-and-ride.json");
const tncTransitTncItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/tnc-transit-tnc.json");
const walkInterlinedTransitItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/walk-interlined-transit-walk.json");
const walkOnlyItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/walk-only.json");
const walkTransitWalkItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/walk-transit-walk.json");
const walkTransitWalkTransitWalkItinerary = require("@opentripplanner/itinerary-body/src/__mocks__/itineraries/walk-transit-walk-transit-walk.json");

// Change currency code on one of the itineraries for illustration.
// (other currency fields in the itinerary object are not used for display).
const itinCurrency =
  walkTransitWalkTransitWalkItinerary.fare.fare.regular.currency;
itinCurrency.currencyCode = "EUR";

const StyledTripDetails = styled(TripDetails)`
  ${TripDetailsClasses.TripDetailsHeader} {
    background-color: pink;
  }
`;

const longDateFormat = "MMMM D, YYYY";

const customKeyMap = {
  regular: "Transit Fare",
  student: "Student Fare",
  senior: "Senior Fare",
  tram: "Tram Fare",
  special: "Special Fare",
  youth: "Youth Fare",
  electronicRegular: "Orca Fare",
  electronicYouth: "Orca Youth Fare",
  electronicSpecial: "Orca Special Fare",
  electronicSenior: "Orca Senior Fare"
};

// Custom slots for expandable detail sections.
const CustomDepartureDetails = ({
  departureDate
}: DepartureDetailsProps): ReactElement => (
  <>
    Custom messages about {departureDate.format(longDateFormat)} can be
    constructed dynamically using any markup.
  </>
);

const CustomFareDetails = ({
  maxTNCFare,
  minTNCFare,
  transitFares
}: FareDetailsProps): ReactElement => (
  <>
    Custom details about fares (transitFares: {JSON.stringify(transitFares)}{" "}
    (cents), minTNCFare: {minTNCFare} and maxTNCFare: {maxTNCFare} can be
    constructed dynamically using any markup.
  </>
);

const CustomCaloriesDetails = ({
  bikeSeconds,
  calories,
  walkSeconds
}: CaloriesDetailsProps): ReactElement => (
  <>
    Custom message about {calories} calories burned,
    {walkSeconds} seconds and {bikeSeconds} seconds.
  </>
);

/**
 * Create a template component for each TripDetails story.
 * A Component argument is passed. Once bound,
 * the Component to render should not change.
 * @param Component The component to render.
 */
function createTripDetailsTemplate(
  Component: React.ElementType<TripDetailsProps> = TripDetails
) {
  const TripDetailsTemplate = ({
    CaloriesDetails,
    DepartureDetails,
    FareDetails,
    itinerary
  }: TripDetailsProps): ReactElement => (
    <Component
      CaloriesDetails={CaloriesDetails}
      DepartureDetails={DepartureDetails}
      FareDetails={FareDetails}
      itinerary={itinerary}
    />
  );
  return TripDetailsTemplate;
}

const intlDecorator = (
  Story: StoryType,
  context: {
    args: StoryArgs;
  }
): ReactElement => {
  const { args } = context;
  const { locale, useCustomMessages, useLocalizedMessages } = args;
  const messages = locale === "en-US" ? englishMessages : frenchMessages;

  // Construct a messages object that customizes a subset
  // of the default messages of the desired locale.
  // The structure of the message objects is
  // flattened before it is passed to IntlProvider.
  // Note: the spread operator (...) is rejected if used with flatten,
  // so we use Object.assign instead
  // (see e.g. https://github.com/Microsoft/TypeScript/issues/10727#issuecomment-423712256).
  let mergedMessages: Record<string, string> = flatten(messages);
  if (useCustomMessages) {
    mergedMessages = Object.assign(mergedMessages, flatten(customMessages));
  }
  return (
    <IntlProvider
      locale={locale}
      messages={useLocalizedMessages ? mergedMessages : null}
    >
      <Story />
    </IntlProvider>
  );
};

/**
 * Helper to simplify story declaration.
 */
function makeStory(
  args: StoryArgs | TripDetailsProps,
  Component?: React.ElementType<TripDetailsProps>
) {
  const BoundTripDetails = createTripDetailsTemplate(Component).bind({});
  BoundTripDetails.args = args;
  return BoundTripDetails;
}

const decoratorPropDescription = "(This prop is used by the decorator.)";
// Hide story controls for some props.
const noControl = {
  control: { type: false }
};

export default {
  argTypes: {
    CaloriesDetails: noControl,
    className: noControl,
    // Hide the template's Component prop completely.
    Component: {
      table: { disable: true }
    },
    DepartureDetails: noControl,
    FareDetails: noControl,
    itinerary: noControl,
    locale: {
      control: "radio",
      description: decoratorPropDescription,
      options: ["en-US", "fr"]
    },
    useCustomMessages: {
      description: decoratorPropDescription
    },
    useLocalizedMessages: {
      description: decoratorPropDescription
    }
  },
  args: {
    locale: "en-US",
    useCustomMessages: false,
    useLocalizedMessages: true
  },
  component: TripDetails,
  decorators: [intlDecorator],
  parameters: { controls: { sort: "alpha" } },
  title: "TripDetails"
} as Meta;

export const WalkOnlyItinerary = makeStory({
  itinerary: walkOnlyItinerary
});

export const BikeOnlyItinerary = makeStory({
  itinerary: bikeOnlyItinerary
});

export const WalkTransitWalkItinerary = makeStory({
  itinerary: walkTransitWalkItinerary
});

export const StyledWalkTransitWalkItinerary = makeStory(
  {
    itinerary: walkTransitWalkItinerary
  },
  StyledTripDetails
);

export const BikeTransitBikeItinerary = makeStory({
  itinerary: bikeTransitBikeItinerary
});

export const WalkInterlinedTransitItinerary = makeStory({
  defaultFare: "electronicRegular",
  fareKeyNameMap: customKeyMap,
  itinerary: walkInterlinedTransitItinerary
});

export const WalkTransitTransferItinerary = makeStory({
  itinerary: walkTransitWalkTransitWalkItinerary
});

export const BikeRentalItinerary = makeStory({
  itinerary: bikeRentalItinerary
});

export const EScooterRentalItinerary = makeStory({
  itinerary: eScooterRentalItinerary
});

export const ParkAndRideItinerary = makeStory({
  itinerary: parkAndRideItinerary
});

export const BikeRentalTransitItinerary = makeStory({
  itinerary: bikeRentalTransitBikeRentalItinerary
});

export const EScooterRentalTransitItinerary = makeStory({
  itinerary: eScooterRentalTransiteScooterRentalItinerary
});

export const TncTransitItinerary = makeStory({
  fareKeyNameMap: customKeyMap,
  itinerary: tncTransitTncItinerary
});

export const TncTransitItineraryWithCustomDetails = makeStory(
  {
    CaloriesDetails: CustomCaloriesDetails,
    DepartureDetails: CustomDepartureDetails,
    FareDetails: CustomFareDetails,
    fareKeyNameMap: customKeyMap,
    itinerary: tncTransitTncItinerary
  },
  StyledTripDetails
);
