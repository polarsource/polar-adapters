import type { CustomerTeam } from "@polar-sh/sdk/models/components/customerteam.js";
import type { Member as PolarMember } from "@polar-sh/sdk/models/components/member.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { organization } from "better-auth/plugins";
import { memberAc } from "better-auth/plugins/organization/access";
import { describe, expect, it, vi } from "vitest";
import type { PolarOrganizationOptions } from "../../organization/types";
import { checkout } from "../../plugins/checkout";
import { portal } from "../../plugins/portal";
import { polar } from "../../server";
import { createMockCheckout, createMockPolarClient } from "../utils/mocks";

const baseURL = "http://localhost:3000";

const notFound = () =>
  new ResourceNotFound(
    { error: "ResourceNotFound", detail: "Customer not found" },
    {
      response: new Response("", { status: 404 }),
      request: new Request("https://api.polar.sh/v1/customers"),
      body: "",
    },
  );

interface IntegrationHarnessOptions {
  creatorRole?: string;
  includeFinanceRole?: boolean;
  mapBetterAuthRoleToPolarRole?: PolarOrganizationOptions["mapBetterAuthRoleToPolarRole"];
  checkout?: boolean;
}

const createIntegrationHarness = (options: IntegrationHarnessOptions = {}) => {
  const database: MemoryDB = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
  };
  const client = createMockPolarClient();
  vi.mocked(client.checkouts.create).mockResolvedValue(createMockCheckout());
  const customers = new Map<string, CustomerTeam>();
  const members = new Map<string, PolarMember>();
  const memberKey = (organizationId: string, userId: string) =>
    `${organizationId}:${userId}`;

  vi.mocked(client.customers.getExternal).mockImplementation(
    async ({ externalId }) => {
      const customer = customers.get(externalId);
      if (!customer) throw notFound();
      return customer;
    },
  );

  vi.mocked(client.customers.create).mockImplementation(async (input) => {
    if (input.type !== "team") {
      throw new Error("Integration harness only supports team customers");
    }
    const customer: CustomerTeam = {
      id: `polar-${input.externalId}`,
      createdAt: new Date(),
      modifiedAt: null,
      metadata: input.metadata ?? {},
      externalId: input.externalId,
      email: null,
      emailVerified: false,
      type: "team",
      name: input.name,
      billingName: null,
      billingAddress: null,
      taxId: null,
      organizationId: "polar-organization",
      deletedAt: null,
      avatarUrl: null,
    };
    customers.set(input.externalId, customer);
    members.set(memberKey(input.externalId, input.owner.externalId), {
      id: `polar-member-${input.owner.externalId}`,
      createdAt: new Date(),
      modifiedAt: null,
      customerId: customer.id,
      email: input.owner.email,
      name: input.owner.name ?? null,
      externalId: input.owner.externalId,
      role: "owner",
    });
    return customer;
  });

  vi.mocked(client.customers.updateExternal).mockImplementation(
    async ({ externalId, customerUpdateExternalID }) => {
      const customer = customers.get(externalId);
      if (!customer) throw notFound();
      const updatedCustomer: CustomerTeam = {
        ...customer,
        name: customerUpdateExternalID.name ?? customer.name,
        modifiedAt: new Date(),
      };
      customers.set(externalId, updatedCustomer);
      return updatedCustomer;
    },
  );

  vi.mocked(client.members.listMembers).mockImplementation(
    async ({ externalCustomerId, role }) => {
      const items = [...members.entries()]
        .filter(
          ([key, member]) =>
            key.startsWith(`${externalCustomerId}:`) &&
            (!role || member.role === role),
        )
        .map(([, member]) => member);
      return {
        result: {
          items,
          pagination: { totalCount: items.length, maxPage: 1 },
        },
        next: vi.fn(),
        async *[Symbol.asyncIterator]() {},
      };
    },
  );

  vi.mocked(client.customers.members.getExternal).mockImplementation(
    async ({ externalId, memberExternalId }) => {
      const member = members.get(memberKey(externalId, memberExternalId));
      if (!member) throw notFound();
      return member;
    },
  );

  vi.mocked(client.customers.members.createExternal).mockImplementation(
    async ({ externalId, memberCreateFromCustomer }) => {
      const customer = customers.get(externalId);
      if (!customer) throw notFound();
      const externalMemberId = memberCreateFromCustomer.externalId;
      if (!externalMemberId) {
        throw new Error("Integration member requires an external ID");
      }
      const member: PolarMember = {
        id: `polar-member-${externalMemberId}`,
        createdAt: new Date(),
        modifiedAt: null,
        customerId: customer.id,
        email: memberCreateFromCustomer.email,
        name: memberCreateFromCustomer.name ?? null,
        externalId: externalMemberId,
        role: memberCreateFromCustomer.role ?? "member",
      };
      members.set(memberKey(externalId, externalMemberId), member);
      return member;
    },
  );

  vi.mocked(client.customers.members.updateExternal).mockImplementation(
    async ({ externalId, memberExternalId, memberUpdate }) => {
      const key = memberKey(externalId, memberExternalId);
      const member = members.get(key);
      if (!member) throw notFound();
      if (memberUpdate.role === "owner") {
        for (const [candidateKey, candidate] of members) {
          if (
            candidateKey.startsWith(`${externalId}:`) &&
            candidate.role === "owner"
          ) {
            members.set(candidateKey, {
              ...candidate,
              role: "billing_manager",
            });
          }
        }
      }
      const updatedMember: PolarMember = {
        ...member,
        email: memberUpdate.email ?? member.email,
        name: memberUpdate.name === undefined ? member.name : memberUpdate.name,
        role: memberUpdate.role ?? member.role,
        modifiedAt: new Date(),
      };
      members.set(key, updatedMember);
      return updatedMember;
    },
  );

  vi.mocked(client.customers.members.deleteExternal).mockImplementation(
    async ({ externalId, memberExternalId }) => {
      if (!members.delete(memberKey(externalId, memberExternalId))) {
        throw notFound();
      }
    },
  );

  const auth = betterAuth({
    baseURL,
    secret: "better-auth-secret-that-is-long-enough-for-tests",
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    user: { deleteUser: { enabled: true } },
    rateLimit: { enabled: false },
    plugins: [
      organization({
        creatorRole: options.creatorRole,
        roles:
          options.creatorRole || options.includeFinanceRole
            ? {
                ...(options.creatorRole
                  ? { [options.creatorRole]: memberAc }
                  : {}),
                ...(options.includeFinanceRole ? { finance: memberAc } : {}),
              }
            : undefined,
      }),
      polar({
        client,
        createCustomerOnSignUp: false,
        organization: {
          enabled: true,
          mapBetterAuthRoleToPolarRole: options.mapBetterAuthRoleToPolarRole,
        },
        use: options.checkout
          ? [
              checkout({
                products: [{ slug: "pro", productId: "product-pro" }],
              }),
            ]
          : [],
      }),
    ],
  });

  const post = (path: string, body: unknown, cookie?: string) =>
    auth.handler(
      new Request(`${baseURL}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  const signUp = async (data: {
    email: string;
    password: string;
    name: string;
  }) => {
    const response = await post("/sign-up/email", data);
    if (!response.ok) {
      throw new Error(`Sign-up failed: ${await response.text()}`);
    }
    const sessionCookie = response.headers
      .get("set-cookie")
      ?.match(/better-auth\.session_token=[^;,]+/)?.[0];
    if (!sessionCookie) {
      throw new Error("Sign-up returned no Better Auth session cookie");
    }
    const body = (await response.json()) as {
      user: { id: string; email: string; name: string };
    };
    return { sessionCookie, user: body.user };
  };

  const createOrganization = async (
    sessionCookie: string,
    data: { name: string; slug: string },
  ) => {
    const response = await post("/organization/create", data, sessionCookie);
    if (!response.ok) {
      throw new Error(`Organization creation failed: ${await response.text()}`);
    }
    return (await response.json()) as { id: string };
  };

  return {
    auth,
    client,
    customers,
    members,
    database,
    post,
    signUp,
    createOrganization,
  };
};

describe("Better Auth organization integration", () => {
  it("creates a Polar team customer through Better Auth's organization endpoint", async () => {
    const { client, signUp, createOrganization } = createIntegrationHarness();
    const { sessionCookie, user } = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });

    const createdOrganization = await createOrganization(sessionCookie, {
      name: "Acme",
      slug: "acme",
    });

    expect(client.customers.create).toHaveBeenCalledOnce();
    expect(client.customers.create).toHaveBeenCalledWith({
      type: "team",
      externalId: createdOrganization.id,
      name: "Acme",
      owner: {
        externalId: user.id,
        email: "owner@example.com",
        name: "Owner",
      },
    });
    expect(client.customers.members.createExternal).not.toHaveBeenCalled();
  });

  it("updates the Polar team customer when the organization is renamed", async () => {
    const { client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const { sessionCookie } = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const createdOrganization = await createOrganization(sessionCookie, {
      name: "Acme",
      slug: "acme",
    });

    const response = await post(
      "/organization/update",
      {
        organizationId: createdOrganization.id,
        data: { name: "Acme Corporation" },
      },
      sessionCookie,
    );
    if (!response.ok) {
      throw new Error(`Organization update failed: ${await response.text()}`);
    }

    expect(client.customers.updateExternal).toHaveBeenCalledOnce();
    expect(client.customers.updateExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      customerUpdateExternalID: { name: "Acme Corporation" },
    });
    expect(client.customers.members.updateExternal).not.toHaveBeenCalled();
  });

  it("creates a Polar member when a user is added directly", async () => {
    const { auth, client, signUp, createOrganization } =
      createIntegrationHarness();
    const { sessionCookie } = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const addedUser = await signUp({
      email: "admin@example.com",
      password: "password123",
      name: "Admin",
    });
    const createdOrganization = await createOrganization(sessionCookie, {
      name: "Acme",
      slug: "acme",
    });

    await auth.api.addMember({
      headers: new Headers({ cookie: sessionCookie }),
      body: {
        organizationId: createdOrganization.id,
        userId: addedUser.user.id,
        role: "admin",
      },
    });

    expect(client.customers.members.createExternal).toHaveBeenCalledOnce();
    expect(client.customers.members.createExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberCreateFromCustomer: {
        externalId: addedUser.user.id,
        email: "admin@example.com",
        name: "Admin",
        role: "billing_manager",
      },
    });
    expect(client.customers.members.updateExternal).not.toHaveBeenCalled();
  });

  it("creates a Polar member only after an invitation is accepted", async () => {
    const { client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const invitedUser = await signUp({
      email: "invited@example.com",
      password: "password123",
      name: "Invited Admin",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });

    const invitationResponse = await post(
      "/organization/invite-member",
      {
        organizationId: createdOrganization.id,
        email: invitedUser.user.email,
        role: "admin",
      },
      owner.sessionCookie,
    );
    if (!invitationResponse.ok) {
      throw new Error(`Invitation failed: ${await invitationResponse.text()}`);
    }
    const invitation = (await invitationResponse.json()) as { id: string };
    expect(client.customers.members.createExternal).not.toHaveBeenCalled();

    const acceptanceResponse = await post(
      "/organization/accept-invitation",
      { invitationId: invitation.id },
      invitedUser.sessionCookie,
    );
    if (!acceptanceResponse.ok) {
      throw new Error(
        `Invitation acceptance failed: ${await acceptanceResponse.text()}`,
      );
    }

    expect(client.customers.members.createExternal).toHaveBeenCalledOnce();
    expect(client.customers.members.createExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberCreateFromCustomer: {
        externalId: invitedUser.user.id,
        email: "invited@example.com",
        name: "Invited Admin",
        role: "billing_manager",
      },
    });
  });

  it("updates the affected Polar member when its Better Auth role changes", async () => {
    const { auth, client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const addedUser = await signUp({
      email: "member@example.com",
      password: "password123",
      name: "Member",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });
    const addedMember = await auth.api.addMember({
      headers: new Headers({ cookie: owner.sessionCookie }),
      body: {
        organizationId: createdOrganization.id,
        userId: addedUser.user.id,
        role: "member",
      },
    });
    if (!addedMember) throw new Error("Better Auth returned no added member");
    vi.mocked(client.customers.members.updateExternal).mockClear();

    const response = await post(
      "/organization/update-member-role",
      {
        organizationId: createdOrganization.id,
        memberId: addedMember.id,
        role: "admin",
      },
      owner.sessionCookie,
    );
    if (!response.ok) {
      throw new Error(`Member role update failed: ${await response.text()}`);
    }

    expect(client.customers.members.updateExternal).toHaveBeenCalledOnce();
    expect(client.customers.members.updateExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberExternalId: addedUser.user.id,
      memberUpdate: { role: "billing_manager" },
    });
  });

  it("transfers Polar ownership when the current Better Auth owner is demoted", async () => {
    const { auth, client, database, post, signUp, createOrganization } =
      createIntegrationHarness();
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const successor = await signUp({
      email: "successor@example.com",
      password: "password123",
      name: "Successor",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });
    const successorMember = await auth.api.addMember({
      headers: new Headers({ cookie: owner.sessionCookie }),
      body: {
        organizationId: createdOrganization.id,
        userId: successor.user.id,
        role: "member",
      },
    });
    if (!successorMember) {
      throw new Error("Better Auth returned no successor member");
    }
    const ownerMember = database.member.find(
      (member) =>
        member.organizationId === createdOrganization.id &&
        member.userId === owner.user.id,
    );
    if (!ownerMember) throw new Error("Better Auth owner member was not found");

    const promoteResponse = await post(
      "/organization/update-member-role",
      {
        organizationId: createdOrganization.id,
        memberId: successorMember.id,
        role: "owner",
      },
      owner.sessionCookie,
    );
    if (!promoteResponse.ok) {
      throw new Error(
        `Successor role update failed: ${await promoteResponse.text()}`,
      );
    }
    vi.mocked(client.customers.members.updateExternal).mockClear();

    const demoteResponse = await post(
      "/organization/update-member-role",
      {
        organizationId: createdOrganization.id,
        memberId: ownerMember.id,
        role: "member",
      },
      owner.sessionCookie,
    );
    if (!demoteResponse.ok) {
      throw new Error(
        `Owner role update failed: ${await demoteResponse.text()}`,
      );
    }

    expect(
      vi.mocked(client.customers.members.updateExternal).mock.calls,
    ).toEqual([
      [
        {
          externalId: createdOrganization.id,
          memberExternalId: successor.user.id,
          memberUpdate: { role: "owner" },
        },
      ],
      [
        {
          externalId: createdOrganization.id,
          memberExternalId: owner.user.id,
          memberUpdate: { role: "member" },
        },
      ],
    ]);
  });

  it("transfers Polar ownership before deleting an owner that leaves", async () => {
    const { auth, client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const successor = await signUp({
      email: "successor@example.com",
      password: "password123",
      name: "Successor",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });
    const successorMember = await auth.api.addMember({
      headers: new Headers({ cookie: owner.sessionCookie }),
      body: {
        organizationId: createdOrganization.id,
        userId: successor.user.id,
        role: "member",
      },
    });
    if (!successorMember) {
      throw new Error("Better Auth returned no successor member");
    }
    const promoteResponse = await post(
      "/organization/update-member-role",
      {
        organizationId: createdOrganization.id,
        memberId: successorMember.id,
        role: "owner",
      },
      owner.sessionCookie,
    );
    if (!promoteResponse.ok) {
      throw new Error(
        `Successor role update failed: ${await promoteResponse.text()}`,
      );
    }
    vi.mocked(client.customers.members.updateExternal).mockClear();
    vi.mocked(client.customers.members.deleteExternal).mockClear();

    const leaveResponse = await post(
      "/organization/leave",
      { organizationId: createdOrganization.id },
      owner.sessionCookie,
    );
    if (!leaveResponse.ok) {
      throw new Error(
        `Organization leave failed: ${await leaveResponse.text()}`,
      );
    }

    expect(client.customers.members.updateExternal).toHaveBeenCalledOnce();
    expect(client.customers.members.updateExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberExternalId: successor.user.id,
      memberUpdate: { role: "owner" },
    });
    expect(client.customers.members.deleteExternal).toHaveBeenCalledOnce();
    expect(client.customers.members.deleteExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberExternalId: owner.user.id,
    });

    expect(
      vi.mocked(client.customers.members.updateExternal).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(client.customers.members.deleteExternal).mock
        .invocationCallOrder[0] ?? 0,
    );
  });

  it("uses a custom Better Auth creator role for Polar ownership and checkout", async () => {
    const { client, post, signUp, createOrganization } =
      createIntegrationHarness({ creatorRole: "founder", checkout: true });
    const founder = await signUp({
      email: "founder@example.com",
      password: "password123",
      name: "Founder",
    });
    const createdOrganization = await createOrganization(
      founder.sessionCookie,
      { name: "Acme", slug: "acme" },
    );

    const checkoutResponse = await post(
      "/checkout",
      {
        slug: "pro",
        organizationId: createdOrganization.id,
        redirect: false,
      },
      founder.sessionCookie,
    );
    if (!checkoutResponse.ok) {
      throw new Error(
        `Founder checkout failed: ${await checkoutResponse.text()}`,
      );
    }

    expect(client.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: createdOrganization.id,
        owner: {
          externalId: founder.user.id,
          email: "founder@example.com",
          name: "Founder",
        },
      }),
    );
    expect(client.checkouts.create).toHaveBeenCalledOnce();
    expect(client.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalCustomerId: createdOrganization.id,
        products: ["product-pro"],
      }),
    );
  });

  it("applies custom Better Auth to Polar role mapping on add and update", async () => {
    const { auth, client, post, signUp, createOrganization } =
      createIntegrationHarness({
        includeFinanceRole: true,
        mapBetterAuthRoleToPolarRole: ({ roles }) =>
          roles.has("finance") ? "billing_manager" : "member",
      });
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const financeUser = await signUp({
      email: "finance@example.com",
      password: "password123",
      name: "Finance",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });

    const financeMember = await auth.api.addMember({
      headers: new Headers({ cookie: owner.sessionCookie }),
      body: {
        organizationId: createdOrganization.id,
        userId: financeUser.user.id,
        role: "finance",
      },
    });
    if (!financeMember) {
      throw new Error("Better Auth returned no finance member");
    }

    expect(client.customers.members.createExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberCreateFromCustomer: {
        externalId: financeUser.user.id,
        email: "finance@example.com",
        name: "Finance",
        role: "billing_manager",
      },
    });
    vi.mocked(client.customers.members.updateExternal).mockClear();

    const roleUpdateResponse = await post(
      "/organization/update-member-role",
      {
        organizationId: createdOrganization.id,
        memberId: financeMember.id,
        role: "member",
      },
      owner.sessionCookie,
    );
    if (!roleUpdateResponse.ok) {
      throw new Error(
        `Finance role update failed: ${await roleUpdateResponse.text()}`,
      );
    }

    expect(client.customers.members.updateExternal).toHaveBeenCalledOnce();
    expect(client.customers.members.updateExternal).toHaveBeenCalledWith({
      externalId: createdOrganization.id,
      memberExternalId: financeUser.user.id,
      memberUpdate: { role: "member" },
    });
  });

  it("calls Polar checkout only for billing-capable organization members", async () => {
    const { auth, client, post, signUp, createOrganization } =
      createIntegrationHarness({ checkout: true });
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const member = await signUp({
      email: "member@example.com",
      password: "password123",
      name: "Member",
    });
    const outsider = await signUp({
      email: "outsider@example.com",
      password: "password123",
      name: "Outsider",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });
    await auth.api.addMember({
      headers: new Headers({ cookie: owner.sessionCookie }),
      body: {
        organizationId: createdOrganization.id,
        userId: member.user.id,
        role: "member",
      },
    });

    const ownerCheckoutResponse = await post(
      "/checkout",
      {
        slug: "pro",
        organizationId: createdOrganization.id,
        redirect: false,
      },
      owner.sessionCookie,
    );

    if (!ownerCheckoutResponse.ok) {
      throw new Error(
        `Owner checkout failed: ${await ownerCheckoutResponse.text()}`,
      );
    }

    expect(client.checkouts.create).toHaveBeenCalledOnce();
    expect(client.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalCustomerId: createdOrganization.id,
        products: ["product-pro"],
      }),
    );
    vi.mocked(client.checkouts.create).mockClear();

    await post(
      "/checkout",
      {
        slug: "pro",
        organizationId: createdOrganization.id,
        redirect: false,
      },
      member.sessionCookie,
    );

    await post(
      "/checkout",
      {
        slug: "pro",
        organizationId: createdOrganization.id,
        redirect: false,
      },
      outsider.sessionCookie,
    );

    expect(client.checkouts.create).not.toHaveBeenCalled();
  });

  it("updates a Polar member profile in every organization", async () => {
    const { client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const user = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Original Name",
    });
    const firstOrganization = await createOrganization(user.sessionCookie, {
      name: "First Organization",
      slug: "first-organization",
    });
    const secondOrganization = await createOrganization(user.sessionCookie, {
      name: "Second Organization",
      slug: "second-organization",
    });
    vi.mocked(client.customers.members.updateExternal).mockClear();

    const response = await post(
      "/update-user",
      { name: "Updated Name" },
      user.sessionCookie,
    );
    if (!response.ok) {
      throw new Error(`User update failed: ${await response.text()}`);
    }

    expect(client.customers.members.updateExternal).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(client.customers.members.updateExternal).mock.calls,
    ).toEqual(
      expect.arrayContaining([
        [
          {
            externalId: firstOrganization.id,
            memberExternalId: user.user.id,
            memberUpdate: {
              email: "owner@example.com",
              name: "Updated Name",
            },
          },
        ],
        [
          {
            externalId: secondOrganization.id,
            memberExternalId: user.user.id,
            memberUpdate: {
              email: "owner@example.com",
              name: "Updated Name",
            },
          },
        ],
      ]),
    );
  });

  it("deletes a Polar member from every organization when the user is deleted", async () => {
    const { auth, client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const firstOwner = await signUp({
      email: "first-owner@example.com",
      password: "password123",
      name: "First Owner",
    });
    const secondOwner = await signUp({
      email: "second-owner@example.com",
      password: "password123",
      name: "Second Owner",
    });
    const deletedUser = await signUp({
      email: "deleted@example.com",
      password: "password123",
      name: "Deleted User",
    });
    const firstOrganization = await createOrganization(
      firstOwner.sessionCookie,
      { name: "First Organization", slug: "first-organization" },
    );
    const secondOrganization = await createOrganization(
      secondOwner.sessionCookie,
      { name: "Second Organization", slug: "second-organization" },
    );
    await auth.api.addMember({
      headers: new Headers({ cookie: firstOwner.sessionCookie }),
      body: {
        organizationId: firstOrganization.id,
        userId: deletedUser.user.id,
        role: "member",
      },
    });
    await auth.api.addMember({
      headers: new Headers({ cookie: secondOwner.sessionCookie }),
      body: {
        organizationId: secondOrganization.id,
        userId: deletedUser.user.id,
        role: "member",
      },
    });
    vi.mocked(client.customers.members.deleteExternal).mockClear();
    vi.mocked(client.customers.members.updateExternal).mockClear();

    const response = await post(
      "/delete-user",
      { password: "password123" },
      deletedUser.sessionCookie,
    );
    if (!response.ok) {
      throw new Error(`User deletion failed: ${await response.text()}`);
    }

    expect(client.customers.members.deleteExternal).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(client.customers.members.deleteExternal).mock.calls,
    ).toEqual(
      expect.arrayContaining([
        [
          {
            externalId: firstOrganization.id,
            memberExternalId: deletedUser.user.id,
          },
        ],
        [
          {
            externalId: secondOrganization.id,
            memberExternalId: deletedUser.user.id,
          },
        ],
      ]),
    );
    expect(client.customers.members.updateExternal).not.toHaveBeenCalled();
  });

  it("retains the Polar team customer when the organization is deleted", async () => {
    const { client, post, signUp, createOrganization } =
      createIntegrationHarness();
    const owner = await signUp({
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
    });
    const createdOrganization = await createOrganization(owner.sessionCookie, {
      name: "Acme",
      slug: "acme",
    });
    vi.mocked(client.customers.delete).mockClear();
    vi.mocked(client.customers.members.deleteExternal).mockClear();

    const response = await post(
      "/organization/delete",
      { organizationId: createdOrganization.id },
      owner.sessionCookie,
    );
    if (!response.ok) {
      throw new Error(`Organization deletion failed: ${await response.text()}`);
    }

    expect(client.customers.delete).not.toHaveBeenCalled();
    expect(client.customers.members.deleteExternal).not.toHaveBeenCalled();
  });

  it("preserves referenceId billing without enabling Polar organization support", async () => {
    const database: MemoryDB = {
      user: [],
      session: [],
      account: [],
      verification: [],
      organization: [],
      member: [],
      invitation: [],
    };
    const client = createMockPolarClient();
    vi.mocked(client.checkouts.create).mockResolvedValue(createMockCheckout());
    vi.mocked(client.subscriptions.list).mockResolvedValue({
      items: [],
      pagination: { total: 0, maxPage: 1 },
    });
    const auth = betterAuth({
      baseURL,
      secret: "better-auth-secret-that-is-long-enough-for-tests",
      database: memoryAdapter(database),
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: false },
      plugins: [
        organization(),
        polar({
          client,
          createCustomerOnSignUp: false,
          use: [
            checkout({
              products: [{ slug: "pro", productId: "product-pro" }],
            }),
            portal(),
          ],
        }),
      ],
    });
    const post = (path: string, body: unknown, cookie?: string) =>
      auth.handler(
        new Request(`${baseURL}/api/auth${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
          },
          body: JSON.stringify(body),
        }),
      );

    const signUpResponse = await post("/sign-up/email", {
      email: "legacy-owner@example.com",
      password: "password123",
      name: "Legacy Owner",
    });
    if (!signUpResponse.ok) {
      throw new Error(`Sign-up failed: ${await signUpResponse.text()}`);
    }
    const sessionCookie = signUpResponse.headers
      .get("set-cookie")
      ?.match(/better-auth\.session_token=[^;,]+/)?.[0];
    if (!sessionCookie) {
      throw new Error("Sign-up returned no Better Auth session cookie");
    }
    const { user } = (await signUpResponse.json()) as {
      user: { id: string };
    };

    const organizationResponse = await post(
      "/organization/create",
      { name: "Legacy Acme", slug: "legacy-acme" },
      sessionCookie,
    );
    if (!organizationResponse.ok) {
      throw new Error(
        `Organization creation failed: ${await organizationResponse.text()}`,
      );
    }
    const createdOrganization = (await organizationResponse.json()) as {
      id: string;
    };

    expect(client.customers.create).not.toHaveBeenCalled();

    const checkoutResponse = await post(
      "/checkout",
      {
        slug: "pro",
        referenceId: createdOrganization.id,
        redirect: false,
      },
      sessionCookie,
    );
    if (!checkoutResponse.ok) {
      throw new Error(`Checkout failed: ${await checkoutResponse.text()}`);
    }
    expect(client.checkouts.create).toHaveBeenCalledOnce();
    expect(client.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalCustomerId: user.id,
        products: ["product-pro"],
        metadata: { referenceId: createdOrganization.id },
      }),
    );

    const subscriptionsResponse = await auth.handler(
      new Request(
        `${baseURL}/api/auth/customer/subscriptions/list?referenceId=${createdOrganization.id}&active=true`,
        { headers: { cookie: sessionCookie } },
      ),
    );
    if (!subscriptionsResponse.ok) {
      throw new Error(
        `Subscription lookup failed: ${await subscriptionsResponse.text()}`,
      );
    }
    expect(client.subscriptions.list).toHaveBeenCalledOnce();
    expect(client.subscriptions.list).toHaveBeenCalledWith({
      page: undefined,
      limit: undefined,
      active: true,
      metadata: { referenceId: createdOrganization.id },
    });
    expect(client.customerSessions.create).not.toHaveBeenCalled();
  });
});
