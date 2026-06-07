import {
	circuitBreakerSender,
	type CircuitBreakerConfig,
} from "../src/decorators/circuit-breaker.sender";
import type { Email, EmailSender } from "../src/email.adapter";
import { CircuitBreakerOpenError } from "../src/errors";

function controllableProvider(): EmailSender & { setFail(f: boolean): void } {
	let shouldFail = true;
	return {
		setFail(f: boolean) {
			shouldFail = f;
		},
		async send(_email: Email) {
			if (shouldFail) throw new Error("SMTP connection refused");
		},
	};
}

function log(msg: string) {
	const ts = `${(performance.now() / 1000).toFixed(5)}s`.padStart(9);
	console.log(`  ${ts} ${msg}`);
}

async function main() {
	const provider = controllableProvider();
	const config: CircuitBreakerConfig = { failureThreshold: 5, timeoutMs: 3000 };
	const sender = circuitBreakerSender(provider, config);

	const icons: Record<string, string> = { closed: "🟢", open: "🔴", half_open: "🟡" };
	function stateTag() {
		const s = sender.getState();
		return `${icons[s] ?? "⚪"} ${s}`;
	}

	let reqCount = 0;
	async function send() {
		reqCount++;
		const email = { to: "a@b.com", subject: "T", body: "B" };
		const prefix = `req#${String(reqCount).padStart(2)} ${stateTag()}`;
		try {
			await sender.send(email);
			log(`${prefix}  ✅ ok`);
		} catch (err) {
			if (err instanceof CircuitBreakerOpenError) {
				log(`${prefix}  ❌ CircuitBreakerOpenError — rechazado sin intentar send real`);
			} else {
				log(`${prefix}  ❌ ${(err as Error).message}`);
			}
		}
	}

	function separator(text: string) {
		console.log(`\n  ${"─".repeat(68)}`);
		console.log(`  ${text}`);
		console.log(`  ${"─".repeat(68)}`);
	}

	const { failureThreshold: ft, timeoutMs: to } = config;

	console.log(`\n  ╔══════════════════════════════════════════════════════════════╗`);
	console.log(`  ║              Circuit Breaker — Demo Detallado              ║`);
	console.log(`  ╠══════════════════════════════════════════════════════════════╣`);
	console.log(`  ║  failureThreshold  ${String(ft).padEnd(48)}║`);
	console.log(`  ║  timeoutMs         ${String(to).padEnd(48)}║`);
	console.log(`  ╚══════════════════════════════════════════════════════════════╝`);

	console.log(
		`\n  📐 State machine: closed ─fail─→ open ─timeout─→ half_open ─success─→ closed`,
	);
	console.log(`                                     └───fail───→ open`);

	// ─── FASE 1 ──────────────────────────────────────────────────────────
	separator("FASE 1: Provider funciona — closed, requests pasan sin problema");
	provider.setFail(false);
	log(`${stateTag()}  | failureCount=0`);
	await send();
	log(`${stateTag()}  | failureCount se resetea a 0 tras éxito`);
	log(`${stateTag()}  | testRequestInFlight=false (solo aplica en half_open)`);

	// ─── FASE 2 ──────────────────────────────────────────────────────────
	separator(
		`FASE 2: Provider falla — c/u incrementa failureCount. Al llegar a ${ft} → open + scheduleTimeout(${to}ms)`,
	);
	provider.setFail(true);
	for (let i = 1; i <= ft; i++) {
		log(`${stateTag()}  | failureCount=${i - 1} — falla → failureCount=${i}`);
		await send();
		if (i < ft) {
			log(`${stateTag()}  | failureCount=${i} < threshold=${ft}, sigue closed`);
		} else {
			log(`${stateTag()}  | ⚡ failureCount=${i} >= threshold=${ft} → dispatch("fail")`);
			log(`${stateTag()}  | ⚡ machine transition: closed ─fail─→ open`);
			log(
				`${stateTag()}  | ⚡ scheduleTimeout(${to}ms) — dentro de ${to}ms se dispara dispatch("timeout")`,
			);
		}
	}

	log(`${stateTag()}  | CircuitBreaker abierto — próxima request rebotada al instante`);
	await send();
	log(`${stateTag()}  | 🚫 ni siquiera invocó al provider — cortado en la puerta`);
	log(`${stateTag()}  | timeout programado corriendo...`);

	// ─── FASE 3 ──────────────────────────────────────────────────────────
	separator(`FASE 3: Pasa el timeout (${to}ms) → dispatch("timeout") → half_open`);
	log(`${stateTag()}  | durmiendo ${to}ms hasta que expire el timer...`);
	await new Promise((r) => setTimeout(r, to + 100));
	log(`${stateTag()}  | ⚡ dispatch("timeout") — machine: open ─timeout─→ half_open`);
	log(`${stateTag()}  | testRequestInFlight=false — próxima request será la sonda`);

	// ─── FASE 4 ──────────────────────────────────────────────────────────
	separator(
		"FASE 4: half_open — sonda. Provider sigue roto → la sonda falla → vuelve a open",
	);
	log(`${stateTag()}  | half_open → testRequestInFlight=true (sonda armada)`);
	await send();
	log(`${stateTag()}  | ⚡ machine: half_open ─fail─→ open`);
	log(`${stateTag()}  | ⚡ scheduleTimeout(${to}ms) — otro ciclo de espera`);
	log(`${stateTag()}  | testRequestInFlight=false`);

	// ─── FASE 5 ──────────────────────────────────────────────────────────
	separator(`FASE 5: Pasa el timeout otra vez. Provider se recupera antes de la sonda`);
	log(`${stateTag()}  | durmiendo ${to}ms hasta que expire el timer...`);
	await new Promise((r) => setTimeout(r, to + 100));
	log(`${stateTag()}  | ⚡ dispatch("timeout") — machine: open ─timeout─→ half_open`);
	provider.setFail(false);
	log(`${stateTag()}  | ✅ provider.setFail(false) — ahora funciona`);
	log(`${stateTag()}  | testRequestInFlight=false — próxima request será la sonda`);
	log(`${stateTag()}  | provider sano, la sonda debería Ok → closed`);

	// ─── FASE 6 ──────────────────────────────────────────────────────────
	separator("FASE 6: half_open — sonda exitosa → closed");
	log(`${stateTag()}  | half_open → testRequestInFlight=true (sonda armada)`);
	log(`${stateTag()}  | enviando... como provider no falla, el send real va a ok`);
	await send();
	log(`${stateTag()}  | ⚡ machine: half_open ─success─→ closed`);
	log(`${stateTag()}  | failureCount=0`);
	log(`${stateTag()}  | ✅ Circuito cerrado. Todo normal.`);

	console.log(`\n  ╔══════════════════════════════════════════════════════════════╗`);
	console.log(`  ║  FIN — ciclo completo: closed → open → half_open → closed  ║`);
	console.log(`  ╚══════════════════════════════════════════════════════════════╝\n`);
}

main().catch(console.error);
