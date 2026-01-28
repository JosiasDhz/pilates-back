-- Migración para hacer nullable los campos opcionales de la tabla aspirants
-- Ejecutar este script en la base de datos para permitir valores NULL en estos campos

-- Hacer nullable el campo age
ALTER TABLE aspirants ALTER COLUMN age DROP NOT NULL;

-- Hacer nullable el campo language
ALTER TABLE aspirants ALTER COLUMN language DROP NOT NULL;

-- Hacer nullable el campo occupation
ALTER TABLE aspirants ALTER COLUMN occupation DROP NOT NULL;

-- Hacer nullable el campo gender
ALTER TABLE aspirants ALTER COLUMN gender DROP NOT NULL;
