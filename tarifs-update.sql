-- Mise à jour de la table tarifs si nécessaire
-- Exécuter uniquement si votre table tarifs existe déjà et que vous voulez vérifier/mettre à jour les données

-- Vérifier la structure de votre table tarifs actuelle
-- SELECT * FROM tarifs LIMIT 5;

-- Si vous voulez ajouter/mettre à jour les tarifs depuis le CSV fourni:
-- (Adaptez selon la structure exacte de votre table tarifs)

/*
EXEMPLE de structure possible basée sur votre CSV:

CREATE TABLE IF NOT EXISTS tarifs (
  id INTEGER PRIMARY KEY,
  employee_band TEXT NOT NULL,
  payment_mode TEXT NOT NULL, -- 'MONTHLY' ou 'YEARLY'
  owner_monthly DECIMAL(10,2),
  owner_annual DECIMAL(10,2),
  cabinet_ht_monthly DECIMAL(10,2),
  cabinet_ttc_monthly DECIMAL(10,2),
  cabinet_ht_annual DECIMAL(10,2) NOT NULL,
  cabinet_ttc_annual DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_tarifs_employee_band ON tarifs(employee_band);
CREATE INDEX IF NOT EXISTS idx_tarifs_payment_mode ON tarifs(payment_mode);
*/

-- Pour récupérer le tarif "70/30" YEARLY (comme dans votre script Google Sheets):
-- SELECT employee_band, owner_annual as tarif, cabinet_ht_annual as hono
-- FROM tarifs
-- WHERE payment_mode = 'YEARLY'
-- ORDER BY id;

-- Exemple de requête pour un lead avec "6-10 salariés":
-- SELECT owner_annual, cabinet_ht_annual
-- FROM tarifs
-- WHERE employee_band = '6-10' AND payment_mode = 'YEARLY';
