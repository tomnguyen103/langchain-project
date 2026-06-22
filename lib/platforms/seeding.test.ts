import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SocialAccount } from "@/db/schema";

import { seedGroupPosts, type SeedableConnector } from "./seeding";

const account = {} as SocialAccount;
const post = (id: string) => ({
  externalPostId: id,
  groupId: "g",
  author: "a",
  text: "t",
  createdAt: new Date(0),
});

describe("seedGroupPosts", () => {
  it("is a clean no-op for a non-seeding connector", async () => {
    let listed = false;
    const connector: SeedableConnector = {
      capabilities: { supportsSeeding: false },
      listGroupPosts: async () => {
        listed = true;
        return [];
      },
      interactWithPost: async () => ({ externalId: "x" }),
    };

    const count = await seedGroupPosts(connector, account, {
      maxInteractions: 5,
      comment: "hi",
    });

    assert.equal(count, 0);
    assert.equal(listed, false); // never even fetched
  });

  it("interacts up to the rate cap and stops", async () => {
    const interacted: string[] = [];
    const connector: SeedableConnector = {
      capabilities: { supportsSeeding: true },
      listGroupPosts: async () => [post("p1"), post("p2"), post("p3"), post("p4")],
      interactWithPost: async (_account, p) => {
        interacted.push(p.externalPostId);
        return { externalId: `c_${p.externalPostId}` };
      },
    };

    const count = await seedGroupPosts(connector, account, {
      maxInteractions: 2,
      comment: "nice post",
    });

    assert.equal(count, 2);
    assert.deepEqual(interacted, ["p1", "p2"]);
  });
});
