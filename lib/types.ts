export type LocationSource = "gps" | "manual";

export interface GroupRow {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface MemberRow {
  id: string;
  group_id: string;
  display_name: string;
  avatar: string;
  color: string;
  created_at: string;
}

export interface LocationRow {
  id: string;
  member_id: string;
  group_id: string;
  lat: number;
  lon: number;
  accuracy: number | null;
  created_at: string;
  source: LocationSource;
}

export interface SessionRecord {
  group: GroupRow;
  member: MemberRow;
  sharingEnabled: boolean;
  joinedAt: string;
}

export interface GroupSnapshot {
  group: GroupRow;
  members: MemberRow[];
  latestLocations: LocationRow[];
}

export interface CreateGroupInput {
  groupName: string;
  displayName: string;
  avatar: string;
  color: string;
}

export interface JoinGroupInput {
  code: string;
  displayName: string;
  avatar: string;
  color: string;
}

export interface MemberPresence {
  member: MemberRow;
  location: LocationRow | null;
  isSelf: boolean;
  isStale: boolean;
}

export interface KeyValueRecord<T = unknown> {
  key: string;
  value: T;
}
