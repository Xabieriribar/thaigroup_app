import { getSupabaseClient } from "@/lib/supabase";
import type {
  CreateGroupInput,
  GroupRow,
  GroupSnapshot,
  JoinGroupInput,
  LocationRow,
  MemberRow,
  SessionRecord
} from "@/lib/types";
import {
  generateGroupCode,
  getErrorMessage,
  normalizeGroupCode,
  trimLabel
} from "@/lib/utils";

function requireSupabase() {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error(
      "Falta la configuración de Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return client;
}

function dedupeLatestLocations(locations: LocationRow[]) {
  const seen = new Set<string>();
  const latest: LocationRow[] = [];

  for (const location of locations) {
    if (seen.has(location.member_id)) {
      continue;
    }

    seen.add(location.member_id);
    latest.push(location);
  }

  return latest;
}

async function fetchLatestLocationsFallback(groupId: string) {
  const supabase = requireSupabase();
  const response = await supabase
    .from("locations")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (response.error) {
    throw new Error(getErrorMessage(response.error));
  }

  return dedupeLatestLocations((response.data ?? []) as LocationRow[]);
}

export async function createGroupSession(input: CreateGroupInput) {
  const supabase = requireSupabase();
  const displayName = trimLabel(input.displayName, 40);
  const groupName = trimLabel(input.groupName, 48);
  const avatar = input.avatar.trim().slice(0, 4) || "😎";

  if (!displayName || !groupName) {
    throw new Error("Completa el nombre visible y el nombre del grupo.");
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateGroupCode();
    const groupResponse = await supabase
      .from("groups")
      .insert({
        code,
        name: groupName
      })
      .select("*")
      .single();

    if (groupResponse.error) {
      if (groupResponse.error.code === "23505") {
        continue;
      }

      throw new Error(getErrorMessage(groupResponse.error));
    }

    const group = groupResponse.data as GroupRow;
    const memberResponse = await supabase
      .from("members")
      .insert({
        group_id: group.id,
        display_name: displayName,
        avatar,
        color: input.color
      })
      .select("*")
      .single();

    if (memberResponse.error) {
      throw new Error(getErrorMessage(memberResponse.error));
    }

    const member = memberResponse.data as MemberRow;
    return {
      group,
      member,
      sharingEnabled: false,
      joinedAt: new Date().toISOString()
    } satisfies SessionRecord;
  }

  throw new Error("No se pudo generar un código de grupo único. Inténtalo otra vez.");
}

export async function joinGroupSession(input: JoinGroupInput) {
  const supabase = requireSupabase();
  const code = normalizeGroupCode(input.code);
  const displayName = trimLabel(input.displayName, 40);
  const avatar = input.avatar.trim().slice(0, 4) || "😎";

  if (!code || !displayName) {
    throw new Error("Completa el código y tu nombre visible.");
  }

  const groupResponse = await supabase
    .from("groups")
    .select("*")
    .eq("code", code)
    .single();

  if (groupResponse.error || !groupResponse.data) {
    throw new Error("No existe un grupo con ese código.");
  }

  const group = groupResponse.data as GroupRow;
  const memberResponse = await supabase
    .from("members")
    .insert({
      group_id: group.id,
      display_name: displayName,
      avatar,
      color: input.color
    })
    .select("*")
    .single();

  if (memberResponse.error) {
    throw new Error(getErrorMessage(memberResponse.error));
  }

  const member = memberResponse.data as MemberRow;
  return {
    group,
    member,
    sharingEnabled: false,
    joinedAt: new Date().toISOString()
  } satisfies SessionRecord;
}

export async function uploadPendingLocations(locations: LocationRow[]) {
  if (locations.length === 0) {
    return;
  }

  const supabase = requireSupabase();
  const response = await supabase
    .from("locations")
    .upsert(locations, { onConflict: "id" });

  if (response.error) {
    throw new Error(getErrorMessage(response.error));
  }
}

export async function fetchGroupSnapshot(groupId: string): Promise<GroupSnapshot> {
  const supabase = requireSupabase();
  const [groupResponse, membersResponse, latestResponse] = await Promise.all([
    supabase.from("groups").select("*").eq("id", groupId).single(),
    supabase
      .from("members")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true }),
    supabase.from("latest_locations").select("*").eq("group_id", groupId)
  ]);

  if (groupResponse.error || !groupResponse.data) {
    throw new Error("No se pudo cargar el grupo actual.");
  }

  if (membersResponse.error) {
    throw new Error(getErrorMessage(membersResponse.error));
  }

  const latestLocations = latestResponse.error
    ? await fetchLatestLocationsFallback(groupId)
    : ((latestResponse.data ?? []) as LocationRow[]);

  return {
    group: groupResponse.data as GroupRow,
    members: (membersResponse.data ?? []) as MemberRow[],
    latestLocations
  };
}
