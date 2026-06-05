import { createServer } from "./fastify-server"

const fastify = createServer()

const PORT = Number(process.env.PORT) || 3000

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server on :${PORT}`)
})