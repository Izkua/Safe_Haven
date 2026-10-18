// Shared contracts. Every area codes against these types, so announce changes
// in the team chat before editing (see README "Contracts").

export type LatLng = { latitude: number; longitude: number };

export type MemberStatus = 'safe' | 'need_help' | 'unknown';

export interface Member {
  uid: string;
  name: string;
  location: LatLng | null;
  /** ms epoch of `location`; used to grey out stale pins offline */
  locationTs: number | null;
  status: MemberStatus;
}

export type PlaceType = 'meeting' | 'shelter' | 'hospital' | 'open_area' | 'custom';

export interface Place {
  id: string;
  name: string;
  coord: LatLng;
  type: PlaceType;
  /** Street address, when the place was set by typing one in. */
  address?: string;
  /** [UI] Meeting points: who set it and when (ms epoch), shown to the group. */
  setBy?: string;
  setByName?: string;
  setAt?: number;
}

export interface Group {
  id: string;
  name: string;
  /** 6-char code others type to join */
  inviteCode: string;
  memberIds: string[];
  meetingPlace: Place | null;
  safeAreas: Place[];
  /** Latest practice drill someone started; every member's app shows it once. */
  drill?: GroupDrill | null;
  /** Prepared choices; saving one does not move the active meeting point. */
  disasterHavens?: Partial<Record<HazardType, Place>>;
  /** Retained while a disaster haven is the active shared destination. */
  usualMeetingPlace?: Place | null;
  activeHaven?: HazardType | null;
}

/** An announcement to a group (stored at groups/{groupId}/announcements/{id}). */
export interface Announcement {
  id: string;
  groupId: string;
  /** Group name at send time, so saved announcements still say where they came from. */
  groupName: string;
  /** The headline, shown bold. */
  title: string;
  /** Optional extra line, shown in italics. */
  details: string;
  senderId: string;
  senderName: string;
  /** ms epoch, set by the sender's phone */
  sentAt: number;
  /** uids of members who dismissed it ("seen"). Missing on announcements saved by older builds. */
  ackedBy?: string[];
}

/** A practice drill shared with the whole group (stored on the group doc). */
export interface GroupDrill {
  id: string;
  hazard: HazardType;
  center: LatLng;
  startedBy: string;
  startedByName: string;
  /** ms epoch */
  at: number;
}

export interface Route {
  targetId: string;
  targetName: string;
  from: LatLng;
  to: LatLng;
  points: LatLng[];
  distanceM: number;
  durationS: number;
  fetchedAt: number;
  /** true when we couldn't reach a routing API and drew a straight line */
  isStraightLine: boolean;
}

export type AlertSource = 'nws' | 'usgs' | 'simulated';
export type HazardType = 'earthquake' | 'tsunami' | 'flood' | 'wildfire' | 'hurricane' | 'tornado';
export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';

export interface HazardAlert {
  id: string;
  source: AlertSource;
  /** Group that started this drill, independent of the currently selected group. */
  groupId?: string;
  /** Which kind of disaster; drives the safety steps. Optional because some feeds don't say. */
  hazard?: HazardType;
  title: string;
  description: string;
  instruction: string | null;
  severity: AlertSeverity;
  /** outer rings of affected polygons, if the feed gives them */
  areas: LatLng[][];
  center: LatLng | null;
  issuedAt: number;
  expiresAt: number | null;
}

export interface TileRegion {
  cacheFormat?: 'native-v1';
  centers?: LatLng[];
  pathTemplate?: string;
  attribution?: string;
  attributionUrl?: string;
  center: LatLng;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  downloadedAt: number;
}

/** Everything we need to keep guiding the user with zero network. */
export interface OfflineSnapshot {
  personalMeetingPlace?: Place | null;
  version: 1;
  myUid: string | null;
  myName: string;
  /** The current group (kept for snapshots saved before multi-group support). */
  group: Group | null;
  groups?: Group[];
  activeGroupId?: string | null;
  visibleGroupIds?: string[];
  members: Member[];
  route: Route | null;
  tiles: TileRegion | null;
  savedAt: number;
}
