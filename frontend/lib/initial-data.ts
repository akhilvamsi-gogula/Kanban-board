import type { Column } from "./types";

export const initialColumns: Column[] = [
  {
    id: "backlog",
    name: "Backlog",
    accent: "#8b95a5",
    cards: [
      {
        id: "map-user-journey",
        title: "Map the user journey",
        details: "Outline the key moments from first touch to activation.",
      },
      {
        id: "review-analytics",
        title: "Review product analytics",
        details: "Pull the top friction points from the latest monthly report.",
      },
    ],
  },
  {
    id: "up-next",
    name: "Up next",
    accent: "#ecad0a",
    cards: [
      {
        id: "write-brief",
        title: "Write the launch brief",
        details: "Capture the audience, message, channels, and success signals.",
      },
      {
        id: "audit-content",
        title: "Audit existing content",
        details: "Gather the strongest proof points and retire anything stale.",
      },
    ],
  },
  {
    id: "in-progress",
    name: "In progress",
    accent: "#209dd7",
    cards: [
      {
        id: "design-system",
        title: "Shape the design system",
        details: "Turn the visual direction into reusable UI patterns.",
      },
      {
        id: "prototype-flow",
        title: "Prototype the core flow",
        details: "Make the happy path tangible enough for an early review.",
      },
    ],
  },
  {
    id: "review",
    name: "Review",
    accent: "#753991",
    cards: [
      {
        id: "qa-release",
        title: "QA the release candidate",
        details: "Check the critical paths on desktop, tablet, and mobile.",
      },
    ],
  },
  {
    id: "done",
    name: "Done",
    accent: "#2f9d70",
    cards: [
      {
        id: "team-alignment",
        title: "Align with the team",
        details: "Share the direction and agree on the next meaningful milestone.",
      },
    ],
  },
];
