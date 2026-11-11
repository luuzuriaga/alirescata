# Alirescata

Plataforma web para la venta de excedentes y la donación trazable de alimentos (Taller de Proyectos, Universidad Continental).

## Requisitos
Node.js 20 o superior, PostgreSQL 16 (o Docker).

## Puesta en marcha rápida
```
cp .env.example .env
docker compose up --build        # API en :3000, web en :5173, base de datos con schema y seed
```
Sin Docker: crear la base, ejecutar `db/schema.sql` y `db/seed.sql`, y luego `npm ci && npm start` en `backend/` y `npm ci && npm run dev` en `frontend/`.

## Pruebas
```
cd backend  && npm ci && npm run lint && npm test -- --coverage   # requiere DATABASE_URL y JWT_SECRET
cd frontend && npm ci && npm run lint && npm test && npm run build
```

## Flujo de trabajo
Ramas `main` (versiones cerradas), `develop` (integración) y `feature/*`. Commits con Conventional Commits. Todo cambio entra por Pull Request con una revisión y CI en verde.
