import { createServer } from "node:http"
import { createEmailSender, EmailProvider } from "./providers/index"
import { createUserService } from "./services/user.service"

let currentProvider = process.env.EMAIL_PROVIDER ?? "null"
let sender = createEmailSender(currentProvider as EmailProvider)
let userService = createUserService(sender)

const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json")

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`)

    if (req.method === "GET" && url.pathname === "/provider") {
      res.end(JSON.stringify({ provider: currentProvider }))
      return
    }

    if (req.method === "POST" && url.pathname === "/provider") {
      let body = ""
      for await (const chunk of req) body += chunk
      const { provider } = JSON.parse(body)
      currentProvider = provider
      sender = createEmailSender(provider)
      userService = createUserService(sender)
      res.end(JSON.stringify({ provider }))
      return
    }

    if (req.method === "POST" && url.pathname === "/users/register") {
      let body = ""
      for await (const chunk of req) body += chunk
      const { name, email } = JSON.parse(body)
      await userService.register({ name, email })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (req.method === "POST" && url.pathname === "/users/reset-password") {
      let body = ""
      for await (const chunk of req) body += chunk
      const { name, email } = JSON.parse(body)
      await userService.resetPassword({ name, email })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
  } catch (err: any) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
})

const PORT = Number(process.env.PORT) || 3000
server.listen(PORT, () => console.log(`Server on :${PORT}`))
