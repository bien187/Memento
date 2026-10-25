import { demoRecords } from "./notebook";
import { defaultPreferences } from "../../src/lib/domain/models";
import type { CommunityEntry } from "../../src/lib/domain/community";
export const viewerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const authorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const publicPhoto = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const secondPhoto = "ffffffff-ffff-4fff-8fff-ffffffffffff";
export const avatarId = "abababab-abab-4bab-8bab-abababababab";
export const own = demoRecords(viewerId);
own.profile.name = "Alex Muster";
own.profile.discoverable = true;
export const preferences = {
  ...defaultPreferences(viewerId),
  active_period_id: own.period.id,
};
export const person = {
  id: authorId,
  name: "Robin Beispiel",
  username: "robin_beispiel",
  private_profile: true,
  rank_id: "soldat",
  branch_id: "luftwaffe",
  avatar_id: avatarId,
  following: true,
  requested: false,
  followers: null,
};
export const requester = {
  ...person,
  id: requestId,
  name: "Kim Beispiel",
  username: "kim_beispiel",
  following: false,
};
export const publicProfile = {
  ...person,
  function_id: null,
  following_count: null,
  entry_count: 25,
  milestone_count: 5,
  share_function: false,
  share_service_period: false,
  share_connections: false,
  periods: [],
};
export const publicEntries: CommunityEntry[] = Array.from(
  { length: 25 },
  (_, i) => ({
    id: `dddddddd-dddd-4ddd-8ddd-${String(i + 1).padStart(12, "0")}`,
    owner_id: authorId,
    date: `2026-01-${String(31 - i).padStart(2, "0")}`,
    created_at: `2026-02-01T12:00:${String(59 - i).padStart(2, "0")}.123456+00:00`,
    subtitle: `Erinnerung ${i + 1}`,
    content:
      `Ein freigegebener Moment ${i + 1}. ` +
      "Erinnerungen verbinden. ".repeat(50),
    milestone: i % 5 === 0,
    media_ids: i === 0 ? [publicPhoto, secondPhoto] : [],
    cover_id: i === 0 ? publicPhoto : null,
    name: person.name,
    username: person.username,
    avatar_id: avatarId,
    rank_id: person.rank_id,
    branch_id: person.branch_id,
    start_date: null,
    period_type: null,
  }),
);
