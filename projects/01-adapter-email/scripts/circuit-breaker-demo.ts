import { circuitBreakerSender } from "../src/decorators/circuit-breaker.sender";
import type { Email, EmailSender } from "../src/email.adapter";

function controllableProvider(): EmailSender & { setFail(f: boolean): void } {
	let shouldFail = true;
	return {
		setFail(f: boolean) { shouldFail = f; },
		async send(_email: Email) {
			if (shouldFail) throw new Error("SMTP connection refused");
		},
	};
}

async function main() {
	const provider = controllableProvider();
	const sender = circuitBreakerSender(provider, { failureThreshold: 2, timeoutMs: 3000 });

	function state() {
		const s = sender.getState();
		const icons: Record<string, string> = { closed: "🟢", open: "🔴", half_open: "🟡" };
		return `${icons[s] ?? "⚪"} ${s}`;
	}

	const email = { to: "a@b.com", subject: "T", body: "B" };

	console.log("\n╔══════════════════════════════════════════╗");
	console.log("║      Circuit Breaker Demo               ║");
	console.log("╚══════════════════════════════════════════╝\n");

	// FASE 1: closed, request normal
	console.log("─── Fase 1: Provider funciona ───");
	provider.setFail(false);
	console.log(`  Estado: ${state()}`);
	await sender.send(email);
	console.log("  ✅ request exitosa\n");

	// FASE 2: falla 2 veces → se abre
	console.log("─── Fase 2: Provider empieza a fallar ───");
	provider.setFail(true);
	for (let i = 1; i <= 2; i++) {
		try { await sender.send(email); }
		catch { /* esperado */ }
		console.log(`  Request ${i}: ${state()}`);
	}

	try { await sender.send(email); }
	catch { /* esperado */ }
	console.log(`  Request 3: ${state()} — rechazada al instante\n`);

	// FASE 3: esperar timeout → half_open
	console.log("─── Fase 3: Esperando timeout (3s)... ───");
	await new Promise((r) => setTimeout(r, 3100));
	console.log(`  Estado: ${state()}\n`);

	// FASE 4: half_open → sigue fallando → vuelve a open
	console.log("─── Fase 4: Half open, provider sigue roto ───");
	try { await sender.send(email); }
	catch { /* esperado */ }
	console.log(`  Request: ${state()} — volvió a open por otros 3s\n`);

	// FASE 5: esperar timeout, ahora sí se recupera
	console.log("─── Fase 5: Esperando timeout (3s)... ───");
	await new Promise((r) => setTimeout(r, 3100));
	provider.setFail(false);
	console.log("  ✅ Provider recuperado!\n");

	console.log("─── Fase 6: Half open, provider funciona ───");
	await sender.send(email);
	console.log(`  Request: ${state()} — cerrado de nuevo!\n`);

	console.log("╔══════════════════════════════════════════╗");
	console.log("║  FIN                                    ║");
	console.log("╚══════════════════════════════════════════╝");
}

main().catch(console.error);
