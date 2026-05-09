import { describe, expect, it } from "vitest";
import { getSelectedMenuKey } from "./navigation";

describe("navigation helpers", () => {
  it("keeps sourcing as its own menu item", () => {
    expect(getSelectedMenuKey("/sourcing")).toBe("/sourcing");
  });

  it("keeps job detail highlighted under jobs", () => {
    expect(getSelectedMenuKey("/jobs/abc123")).toBe("/jobs");
  });

  it("does not let jobs match unrelated routes", () => {
    expect(getSelectedMenuKey("/manager-review")).toBe("/manager-review");
  });

  it("keeps admin users highlighted under system management", () => {
    expect(getSelectedMenuKey("/admin/users")).toBe("/admin/users");
  });
});
