"use client";

import { Login } from "@/components/Login";
import { Me } from "@/components/Me";
import { Register } from "@/components/Register";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const onClickCheckout = async () => {
    const { data: state } = await authClient.checkout({
      products: ["e651f46d-ac20-4f26-b769-ad088b123df2"],
      referenceId: (await authClient.organization.list())?.data?.[0]?.id,
    });
  };

  const onClickCustomerPortal = async () => {
    const { data: state } = await authClient.customer.portal();
  };

  const onClickCustomerState = async () => {
    const { data: state } = await authClient.customer.state();
    console.log(state);
  };

  const onClickOrganization = async () => {
    const { data: state } = await authClient.organization.create({
      name: "My Organization",
      slug: "my-organization",
    });
  };

  const onClickIngest = async () => {
    const { data: ingestion } = await authClient.usage.ingest({
      event: "user.created",
      metadata: {
        email: "test@test.com",
      },
    });

    console.log(ingestion);
  };

  const onClickSubscriptions = async () => {
    const organizationId = (await authClient.organization.list())?.data?.[0]
      ?.id;
    console.log(organizationId);
    const { data: subs } = await authClient.customer.subscriptions.list({
      query: {
        page: 1,
        limit: 10,
        referenceId: organizationId,
      },
    });
    console.log(subs);
  };

  return (
    <div className="flex flex-row gap-4 items-center justify-center h-screen">
      <Me />
      <Register />
      <Login />
      <div className="flex flex-col gap-4 items-center justify-center">
        <button onClick={onClickCheckout} type="button">
          Checkout
        </button>
        <button onClick={onClickCustomerPortal} type="button">
          Customer Portal
        </button>
        <button onClick={onClickCustomerState} type="button">
          Customer State
        </button>
        <button onClick={onClickOrganization} type="button">
          Organization
        </button>
        <button onClick={onClickIngest} type="button">
          Ingest
        </button>
        <button onClick={onClickSubscriptions} type="button">
          Subscriptions
        </button>
      </div>
    </div>
  );
}
