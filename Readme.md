# Datos iniciales para produccion

## Usuarios
- [EMAIL_ADDRESS] - [PASSWORD]
- [EMAIL_ADDRESS] - [PASSWORD]
- [EMAIL_ADDRESS] - [PASSWORD]

## Activar unacents para busqueda
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

## Activar pg_trgm para busqueda
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Crear indices para busqueda
```sql
CREATE INDEX idx_productos_nombre_trgm ON productos USING GIN (nombre_comercial gin_trgm_ops);
CREATE INDEX idx_productos_codigo_barras_trgm ON productos USING GIN (codigo_barras gin_trgm_ops);
```