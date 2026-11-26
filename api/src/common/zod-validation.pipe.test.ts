import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(z.object({ n: z.coerce.number().int() }));

  it("returns parsed data", () => {
    expect(pipe.transform({ n: "5" })).toEqual({ n: 5 });
  });

  it("throws BadRequest with field issues", () => {
    expect.assertions(2);
    try {
      pipe.transform({ n: "x" });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as { issues: { path: string }[] };
      expect(body.issues[0].path).toBe("n");
    }
  });
});
