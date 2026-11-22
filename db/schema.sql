-- Cloudflare D1 schema for fare submissions.
-- One row per submitted ride. No account, phone number, name, device ID,
-- IP address, location coordinates or exact time is stored.
-- There is deliberately no "created at" column: it would record the exact
-- submission time, which the design rules out.

CREATE TABLE IF NOT EXISTS rides (
  id               TEXT PRIMARY KEY,                -- random UUID, carries no user information
  origin_station   TEXT NOT NULL,                   -- MRT/LRT station name
  dest_station     TEXT NOT NULL,
  ride_time_15min  TEXT NOT NULL                    -- Singapore local time, rounded down to 15 minutes
                   CHECK (ride_time_15min GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-2][0-9]:[0-5][0-9]'
                          AND substr(ride_time_15min, 15, 2) IN ('00', '15', '30', '45')),
  platform         TEXT NOT NULL
                   CHECK (platform IN ('grab', 'gojek', 'tada', 'geolah', 'ryde', 'cdg_zig', 'street_hail')),
  booked_fare_sgd  REAL NOT NULL CHECK (booked_fare_sgd > 0),
  discount_flag    INTEGER NOT NULL DEFAULT 0 CHECK (discount_flag IN (0, 1)),
  benchmark_sgd    REAL NOT NULL CHECK (benchmark_sgd > 0),  -- reference fare for the final route
  formula_version  TEXT NOT NULL,                   -- "<rate table version>+<distance table version>", e.g. 2026-11-21+placeholder-straight-x1.3
  rain_mm          REAL CHECK (rain_mm >= 0),  -- mm at the nearest gauge over the 15-minute slot, matched later from public rainfall data; NULL until matched or if the gauge had no readings
  CHECK (origin_station <> dest_station)
);
