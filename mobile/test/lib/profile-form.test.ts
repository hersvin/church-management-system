import { describe, expect, it } from "vitest";
import {
  birthDateError,
  changedFields,
  toForm,
} from "../../src/lib/profile-form";

const profile = {
  email: "ngozi@example.com",
  phone: null,
  address: "12 Mabini St",
  occupation: null,
  gender: "FEMALE",
  civilStatus: null,
  birthDate: "1990-04-12T00:00:00.000Z",
};

describe("profile form", () => {
  it("fills the form from the profile, with blanks for empty fields", () => {
    expect(toForm(profile)).toEqual({
      email: "ngozi@example.com",
      phone: "",
      address: "12 Mabini St",
      occupation: "",
      gender: "FEMALE",
      civilStatus: null,
      birthDate: "1990-04-12",
    });
  });

  it("sends only what changed, with cleared text as null", () => {
    const form = {
      ...toForm(profile),
      phone: " 0917 000 0000 ",
      address: "  ",
      civilStatus: "MARRIED",
    };
    expect(changedFields(form, profile)).toEqual({
      phone: "0917 000 0000",
      address: null,
      civilStatus: "MARRIED",
    });
    expect(changedFields(toForm(profile), profile)).toEqual({});
  });

  it("sends a cleared birthday as null and a new one as a date", () => {
    expect(
      changedFields({ ...toForm(profile), birthDate: "" }, profile),
    ).toEqual({ birthDate: null });
    expect(
      changedFields({ ...toForm(profile), birthDate: "1991-01-02" }, profile),
    ).toEqual({ birthDate: "1991-01-02" });
  });

  it("checks the birthday format and refuses future or impossible dates", () => {
    const today = new Date("2026-11-26T00:00:00Z");
    expect(birthDateError("", today)).toBeNull();
    expect(birthDateError("1990-04-12", today)).toBeNull();
    expect(birthDateError("12/04/1990", today)).toBe(
      "Use the format YYYY-MM-DD, for example 1990-04-12.",
    );
    expect(birthDateError("1990-02-31", today)).toBe(
      "This date does not exist.",
    );
    expect(birthDateError("2030-01-01", today)).toBe(
      "A birthday cannot be in the future.",
    );
  });
});
