# Buscador Compra Ágil — Andes Medikeep

Buscador de Compra Ágil usando la nueva API oficial de ChileCompra (v2, Mayo 2026).

## Estructura

```
buscador-mp-v2/
├── api/
│   └── buscar.js        ← Serverless function (proxy seguro a ChileCompra)
├── public/
│   └── index.html       ← Frontend completo
├── vercel.json          ← Configuración de rutas
└── package.json
```

## Despliegue en Vercel (5 pasos)

### 1. Sube el código a GitHub

- Crea un repositorio nuevo en https://github.com → "New repository" → nombre: `buscador-mp`
- Sube TODA la carpeta `buscador-mp-v2` (arrastra los archivos al repositorio)

### 2. Conecta con Vercel

- Ve a https://vercel.com → "Add New Project"
- Importa el repositorio `buscador-mp`
- En "Build & Output Settings": deja todo por defecto

### 3. Configura la variable de entorno (MUY IMPORTANTE)

En Vercel, antes de hacer Deploy:
- Ve a "Environment Variables"
- Agrega: `MP_TICKET` = `38366B56-462A-4B4F-9FEE-18F946D9F1B5`

Esto mantiene tu API key segura en el servidor, no expuesta en el HTML.

### 4. Deploy

- Haz clic en "Deploy"
- En ~1 minuto tendrás tu URL: `https://buscador-mp.vercel.app`

### 5. Actualiza la API key si cambia

En Vercel → Settings → Environment Variables → edita `MP_TICKET`

## Cómo funciona

1. El frontend llama a `/api/buscar?q=cateter&estado=publicada`
2. La serverless function agrega el ticket en el header y llama a `api2.mercadopublico.cl`
3. El resultado se devuelve al frontend

## API utilizada

- **Nueva API Compra Ágil v2** (lanzada 22 mayo 2026)
- Base URL: `https://api2.mercadopublico.cl`
- Endpoint: `GET /v2/compra-agil?q=...&estado=...`
- Autenticación: header `ticket: TU_TICKET`
- Documentación oficial: https://www.chilecompra.cl/api/
