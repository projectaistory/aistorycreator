import type { Plan } from "@prisma/client";

export function serializePlan(plan: Plan) {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    features: plan.features as unknown,
    monthlyPrice: Number(plan.monthlyPrice),
    yearlyPrice: Number(plan.yearlyPrice),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
