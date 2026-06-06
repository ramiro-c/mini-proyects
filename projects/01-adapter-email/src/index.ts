import "dotenv/config";
import { createServer } from "./server";

const fastify = createServer();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

fastify.listen({ port: PORT, host: HOST }, (err) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server on ${HOST}:${PORT}`);
});
