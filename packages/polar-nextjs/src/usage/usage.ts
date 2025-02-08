import {
	Usage as PolarUsage,
	type UsageMeterConfig,
} from "@polar-sh/adapter-utils";
import type { NextRequest, NextResponse } from "next/server";

export const Usage = (config?: UsageMeterConfig) => {
	return new PolarUsage<NextRequest, NextResponse>(config);
};
