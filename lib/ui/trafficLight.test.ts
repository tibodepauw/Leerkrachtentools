import { describe, expect, it } from "vitest";
import { trafficLightLabel } from "@/lib/ui/trafficLight";

describe("trafficLightLabel", () => {
  it("vertaalt interne statuscodes naar leesbare labels", () => {
    expect(trafficLightLabel("groen")).toBe("In orde");
    expect(trafficLightLabel("oranje")).toBe("Lichte afwijking");
    expect(trafficLightLabel("rood")).toBe("Grote afwijking");
  });
});
