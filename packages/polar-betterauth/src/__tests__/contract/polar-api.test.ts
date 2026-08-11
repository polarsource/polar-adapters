import { Polar } from "@polar-sh/sdk";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Contract tests: verify the Polar-side facts the member-model integration
 * is built on, against a REAL Polar API — no mocks. Every assumption
 * encoded in the plugin's Polar calls should be asserted here first.
 *
 * Opt-in only. To run:
 *
 *   POLAR_CONTRACT_TESTS=1 \
 *   POLAR_ACCESS_TOKEN=polar_oat_... \
 *   pnpm test:contract
 *
 * Targets, in order of precedence:
 *   - POLAR_SERVER_URL=http://127.0.0.1:8000  (local ../polar dev server)
 *   - otherwise the Polar sandbox (sandbox-api.polar.sh)
 *
 * Requirements: an organization access token for a (sandbox) organization
 * with `member_model_enabled` — the preflight test fails with instructions
 * otherwise. Every resource is created with a unique per-run suffix and
 * cleaned up in afterAll (customers deleted, products archived).
 */

const accessToken = process.env["POLAR_ACCESS_TOKEN"];
const serverUrl = process.env["POLAR_SERVER_URL"];
const enabled =
	process.env["POLAR_CONTRACT_TESTS"] === "1" && Boolean(accessToken);

const runId = `ba-contract-${Date.now().toString(36)}`;

