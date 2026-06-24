import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canApprove, canCreate, canManageTeam, hasRole, isRole } from "./roles";

describe("roles", () => {
  it("ranks the hierarchy (higher role satisfies lower requirement)", () => {
    assert.equal(hasRole("owner", "viewer"), true);
    assert.equal(hasRole("approver", "approver"), true);
    assert.equal(hasRole("creator", "approver"), false);
    assert.equal(hasRole("viewer", "creator"), false);
  });

  it("canApprove: approver and above only", () => {
    assert.equal(canApprove("owner"), true);
    assert.equal(canApprove("admin"), true);
    assert.equal(canApprove("approver"), true);
    assert.equal(canApprove("creator"), false);
    assert.equal(canApprove("viewer"), false);
  });

  it("canManageTeam: admin and above only", () => {
    assert.equal(canManageTeam("owner"), true);
    assert.equal(canManageTeam("admin"), true);
    assert.equal(canManageTeam("approver"), false);
    assert.equal(canManageTeam("creator"), false);
  });

  it("canCreate: creator and above, never viewer", () => {
    assert.equal(canCreate("owner"), true);
    assert.equal(canCreate("creator"), true);
    assert.equal(canCreate("viewer"), false);
  });

  it("isRole guards unknown strings", () => {
    assert.equal(isRole("owner"), true);
    assert.equal(isRole("approver"), true);
    assert.equal(isRole("superuser"), false);
    assert.equal(isRole(""), false);
  });
});
