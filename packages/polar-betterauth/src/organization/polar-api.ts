import type { Polar } from "@polar-sh/sdk";
import type { CustomerSessionCustomerExternalIDCreate } from "@polar-sh/sdk/models/components/customersessioncustomerexternalidcreate.js";
import type { CustomerTeamCreate } from "@polar-sh/sdk/models/components/customerteamcreate.js";
import type { CustomerUpdateExternalID } from "@polar-sh/sdk/models/components/customerupdateexternalid.js";
import type { MemberCreateFromCustomer } from "@polar-sh/sdk/models/components/membercreatefromcustomer.js";
import type { MemberUpdate } from "@polar-sh/sdk/models/components/memberupdate.js";
import type { MembersListMembersRequest } from "@polar-sh/sdk/models/operations/memberslistmembers.js";

/**
 * The smallest portion of the Polar SDK needed to mirror organizations.
 *
 * Keeping this structural type next to the gateway lets tests provide a fully
 * typed fake without constructing the entire Polar client.
 */
export type PolarOrganizationAPIClient = {
	customers: Pick<
		Polar["customers"],
		"create" | "getExternal" | "updateExternal"
	> & {
		members: Pick<
			Polar["customers"]["members"],
			"createExternal" | "deleteExternal" | "getExternal" | "updateExternal"
		>;
	};
	members: Pick<Polar["members"], "listMembers">;
	customerSessions: Pick<Polar["customerSessions"], "create">;
};

export type CreateTeamCustomerInput = Omit<CustomerTeamCreate, "type">;
export type ListMembersByExternalCustomerInput = Omit<
	MembersListMembersRequest,
	"externalCustomerId"
>;

/**
 * Typed, external-ID-first gateway for Polar team customers and their members.
 *
 * Better Auth organization and user IDs are the canonical identities. The
 * gateway deliberately does not expose member mutations by Polar's internal
 * IDs so later synchronization code cannot accidentally depend on stored
 * Polar identifiers.
 */
export const createPolarOrganizationAPI = (
	client: PolarOrganizationAPIClient,
) => ({
	getCustomerByExternalId: (externalCustomerId: string) =>
		client.customers.getExternal({ externalId: externalCustomerId }),

	createTeamCustomer: (input: CreateTeamCustomerInput) =>
		client.customers.create({ ...input, type: "team" }),

	updateCustomerByExternalId: (
		externalCustomerId: string,
		input: CustomerUpdateExternalID,
	) =>
		client.customers.updateExternal({
			externalId: externalCustomerId,
			customerUpdateExternalID: input,
		}),

	listMembersByExternalCustomerId: (
		externalCustomerId: string,
		input: ListMembersByExternalCustomerInput = {},
	) =>
		client.members.listMembers({
			...input,
			externalCustomerId,
		}),

	getMemberByExternalIds: (
		externalCustomerId: string,
		externalMemberId: string,
	) =>
		client.customers.members.getExternal({
			externalId: externalCustomerId,
			memberExternalId: externalMemberId,
		}),

	createMemberByExternalCustomerId: (
		externalCustomerId: string,
		input: MemberCreateFromCustomer,
	) =>
		client.customers.members.createExternal({
			externalId: externalCustomerId,
			memberCreateFromCustomer: input,
		}),

	updateMemberByExternalIds: (
		externalCustomerId: string,
		externalMemberId: string,
		input: MemberUpdate,
	) =>
		client.customers.members.updateExternal({
			externalId: externalCustomerId,
			memberExternalId: externalMemberId,
			memberUpdate: input,
		}),

	deleteMemberByExternalIds: (
		externalCustomerId: string,
		externalMemberId: string,
	) =>
		client.customers.members.deleteExternal({
			externalId: externalCustomerId,
			memberExternalId: externalMemberId,
		}),

	createCustomerSession: (input: CustomerSessionCustomerExternalIDCreate) =>
		client.customerSessions.create(input),
});

export type PolarOrganizationAPI = ReturnType<
	typeof createPolarOrganizationAPI
>;
