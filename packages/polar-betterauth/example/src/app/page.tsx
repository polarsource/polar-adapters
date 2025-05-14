"use client";

import { Login } from "@/components/Login";
import { Me } from "@/components/Me";
import { Register } from "@/components/Register";
import { authClient } from "@/lib/auth-client";

export default function Home() {
	const onClickCheckout = async () => {
		const { data: state } = await authClient.checkout({
			slug: "pro",
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

		console.log(state);
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
			</div>
		</div>
	);
}
