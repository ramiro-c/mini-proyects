# Project 01 - Adapter Pattern (Email Providers)

Implementación del patrón **Adapter** para proveedores de email.

## Stack

- **Node.js** + **TypeScript**
- **Fastify** - HTTP server
- **Zod** - Validación de schemas
- **Vitest** - Tests

## Providers

- **SMTP** - nodemailer (configurable con MailHog o SMTP real)
- **File** - escribe emails a un archivo log
- **Null** - adapter silencioso (perfecto para tests/dev)

## Setup

```bash
npm install
npm run dev
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/provider` | Retorna el provider actual |
| `POST` | `/provider` | Cambia el provider runtime (`{ provider: "smtp" \| "file" \| "null" }`) |
| `POST` | `/users/register` | Registra usuario + envía welcome email |
| `POST` | `/users/reset-password` | Reset password + envía email |

## Tests

```bash
# Watch mode
npm run test

# Single run
npm run test:run
```

## Environment Variables

```bash
EMAIL_PROVIDER=null          # smtp, file, null
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
LOG_DIR=/tmp
PORT=3000
```

## Docker (MailHog para testing SMTP)

```bash
docker compose up
```

MailHog UI: `http://localhost:8025`

## Estructura

```
src/
  email.adapter.ts    # Interfaces
  providers/          # Adapters (smtp, file, null)
  services/           # Business logic
  schemas.ts          # Zod schemas
  fastify-server.ts   # HTTP server
  fastify.ts          # Entry point
tests/
  providers.test.ts
  user.service.test.ts
  fastify.test.ts
```