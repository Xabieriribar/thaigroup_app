import {
  bulkPutRecords,
  clearStore,
  deleteRecord,
  getAllRecords,
  getRecord,
  putRecord
} from "@/lib/idb";
import type {
  KeyValueRecord,
  LocationRow,
  MemberRow,
  SessionRecord
} from "@/lib/types";

const SESSION_KEY = "current";
const LAST_SYNC_KEY = "lastSyncAt";

export async function loadSession() {
  try {
    const record = await getRecord<KeyValueRecord<SessionRecord>>(
      "session",
      SESSION_KEY
    );

    return record?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(session: SessionRecord) {
  await putRecord("session", {
    key: SESSION_KEY,
    value: session
  } satisfies KeyValueRecord<SessionRecord>);
}

export async function clearSession() {
  await deleteRecord("session", SESSION_KEY);
}

export async function replaceMembers(members: MemberRow[]) {
  await clearStore("members");
  if (members.length > 0) {
    await bulkPutRecords("members", members);
  }
}

export async function loadMembers() {
  try {
    return await getAllRecords<MemberRow>("members");
  } catch {
    return [];
  }
}

export async function replaceLatestLocations(locations: LocationRow[]) {
  await clearStore("latestLocations");
  if (locations.length > 0) {
    await bulkPutRecords("latestLocations", locations);
  }
}

export async function loadLatestLocations() {
  try {
    return await getAllRecords<LocationRow>("latestLocations");
  } catch {
    return [];
  }
}

export async function saveLatestLocation(location: LocationRow) {
  await putRecord("latestLocations", location);
}

export async function enqueueLocation(location: LocationRow) {
  await putRecord("pendingLocationEvents", location);
}

export async function loadPendingLocations() {
  try {
    const items = await getAllRecords<LocationRow>("pendingLocationEvents");
    return items.sort((left, right) =>
      left.created_at.localeCompare(right.created_at)
    );
  } catch {
    return [];
  }
}

export async function removePendingLocations(ids: string[]) {
  await Promise.all(ids.map((id) => deleteRecord("pendingLocationEvents", id)));
}

export async function saveLastSyncAt(value: string) {
  await putRecord("appSettings", {
    key: LAST_SYNC_KEY,
    value
  } satisfies KeyValueRecord<string>);
}

export async function loadLastSyncAt() {
  try {
    const record = await getRecord<KeyValueRecord<string>>(
      "appSettings",
      LAST_SYNC_KEY
    );

    return record?.value ?? null;
  } catch {
    return null;
  }
}

export async function resetLocalCache() {
  await Promise.all([
    clearSession(),
    clearStore("members"),
    clearStore("latestLocations"),
    clearStore("pendingLocationEvents"),
    clearStore("appSettings")
  ]);
}
