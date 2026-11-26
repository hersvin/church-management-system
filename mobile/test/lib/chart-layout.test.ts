import { describe, expect, it } from "vitest";
import { chunkLine } from "../../src/lib/chart-layout";

describe("chart layout", () => {
  it("breaks a line into word-sized pieces, each chord staying on the syllable it starts", () => {
    expect(
      chunkLine([
        { chord: null, text: "You were the " },
        { chord: "D", text: "Word at the be" },
        { chord: "A", text: "ginning" },
      ]),
    ).toEqual([
      { chord: null, text: "You " },
      { chord: null, text: "were " },
      { chord: null, text: "the " },
      { chord: "D", text: "Word " },
      { chord: null, text: "at " },
      { chord: null, text: "the " },
      { chord: null, text: "be", joined: true },
      { chord: "A", text: "ginning" },
    ]);
  });

  it("keeps chords with no lyric under them, padded so they do not collide", () => {
    expect(
      chunkLine([
        { chord: null, text: "Instrumental " },
        { chord: "G", text: " " },
        { chord: "A", text: "" },
      ]),
    ).toEqual([
      { chord: null, text: "Instrumental " },
      { chord: "G", text: " " },
      { chord: "A", text: "" },
    ]);
  });
});
