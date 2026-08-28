export type TrafficLightStatus = "groen" | "oranje" | "rood";

export function trafficLightLabel(status: TrafficLightStatus) {
  switch (status) {
    case "groen":
      return "In orde";
    case "oranje":
      return "Lichte afwijking";
    case "rood":
      return "Grote afwijking";
  }
}
