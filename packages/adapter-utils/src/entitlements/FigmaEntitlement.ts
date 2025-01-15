import { Entitlement } from "../entitlement/entitlement";

export interface FigmaTeamEntitlementProperties {
	[key: string]: string;
	figmaTeamId: string;
}

export const FigmaTeam = Entitlement<FigmaTeamEntitlementProperties>()
	.grant(async (context) => {
		/** figma.team.addMember(context.properties.figmaTeamId, context.customer.email) */
	})
	.revoke(async (context) => {
		/** figma.team.removeMember(context.properties.figmaTeamId, context.customer.email) */
	})
	.handler("figma-team");
