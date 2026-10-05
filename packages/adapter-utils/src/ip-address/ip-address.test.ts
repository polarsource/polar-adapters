import { describe, expect, it } from "vitest";
import { getClientIpAddress } from "./ip-address";

describe("getClientIpAddress", () => {
	it.each([
		[{ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "203.0.113.7"],
		[
			{ "x-forwarded-for": "unknown", "x-real-ip": "2001:db8::1" },
			"2001:db8::1",
		],
		[{ "cf-connecting-ip": "::ffff:192.0.2.1" }, "::ffff:192.0.2.1"],
		[{ "x-forwarded-for": "256.1.1.1" }, undefined],
		[{ "x-forwarded-for": "::1]:80/[" }, undefined],
		[{}, undefined],
	])("resolves %o to %s", (headers, expected) => {
		expect(getClientIpAddress(new Headers(headers))).toBe(expected);
	});

	it("uses only the configured headers", () => {
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.7",
			"fly-client-ip": "198.51.100.4",
		});

		expect(getClientIpAddress(headers, ["fly-client-ip"])).toBe("198.51.100.4");
		expect(getClientIpAddress(headers, false)).toBeUndefined();
	});
});
