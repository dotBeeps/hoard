import * as http from "http";
import type { StoneMessage } from "./types.js";

/**
 * Thin HTTP client for sending messages to the local sending stone server.
 * Reads the port from HOARD_STONE_PORT env var — set by the primary session's index.ts.
 * Intended for use from subagent sessions (ally mode).
 * Always fails silently — never throws.
 */
export async function sendToStone(
	msg: Partial<StoneMessage> & { content: string; from: string }
): Promise<void> {
	const portStr = process.env["HOARD_STONE_PORT"];
	if (!portStr) {
		console.warn("[sending-stone] HOARD_STONE_PORT not set — stone not available");
		return;
	}

	const port = parseInt(portStr, 10);
	if (isNaN(port)) {
		console.warn(`[sending-stone] HOARD_STONE_PORT is not a valid number: ${portStr}`);
		return;
	}

	const body = JSON.stringify(msg);

	return new Promise<void>((resolve) => {
		try {
			const req = http.request(
				{
					hostname: "127.0.0.1",
					port,
					path: "/message",
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Content-Length": Buffer.byteLength(body),
					},
				},
				(res) => {
					res.resume();
					resolve();
				}
			);

			req.on("error", (err: Error) => {
				console.warn(`[sending-stone] send failed: ${err.message}`);
				resolve();
			});

			req.write(body);
			req.end();
		} catch (err) {
			console.warn(`[sending-stone] send failed: ${String(err)}`);
			resolve();
		}
	});
}
