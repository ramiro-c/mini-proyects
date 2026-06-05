# Tests

## Run Tests

```bash
# Watch mode
npm run test

# Single run
npm run test:run
```

## Test Structure

- `tests/providers.test.ts` - Tests para los adapters (SMTP, File, Null) y factory
- `tests/user.service.test.ts` - Tests para el service layer con mocks

## Coverage

Para agregar coverage, instalar `@vitest/coverage-v8` y ejecutar:

```bash
npx vitest run --coverage
```