import { prisma } from "@/lib/prisma";
import { serializePlan } from "@/lib/admin-serialize";
import { HomePage } from "@/components/homepage/home-page";

export default async function Page() {
  let plans: ReturnType<typeof serializePlan>[] = [];
  try {
    const dbPlans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: "asc" },
    });
    plans = dbPlans.map(serializePlan);
  } catch {
    plans = [];
  }

  return <HomePage plans={plans} />;
}
