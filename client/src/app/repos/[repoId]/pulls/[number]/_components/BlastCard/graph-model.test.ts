import { describe, it, expect } from "vitest";
import type { PrBlastRecord } from "@devdigest/shared";
import { buildBlastGraph } from "./graph-model";

const SAMPLE: PrBlastRecord = {
  status: "ok",
  summary: "2 symbols · 2 callers · 1 endpoint · 0 crons",
  totals: { symbols: 2, callers: 2, endpoints: 1, crons: 0 },
  changed_symbols: [
    { name: "TicketForm", file: "app/_components/TicketForm.tsx", kind: "function" },
    { name: "TicketStream", file: "app/_components/TicketStream.tsx", kind: "function" },
  ],
  downstream: [
    {
      symbol: "TicketForm",
      callers: [
        { name: "HomePage", file: "app/_components/HomePage.tsx", line: 71 },
        { name: "test", file: "app/_components/__tests__/TicketForm.test.tsx", line: 404 },
      ],
      endpoints_affected: ["GET /api/tickets"],
      crons_affected: [],
    },
    {
      symbol: "TicketStream",
      callers: [{ name: "HomePage", file: "app/_components/HomePage.tsx", line: 78 }],
      endpoints_affected: [],
      crons_affected: [],
    },
  ],
};

describe("buildBlastGraph", () => {
  it("creates symbol → caller and symbol → endpoint edges", () => {
    const g = buildBlastGraph(SAMPLE);
    expect(g.nodes.filter((n) => n.kind === "symbol")).toHaveLength(2);
    expect(g.nodes.filter((n) => n.kind === "caller")).toHaveLength(3);
    expect(g.nodes.filter((n) => n.kind === "endpoint")).toHaveLength(1);
    expect(g.edges.length).toBe(4);
    expect(g.nodes.some((n) => n.label.includes("TicketForm"))).toBe(true);
    expect(g.nodes.some((n) => n.label.includes("HomePage.tsx:71"))).toBe(true);
  });
});
