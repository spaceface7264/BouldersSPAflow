-- First-touch columns for 7-day attribution lookback.
-- Existing utm_* / click_id_type hold last touch (conversion lookback).

ALTER TABLE live_sales ADD COLUMN first_utm_source TEXT;
ALTER TABLE live_sales ADD COLUMN first_utm_medium TEXT;
ALTER TABLE live_sales ADD COLUMN first_utm_campaign TEXT;
ALTER TABLE live_sales ADD COLUMN first_click_id_type TEXT;
