-- Migration pour ajouter les nouveaux champs au système de gestion des leads
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter les colonnes manquantes à leads_realtime
ALTER TABLE leads_realtime
ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'À traiter',
ADD COLUMN IF NOT EXISTS comments TEXT,
ADD COLUMN IF NOT EXISTS pricing_range TEXT,
ADD COLUMN IF NOT EXISTS pricing_tarif DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS pricing_hono DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT, -- 'DR1', 'DR2', ou NULL
ADD COLUMN IF NOT EXISTS contract_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_call_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ;

-- 2. Créer une table pour la grille tarifaire (reprend PRICING_TABLE du script)
CREATE TABLE IF NOT EXISTS pricing_grid (
  id SERIAL PRIMARY KEY,
  employee_range TEXT UNIQUE NOT NULL,
  tarif DECIMAL(10,2) NOT NULL,
  hono DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insérer les tarifs depuis le script Google Sheets
INSERT INTO pricing_grid (employee_range, tarif, hono) VALUES
('1 à 2 salariés', 1848.00, 792.00),
('3 à 5 salariés', 2520.00, 1080.00),
('6 à 10 salariés', 4032.00, 1728.00),
('11 à 19 salariés', 5880.00, 2520.00),
('20 à 29 salariés', 7980.00, 3420.00),
('30 à 39 salariés', 10080.00, 4320.00),
('40 à 49 salariés', 12600.00, 5400.00),
('50 à 74 salariés', 16800.00, 7200.00),
('75 à 99 salariés', 25200.00, 10800.00),
('100 à 149 salariés', 33600.00, 14400.00),
('150 à 199 salariés', 42000.00, 18000.00),
('200 à 249 salariés', 50400.00, 21600.00),
('250 à 299 salariés', 58800.00, 25200.00),
('300 à 349 salariés', 67200.00, 28800.00),
('350 à 400 salariés', 75600.00, 32400.00)
ON CONFLICT (employee_range) DO NOTHING;

-- 4. Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads_realtime(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON leads_realtime(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads_realtime(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_contract_signed ON leads_realtime(contract_signed);

-- 5. Créer une vue pour le tracking sheet avec toutes les infos
CREATE OR REPLACE VIEW tracking_sheet_view AS
SELECT
  l.*,
  pg.tarif as pricing_tarif_display,
  pg.hono as pricing_hono_display,
  ts.sales_email,
  ts.sales_name
FROM leads_realtime l
LEFT JOIN pricing_grid pg ON l.pricing_range = pg.employee_range
LEFT JOIN tracking_sheets ts ON l.assigned_to = ts.sales_email
WHERE ts.is_active = true;

-- 6. Ajouter les RLS policies pour les nouvelles colonnes (même logique que les colonnes existantes)
-- Les policies existantes sur leads_realtime s'appliquent déjà aux nouvelles colonnes

COMMENT ON COLUMN leads_realtime.lead_status IS 'Statut du lead: À traiter, À rappeler, RDV fixé, Répondeur, Non pertinent, Pas intéressé';
COMMENT ON COLUMN leads_realtime.comments IS 'Commentaires internes pour les sales';
COMMENT ON COLUMN leads_realtime.pricing_range IS 'Tranche de salariés sélectionnée depuis la grille tarifaire';
COMMENT ON COLUMN leads_realtime.pipeline_stage IS 'DR1 ou DR2';
COMMENT ON TABLE pricing_grid IS 'Grille tarifaire basée sur le nombre de salariés';
