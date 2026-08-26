import { describe, expect, it } from "vitest";
import { missionLibrary } from "./missions";

describe("buyer mission library", () => {
  it("contains 30 unique, executable mission definitions", () => {
    expect(missionLibrary).toHaveLength(30);
    expect(new Set(missionLibrary.map((mission) => mission.id)).size).toBe(30);
    expect(missionLibrary.every((mission) => mission.budget > 0)).toBe(true);
    expect(missionLibrary.every((mission) => mission.maxDeliveryDays > 0)).toBe(true);
    expect(missionLibrary.every((mission) => mission.confirmationRequired)).toBe(true);
  });

  it("covers both US and Germany plus four risk suites", () => {
    expect(new Set(missionLibrary.map((mission) => mission.destinationCountry))).toEqual(
      new Set(["DE", "US"]),
    );
    expect(new Set(missionLibrary.map((mission) => mission.suite))).toEqual(
      new Set(["预算与币种", "跨境配送", "事实与认证", "退货与授权"]),
    );
  });
});
