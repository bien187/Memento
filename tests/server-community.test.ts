import { beforeEach, describe, expect, it, vi } from "vitest";
import { communityImage } from "@/lib/server/community";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  download: vi.fn(),
  admin: vi.fn(),
  require: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: mocks.require,
  adminClient: mocks.admin,
}));
const owner = crypto.randomUUID(),
  media = crypto.randomUUID();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.require.mockResolvedValue({ client: { rpc: mocks.rpc } });
  mocks.admin.mockReturnValue({
    storage: { from: () => ({ download: mocks.download }) },
  });
  mocks.rpc.mockResolvedValue({
    data: {
      id: media,
      owner_id: owner,
      storage_path: `${owner}/${media}.jpeg`,
      mime: "image/jpeg",
    },
    error: null,
  });
  mocks.download.mockResolvedValue({
    data: new Blob(["image"], { type: "image/jpeg" }),
    error: null,
  });
});
describe("session-authorized community media proxy", () => {
  it("rejects a missing session before requesting a grant or privileged storage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.require.mockRejectedValueOnce(new Error("Authentication required"));
    expect((await communityImage("entry", media)).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("downloads an authorized reference and prevents caching or MIME sniffing", async () => {
    const response = await communityImage("entry", media);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("community_media", {
      media_id: media,
    });
    expect(mocks.download).toHaveBeenCalledWith(`${owner}/${media}.jpeg`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });
  it("resolves avatars by profile ID using the caller session", async () => {
    expect((await communityImage("avatar", owner)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("community_avatar", {
      person: owner,
    });
  });
  it("does not use privileged storage when access is missing, invalid or the path is forged", async () => {
    expect((await communityImage("entry", "invalid")).status).toBe(404);
    expect(mocks.require).not.toHaveBeenCalled();
    for (const data of [
      null,
      {},
      {
        id: media,
        owner_id: owner,
        storage_path: "../private.jpeg",
        mime: "image/jpeg",
      },
    ]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect((await communityImage("entry", media)).status).toBe(404);
    }
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
