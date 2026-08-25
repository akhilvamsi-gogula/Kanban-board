export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  name: string;
  accent: string;
  cards: Card[];
};

export type BoardSummary = {
  id: string;
  name: string;
};
