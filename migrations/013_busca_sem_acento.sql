-- Busca da vitrine precisa ignorar caixa e acento: a cliente digita "vestido"
-- ou "trico" e o catálogo tem "Vestido" e "Tricô". Sem isso a busca só
-- encontrava o termo escrito exatamente como está cadastrado.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Nota: não há índice para essa busca. `unaccent()` é STABLE (não IMMUTABLE),
-- então um índice funcional exigiria um wrapper IMMUTABLE — que passa a mentir
-- se o dicionário do unaccent mudar. Com um catálogo desta ordem (dezenas a
-- poucos milhares de peças) o seq scan é irrelevante. Se o catálogo crescer,
-- a saída correta é uma coluna gerada + índice GIN com pg_trgm.
