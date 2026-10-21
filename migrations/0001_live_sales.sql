-- Live online sales from join.boulders.dk (preliminary numbers).
-- Official numbers come from the morning BRP pull and replace these per day.
-- No personal data is stored here: no names, emails, phone numbers or customer ids.

CREATE TABLE IF NOT EXISTS live_sales (
  order_id        TEXT PRIMARY KEY,
  logged_at       TEXT NOT NULL,             -- ISO time we received it (UTC)
  sale_date       TEXT NOT NULL,             -- YYYY-MM-DD, Europe/Copenhagen
  gym_id          TEXT,
  gym_name        TEXT,
  status_id       INTEGER,
  status_name     TEXT,
  paid            INTEGER NOT NULL DEFAULT 0, -- 1 when BRP says Betalet / nothing left to pay
  total_kr        REAL,
  is_first_climb  INTEGER NOT NULL DEFAULT 0,
  landing_path    TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  click_id_type   TEXT,                      -- 'gclid' | 'fbclid' | 'ttclid' | NULL (the id itself is not stored)
  environment     TEXT
);

CREATE INDEX IF NOT EXISTS idx_live_sales_date ON live_sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_live_sales_gym_date ON live_sales (gym_id, sale_date);

CREATE TABLE IF NOT EXISTS live_sale_items (
  order_id      TEXT NOT NULL,
  line_no       INTEGER NOT NULL,
  item_type     TEXT NOT NULL,               -- membership | value-card | addon | entry
  product_id    TEXT,
  product_name  TEXT,
  quantity      INTEGER NOT NULL DEFAULT 1,
  amount_kr     REAL,
  PRIMARY KEY (order_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_live_sale_items_type ON live_sale_items (item_type);
