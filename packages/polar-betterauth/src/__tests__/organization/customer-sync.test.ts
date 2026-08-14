import type { CustomerIndividual } from "@polar-sh/sdk/models/components/customerindividual.js";
import type { CustomerTeam } from "@polar-sh/sdk/models/components/customerteam.js";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import type { Organization } from "better-auth/plugins/organization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	PolarOrganizationCustomerTypeError,
	ensureTeamCustomer,
	updateTeamCustomer,
} from "../../organization/sync";
import { createMockPolarClient, createMockUser } from "../utils/mocks";

const organization: Organization = {
	id: "organization-123",
	name: "Acme",
	slug: "acme",
	logo: null,
	createdAt: new Date(),
};

const createTeamCustomer = (
	overrides: Partial<CustomerTeam> = {},
): CustomerTeam => ({
	id: "customer-123",
	createdAt: new Date(),
	modifiedAt: null,
	metadata: {},
	externalId: organization.id,
	email: null,
	emailVerified: false,
	type: "team",
	name: organization.name,
	billingName: null,
	billingAddress: null,
	taxId: null,
	organizationId: "polar-organization-123",
	deletedAt: null,
	avatarUrl: null,
	...overrides,
});

const createIndividualCustomer = (): CustomerIndividual => ({
	id: "customer-123",
	createdAt: new Date(),
	modifiedAt: null,
	metadata: {},
	externalId: organization.id,
	email: "owner@example.com",
	emailVerified: false,
	type: "individual",
	name: "Owner",
	billingName: null,
	billingAddress: null,
	taxId: null,
	organizationId: "polar-organization-123",
	deletedAt: null,
	avatarUrl: null,
});

const sdkErrorMetadata = (status: number) => ({
	response: new Response("", { status }),
	request: new Request("https://api.polar.sh/v1/customers"),
	body: "",
});

const notFound = () =>
	new ResourceNotFound(
		{ error: "ResourceNotFound", detail: "Customer not found" },
		sdkErrorMetadata(404),
	);

const externalIdConflict = () =>
	new HTTPValidationError(
		{
			detail: [
				{
					loc: ["body", "external_id"],
					msg: "A customer with this external ID already exists.",
					type: "value_error",
					input: organization.id,
				},
			],
		},
		sdkErrorMetadata(422),
	);

describe("organization customer synchronization", () => {
	const owner = createMockUser({
		id: "user-123",
		email: "owner@example.com",
		name: "Owner",
	});
	let client: ReturnType<typeof createMockPolarClient>;

	beforeEach(() => {
		client = createMockPolarClient();
		vi.clearAllMocks();
	});

	it("creates a missing team customer with an explicit owner", async () => {
		vi.mocked(client.customers.getExternal).mockRejectedValue(notFound());
		vi.mocked(client.customers.create).mockResolvedValue(createTeamCustomer());

		await ensureTeamCustomer(
			client,
			{ enabled: true },
			{
				organization,
				owner,
			},
		);

		expect(client.customers.create).toHaveBeenCalledWith({
			type: "team",
			externalId: organization.id,
			name: organization.name,
			owner: {
				externalId: owner.id,
				email: owner.email,
				name: owner.name,
			},
		});
	});

	it("returns an existing team customer without updating it", async () => {
		vi.mocked(client.customers.getExternal).mockResolvedValue(
			createTeamCustomer({ name: "Existing Polar name" }),
		);

		await ensureTeamCustomer(
			client,
			{ enabled: true },
			{
				organization,
				owner,
			},
		);

		expect(client.customers.create).not.toHaveBeenCalled();
		expect(client.customers.updateExternal).not.toHaveBeenCalled();
	});

	it("does not allow custom parameters to override identity fields", async () => {
		vi.mocked(client.customers.getExternal).mockRejectedValue(notFound());
		vi.mocked(client.customers.create).mockResolvedValue(createTeamCustomer());
		const getTeamCustomerCreateParams = vi.fn().mockResolvedValue({
			type: "individual",
			externalId: "other-organization",
			name: "Other name",
			owner: {
				externalId: "other-user",
				email: "other@example.com",
			},
			metadata: { source: "better-auth" },
		});

		await ensureTeamCustomer(
			client,
			{ enabled: true, getTeamCustomerCreateParams },
			{ organization, owner },
		);

		expect(client.customers.create).toHaveBeenCalledWith({
			type: "team",
			externalId: organization.id,
			name: organization.name,
			owner: {
				externalId: owner.id,
				email: owner.email,
				name: owner.name,
			},
			metadata: { source: "better-auth" },
		});
	});

	it("refetches after an external ID creation race", async () => {
		vi.mocked(client.customers.getExternal)
			.mockRejectedValueOnce(notFound())
			.mockResolvedValueOnce(createTeamCustomer());
		vi.mocked(client.customers.create).mockRejectedValue(externalIdConflict());

		await ensureTeamCustomer(
			client,
			{ enabled: true },
			{
				organization,
				owner,
			},
		);

		expect(client.customers.getExternal).toHaveBeenCalledTimes(2);
	});

	it("rejects an individual customer using the organization external ID", async () => {
		vi.mocked(client.customers.getExternal).mockResolvedValue(
			createIndividualCustomer(),
		);

		await expect(
			ensureTeamCustomer(
				client,
				{ enabled: true },
				{
					organization,
					owner,
				},
			),
		).rejects.toBeInstanceOf(PolarOrganizationCustomerTypeError);
	});

	it("does not treat network and unrelated validation errors as absence", async () => {
		const networkError = new Error("Network unavailable");
		vi.mocked(client.customers.getExternal).mockRejectedValue(networkError);

		await expect(
			ensureTeamCustomer(
				client,
				{ enabled: true },
				{
					organization,
					owner,
				},
			),
		).rejects.toBe(networkError);
		expect(client.customers.create).not.toHaveBeenCalled();
	});

	it("updates an organization customer by external ID", async () => {
		vi.mocked(client.customers.updateExternal).mockResolvedValue(
			createTeamCustomer({ name: "New name" }),
		);

		await updateTeamCustomer(client, {
			...organization,
			name: "New name",
		});

		expect(client.customers.updateExternal).toHaveBeenCalledWith({
			externalId: organization.id,
			customerUpdateExternalID: { name: "New name" },
		});
	});
});
