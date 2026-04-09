import { STORY_DURATION_MAX } from "@/lib/constants";

export const FREE_PLAN_SLUG = "free";
export const FREE_PLAN_MAX_STORY_DURATION_SECONDS = 45;
export const FREE_PLAN_MAX_SAVED_CHARACTERS = 10;

export function isFreePlanSlug(slug: string | null | undefined): boolean {
  return slug === FREE_PLAN_SLUG;
}

/** Max story video length (seconds) allowed for this billing plan. */
export function maxStoryDurationSecondsForPlan(
  planSlug: string | null | undefined
): number {
  return isFreePlanSlug(planSlug)
    ? FREE_PLAN_MAX_STORY_DURATION_SECONDS
    : STORY_DURATION_MAX;
}