describe.runIf(enabled)("Polar API contract", () => {
	vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

	const polar = new Polar({
		accessToken,
		...(serverUrl ? { serverURL: serverUrl } : { server: "sandbox" }),
	});

	// Shared state, built up across sequential tests
	const teamExternalId = `${runId}-org`;
	const ownerExternalId = `${runId}-owner-user`;
	const memberExternalId = `${runId}-member-user`;
	const createdCustomerIds: string[] = [];
	let createdProductId: string | undefined;
	let teamCustomerId: string;

	afterAll(async () => {
		// POLAR_CONTRACT_KEEP=1 skips cleanup so a run's resources can be
		// inspected in the dashboard (customers named "Contract Test …").
		if (process.env["POLAR_CONTRACT_KEEP"] === "1") return;

		for (const id of createdCustomerIds) {
			await polar.customers.delete({ id }).catch(() => {});
		}
		if (createdProductId) {
			await polar.products
				.update({
					id: createdProductId,
					productUpdate: { isArchived: true },
				})
				.catch(() => {});
		}
	});

	it("preflight: organization has member_model_enabled", async () => {
		const orgs = await polar.organizations.listOrganizations({ limit: 1 });
		const org = orgs.result.items[0];

		expect(org, "access token resolves to an organization").toBeDefined();
		if (!org) return;

		expect(
			org.featureSettings?.memberModelEnabled,
			`Organization "${org.slug}" must have member_model_enabled to run the member-model contract suite. Enable it in organization feature settings (triggers the member backfill) and re-run.`,
		).toBe(true);
	});

	it("creates a team customer directly, with an auto-created owner member", async () => {
		const customer = await polar.customers.create({
			type: "team",
			name: `Contract Test Team ${runId}`,
			externalId: teamExternalId,
			owner: {
				email: `${runId}-owner@gmail.com`,
				externalId: ownerExternalId,
			},
		});

		createdCustomerIds.push(customer.id);
		teamCustomerId = customer.id;

		expect(customer.type).toBe("team");
		expect(customer.externalId).toBe(teamExternalId);

		const members = await polar.members.listMembers({
			customerId: customer.id,
		});
		const owner = members.result.items.find((m) => m.role === "owner");

		expect(owner).toBeDefined();
		expect(owner?.email).toBe(`${runId}-owner@gmail.com`);
		expect(owner?.externalId).toBe(ownerExternalId);
	});

	it("creates members with external ids and restricted roles", async () => {
		const member = await polar.customers.members.createExternal({
			externalId: teamExternalId,
			memberCreateFromCustomer: {
				email: `${runId}-member@gmail.com`,
				externalId: memberExternalId,
				role: "member",
			},
		});

		expect(member.role).toBe("member");
		expect(member.externalId).toBe(memberExternalId);

		const billingManager = await polar.customers.members.createExternal({
			externalId: teamExternalId,
			memberCreateFromCustomer: {
				email: `${runId}-bm@gmail.com`,
				role: "billing_manager",
			},
		});

		expect(billingManager.role).toBe("billing_manager");
		// Note: member creation only allows "member" | "billing_manager" —
		// owner creation/transfer goes through customer create or member
		// update. The single-active-owner constraint is asserted next.
	});

	it("enforces a single active owner per customer", async () => {
		// Updating a member's role to owner is Polar's ownership-transfer
		// path; afterwards exactly one active owner must remain.
		await polar.customers.members.updateExternal({
			externalId: teamExternalId,
			memberExternalId: memberExternalId,
			memberUpdate: { role: "owner" },
		});

		const members = await polar.members.listMembers({
			customerId: teamCustomerId,
		});
		const owners = members.result.items.filter((m) => m.role === "owner");

		expect(owners).toHaveLength(1);
		expect(owners[0]?.externalId).toBe(memberExternalId);

		// Transfer back for the rest of the suite
		const previousOwner = members.result.items.find(
			(m) => m.externalId === ownerExternalId,
		);
		expect(previousOwner).toBeDefined();
		if (previousOwner) {
			await polar.customers.members.updateExternal({
				externalId: teamExternalId,
				memberExternalId: ownerExternalId,
				memberUpdate: { role: "owner" },
			});
		}
	});

	it("supports member CRUD addressed purely by external ids", async () => {
		const extUserId = `${runId}-ext-user`;

		const created = await polar.customers.members.createExternal({
			externalId: teamExternalId,
			memberCreateFromCustomer: {
				email: `${runId}-ext@gmail.com`,
				externalId: extUserId,
				role: "member",
			},
		});

		const fetched = await polar.customers.members.getExternal({
			externalId: teamExternalId,
			memberExternalId: extUserId,
		});
		expect(fetched.id).toBe(created.id);

		const updated = await polar.customers.members.updateExternal({
			externalId: teamExternalId,
			memberExternalId: extUserId,
			memberUpdate: { role: "billing_manager" },
		});
		expect(updated.role).toBe("billing_manager");

		await polar.customers.members.deleteExternal({
			externalId: teamExternalId,
			memberExternalId: extUserId,
		});

		// A deleted mirror must surface as ResourceNotFound — the roster
		// sync's dedupe and idempotent-removal logic key off this.
		await expect(
			polar.customers.members.getExternal({
				externalId: teamExternalId,
				memberExternalId: extUserId,
			}),
		).rejects.toMatchObject({ name: "ResourceNotFound" });
	});

	it("creates a member session for a team customer via external ids", async () => {
		const session = await polar.customerSessions.create({
			externalCustomerId: teamExternalId,
			externalMemberId: ownerExternalId,
		});

		expect(session.token).toBeTruthy();
		expect(session.customerPortalUrl).toBeTruthy();

		// The token must work against the customer-portal API the portal
		// plugin uses.
		const subscriptions = await polar.customerPortal.subscriptions.list(
			{ customerSession: session.token },
			{ limit: 1 },
		);

		expect(subscriptions.result).toBeDefined();
	});

	it("rejects a team customer session without a member", async () => {
		await expect(
			polar.customerSessions.create({
				externalCustomerId: teamExternalId,
			}),
		).rejects.toThrow();
	});

	it("resolves the owner member automatically for individual customers", async () => {
		const customer = await polar.customers.create({
			type: "individual",
			email: `${runId}-individual@gmail.com`,
			externalId: `${runId}-individual-user`,
		});
		createdCustomerIds.push(customer.id);

		const session = await polar.customerSessions.create({
			externalCustomerId: `${runId}-individual-user`,
		});

		expect(session.token).toBeTruthy();
	});

	it("confirms a free-product checkout API-only and attaches the subscription to the team customer", async () => {
		const product = await polar.products.create({
			name: `Contract Free Product ${runId}`,
			recurringInterval: "month",
			// The "free" price type was removed — a free price is a fixed
			// price of 0 (SDK 0.49 / API 2026-04).
			prices: [{ amountType: "fixed", priceAmount: 0 }],
		});
		createdProductId = product.id;

		const checkout = await polar.checkouts.create({
			products: [product.id],
			externalCustomerId: teamExternalId,
		});

		expect(checkout.clientSecret).toBeTruthy();

		// The team customer was created without an email, so the checkout has
		// no prefilled customer email — confirm requires one. (Contract
		// finding: customer_email is mandatory at confirm when the checkout
		// lacks it, even for free products.)
		const confirmed = await polar.checkouts.clientConfirm({
			clientSecret: checkout.clientSecret,
			checkoutConfirmStripe: {
				customerEmail: `${runId}-owner@gmail.com`,
			},
		});

		expect(confirmed.status).toBe("confirmed");

		// Order/subscription processing is async — poll briefly.
		const deadline = Date.now() + 20_000;
		let found = false;
		while (Date.now() < deadline && !found) {
			const subscriptions = await polar.subscriptions.list({
				customerId: teamCustomerId,
				active: true,
			});
			found = subscriptions.result.items.some(
				(s) => s.product.id === product.id,
			);
			if (!found) await new Promise((r) => setTimeout(r, 2_000));
		}

		expect(
			found,
			"active subscription for the free product on the team customer",
		).toBe(true);
	});
});

describe.runIf(!enabled)("Polar API contract (skipped)", () => {
	it("is disabled — set POLAR_CONTRACT_TESTS=1 and POLAR_ACCESS_TOKEN to run", () => {
		expect(enabled).toBe(false);
	});
});
