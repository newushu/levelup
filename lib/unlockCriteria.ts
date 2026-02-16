import type { SupabaseClient } from "@supabase/supabase-js";

export type CriteriaMatchResult = {
  hasRequirements: boolean;
  matched: boolean;
  requiredKeys: string[];
  fulfilledKeys: string[];
};

type AnyAdmin = SupabaseClient<any, "public", any>;

export async function getStudentCriteriaState(admin: AnyAdmin, studentId: string) {
  const [fulfilledRes, reqRes] = await Promise.all([
    admin
      .from("student_unlock_criteria")
      .select("criteria_key,fulfilled")
      .eq("student_id", studentId),
    admin
      .from("unlock_criteria_item_requirements")
      .select("item_type,item_key,criteria_key"),
  ]);

  const fulfilledRows = fulfilledRes.error ? [] : (fulfilledRes.data ?? []);
  const requirementRows = reqRes.error ? [] : (reqRes.data ?? []);

  const fulfilledKeys = new Set<string>();
  for (const row of fulfilledRows as Array<{ criteria_key?: string | null; fulfilled?: boolean | null }>) {
    if (row?.fulfilled === true) {
      const key = String(row?.criteria_key ?? "").trim();
      if (key) fulfilledKeys.add(key);
    }
  }

  const requirementMap = new Map<string, string[]>();
  for (const row of requirementRows as Array<{ item_type?: string | null; item_key?: string | null; criteria_key?: string | null }>) {
    const itemType = String(row?.item_type ?? "").trim();
    const itemKey = String(row?.item_key ?? "").trim();
    const criteriaKey = String(row?.criteria_key ?? "").trim();
    if (!itemType || !itemKey || !criteriaKey) continue;
    const k = `${itemType}:${itemKey}`;
    const list = requirementMap.get(k) ?? [];
    list.push(criteriaKey);
    requirementMap.set(k, list);
  }

  return { fulfilledKeys, requirementMap };
}

export function matchItemCriteria(
  itemType: string,
  itemKey: string,
  fulfilledKeys: Set<string>,
  requirementMap: Map<string, string[]>
): CriteriaMatchResult {
  const k = `${itemType}:${itemKey}`;
  const requiredKeys = Array.from(new Set(requirementMap.get(k) ?? []));
  if (!requiredKeys.length) {
    return { hasRequirements: false, matched: false, requiredKeys: [], fulfilledKeys: [] };
  }
  const matchedKeys = requiredKeys.filter((key) => fulfilledKeys.has(key));
  const matched = matchedKeys.length === requiredKeys.length;
  return {
    hasRequirements: true,
    matched,
    requiredKeys,
    fulfilledKeys: matchedKeys,
  };
}
