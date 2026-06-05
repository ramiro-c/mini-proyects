import { createServer } from "net"

const PORT = Number(process.env.SMTP_PORT) || 1025

const server = createServer((socket) => {
  let buffer = ""
  socket.write("220 fake-smtp ready\r\n")

  socket.on("data", (chunk) => {
    buffer += chunk.toString()

    if (buffer.endsWith("\r\n")) {
      const line = buffer.trim()
      buffer = ""

      if (line.startsWith("EHLO") || line.startsWith("HELO")) {
        socket.write("250 OK\r\n")
      } else if (line.startsWith("MAIL FROM")) {
        socket.write("250 OK\r\n")
      } else if (line.startsWith("RCPT TO")) {
        socket.write("250 OK\r\n")
      } else if (line === "DATA") {
        socket.write("354 Start mail input\r\n")
        buffer = "" // receive body until <CRLF>.<CRLF>
      } else if (line === ".") {
        socket.write("250 OK\r\n")
      } else if (line === "QUIT") {
        socket.write("221 Bye\r\n")
        socket.end()
      } else if (!line.startsWith("Received") && line.length > 0) {
        // print email content
        console.log("  📬", line)
      }
    }
  })
})

server.listen(PORT, () => {
  console.log(`Fake SMTP server listening on port ${PORT}`)
})
