import { describe, expect, it } from "vitest";
import { formatHourlyRate } from "@/features/rooms/format";

describe("formatHourlyRate", () => {
  it("shows whole pesos without decimals and keeps centavos when present", () => {
    expect(formatHourlyRate(2500)).toBe("₱2,500 / hour");
    expect(formatHourlyRate(350.5)).toBe("₱350.50 / hour");
  });

  it("calls out a free room and a room with no rate", () => {
    expect(formatHourlyRate(0)).toBe("Free");
    expect(formatHourlyRate(null)).toBe("No rate set");
  });
});
