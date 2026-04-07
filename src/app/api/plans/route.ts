import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePlan } from "@/lib/admin-serialize";

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: "asc" },
    });

    return NextResponse.json(plans.map(serializePlan));
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
