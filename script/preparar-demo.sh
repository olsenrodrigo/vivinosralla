#!/usr/bin/env bash
# Prepara o ambiente local para demonstrar a loja à cliente.
# Só mexe em dado de vitrine — não toca em configuração de pagamento nem no provador.
set -euo pipefail
cd "$(dirname "$0")"
cd /Users/olsenrodrigo/DEV/VIVINOSRALLA
set -a; . ./.env; set +a

echo "1/3 · medidas em três peças (a tabela na página do produto)"
psql "$DATABASE_URL" -q -c "
UPDATE products SET measurements = '{
  \"PP\":{\"busto\":84,\"cintura\":66,\"quadril\":92,\"comprimento\":94},
  \"P\" :{\"busto\":88,\"cintura\":70,\"quadril\":96,\"comprimento\":95},
  \"M\" :{\"busto\":92,\"cintura\":74,\"quadril\":100,\"comprimento\":96},
  \"G\" :{\"busto\":96,\"cintura\":78,\"quadril\":104,\"comprimento\":97},
  \"GG\":{\"busto\":100,\"cintura\":82,\"quadril\":108,\"comprimento\":98}
}'::jsonb
WHERE slug IN ('vestido-colete-marta','macacao-antonia','conjunto-alfaiataria-beatriz');"

echo "2/3 · segunda foto em três peças (troca de imagem no hover)"
psql "$DATABASE_URL" -q -c "
INSERT INTO product_images (product_id, url, position, is_main)
SELECT p.id, i.url, 1, false
FROM products p
CROSS JOIN LATERAL (
  SELECT url FROM product_images WHERE product_id <> p.id ORDER BY random() LIMIT 1
) i
WHERE p.slug IN ('vestido-colete-marta','macacao-antonia','conjunto-alfaiataria-beatriz')
  AND (SELECT count(*) FROM product_images WHERE product_id = p.id) = 1;"

echo "3/3 · uma coleção com peças ordenadas (API pronta; a tela ainda não existe)"
psql "$DATABASE_URL" -q -c "
INSERT INTO collections (name, slug, season, description, active)
VALUES ('Alfaiataria de Verão','alfaiataria-verao','Verão 2026','Peças estruturadas em linho e viscose.',true)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO collection_products (collection_id, product_id, sort_order)
SELECT c.id, p.id, row_number() OVER (ORDER BY p.price DESC) - 1
FROM collections c, products p
WHERE c.slug='alfaiataria-verao' AND p.published AND p.type IN ('conjuntos','vestidos')
ON CONFLICT DO NOTHING;"

echo
echo "Pronto. Suba com: npm run dev   →   http://localhost:5300"
