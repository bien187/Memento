import { z } from "zod";
import { dateSchema, timestampSchema } from "./models";

export const communityPersonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  username: z.string().nullable(),
  private_profile: z.boolean(),
  rank_id: z.string().nullable(),
  branch_id: z.string().nullable(),
  avatar_id: z.uuid().nullable(),
  following: z.boolean(),
  requested: z.boolean(),
  followers: z.number().nullable(),
});
export const communityProfileSchema = communityPersonSchema.extend({
  function_id: z.string().nullable(),
  following_count: z.number().nullable(),
  entry_count: z.number(),
  milestone_count: z.number(),
  share_function: z.boolean(),
  share_service_period: z.boolean(),
  share_connections: z.boolean(),
  periods: z.array(
    z.object({
      id: z.uuid(),
      type: z.string(),
      start_date: dateSchema,
      end_date: dateSchema,
    }),
  ),
});
export const communityEntrySchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  date: dateSchema,
  created_at: timestampSchema,
  subtitle: z.string(),
  content: z.string(),
  milestone: z.boolean(),
  media_ids: z.array(z.uuid()).max(4),
  cover_id: z.uuid().nullable(),
  name: z.string(),
  username: z.string().nullable(),
  avatar_id: z.uuid().nullable(),
  rank_id: z.string().nullable(),
  branch_id: z.string().nullable(),
  start_date: dateSchema.nullable(),
  period_type: z.string().nullable(),
});
export type CommunityPerson = z.infer<typeof communityPersonSchema>;
export type CommunityProfile = z.infer<typeof communityProfileSchema>;
export type CommunityEntry = z.infer<typeof communityEntrySchema>;
export const profileHref = (id: string) =>
  `/community/profile/${encodeURIComponent(id)}`;
