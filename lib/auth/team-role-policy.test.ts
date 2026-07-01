import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideRoleChange, type MembershipRow } from "./team-role-policy";

const owner: MembershipRow = { clerkUserId: "user_owner", role: "owner" };
const admin: MembershipRow = { clerkUserId: "user_admin", role: "admin" };
const viewer: MembershipRow = { clerkUserId: "user_viewer", role: "viewer" };

describe("decideRoleChange", () => {
  it("blocks an admin from self-escalating to owner", () => {
    const decision = decideRoleChange({
      callerRole: "admin",
      targetUserId: admin.clerkUserId,
      nextRole: "owner",
      members: [owner, admin],
    });
    assert.equal(decision.allowed, false);
  });

  it("blocks an admin from granting owner to anyone else", () => {
    const decision = decideRoleChange({
      callerRole: "admin",
      targetUserId: viewer.clerkUserId,
      nextRole: "owner",
      members: [owner, admin, viewer],
    });
    assert.equal(decision.allowed, false);
  });

  it("blocks an admin from demoting the owner", () => {
    const decision = decideRoleChange({
      callerRole: "admin",
      targetUserId: owner.clerkUserId,
      nextRole: "admin",
      members: [owner, admin],
    });
    assert.equal(decision.allowed, false);
  });

  it("allows an owner to grant owner to someone else", () => {
    const decision = decideRoleChange({
      callerRole: "owner",
      targetUserId: admin.clerkUserId,
      nextRole: "owner",
      members: [owner, admin],
    });
    assert.equal(decision.allowed, true);
  });

  it("blocks demoting the last remaining owner, even by another owner", () => {
    const decision = decideRoleChange({
      callerRole: "owner",
      targetUserId: owner.clerkUserId,
      nextRole: "admin",
      members: [owner, admin],
    });
    assert.equal(decision.allowed, false);
  });

  it("allows demoting an owner when another owner remains", () => {
    const secondOwner: MembershipRow = { clerkUserId: "user_owner2", role: "owner" };
    const decision = decideRoleChange({
      callerRole: "owner",
      targetUserId: owner.clerkUserId,
      nextRole: "admin",
      members: [owner, secondOwner, admin],
    });
    assert.equal(decision.allowed, true);
  });

  it("allows an admin to change non-owner roles freely", () => {
    const decision = decideRoleChange({
      callerRole: "admin",
      targetUserId: viewer.clerkUserId,
      nextRole: "creator",
      members: [owner, admin, viewer],
    });
    assert.equal(decision.allowed, true);
  });

  it("allows granting a role to a brand-new member (no existing row)", () => {
    const decision = decideRoleChange({
      callerRole: "admin",
      targetUserId: "user_new",
      nextRole: "creator",
      members: [owner, admin],
    });
    assert.equal(decision.allowed, true);
  });
});
