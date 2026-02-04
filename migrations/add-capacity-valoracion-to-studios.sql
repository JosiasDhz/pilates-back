-- Migración para agregar capacidad de valoración a la tabla studios
-- Ejecutar este script en la base de datos para agregar el campo capacity_valoracion

-- Agregar columna capacity_valoracion con valor por defecto 0
ALTER TABLE studios ADD COLUMN IF NOT EXISTS capacity_valoracion INTEGER DEFAULT 0 NOT NULL;
