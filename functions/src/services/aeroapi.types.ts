export interface FlightData {
  ident: string;
  operator?: string;
  aircraftType?: string;
  registration?: string;
  origin?: AirportInfo;
  destination?: AirportInfo;
  scheduledOut?: string;
  estimatedOut?: string;
  actualOut?: string;
  scheduledOn?: string;
  estimatedOn?: string;
  actualOn?: string;
  scheduledIn?: string;
  estimatedIn?: string;
  actualIn?: string;
  status?: string;
  gate?: string;
  terminal?: string;
  routeDistance?: number;
  route?: string;
  diverted?: boolean;
  cancelled?: boolean;
  departureDelay?: number;
  arrivalDelay?: number;
}

export interface AirportInfo {
  code: string;
  codeIcao?: string;
  codeIata?: string;
  name?: string;
  city?: string;
  timezone?: string;
}

export interface AeroApiResponse {
  flights?: Array<{
    ident?: string;
    ident_icao?: string;
    operator?: string;
    operator_icao?: string;
    flight_number?: string;
    registration?: string;
    aircraft_type?: string;
    origin?: {
      code?: string;
      code_icao?: string;
      code_iata?: string;
      name?: string;
      city?: string;
      timezone?: string;
    };
    destination?: {
      code?: string;
      code_icao?: string;
      code_iata?: string;
      name?: string;
      city?: string;
      timezone?: string;
    };
    scheduled_out?: string;
    estimated_out?: string;
    actual_out?: string;
    scheduled_off?: string;
    estimated_off?: string;
    actual_off?: string;
    scheduled_on?: string;
    estimated_on?: string;
    actual_on?: string;
    scheduled_in?: string;
    estimated_in?: string;
    actual_in?: string;
    status?: string;
    gate_destination?: string;
    terminal_destination?: string;
    route_distance?: number;
    route?: string;
    diverted?: boolean;
    cancelled?: boolean;
    departure_delay?: number;
    arrival_delay?: number;
    progress_percent?: number;
  }>;
}