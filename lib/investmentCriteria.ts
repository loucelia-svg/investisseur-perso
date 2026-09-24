export const investmentCriteria = [
  {
    id: 1,
    name: "Free Cash Flow",
    description:
      "Le Free Cash Flow doit être positif.",
    threshold: "> 0",
  },

  {
    id: 2,
    name: "Dette nette / Unlevered FCF",
    description:
      "La dette nette doit être inférieure à 3 fois l'Unlevered Free Cash Flow.",
    threshold: "< 3",
  },

  {
    id: 3,
    name: "ROCE",
    description:
      "La moyenne du ROCE sur les 5 derniers exercices doit être supérieure à 15 %.",
    threshold: "> 15 %",
  },

  {
    id: 4,
    name: "Croissance du FCF",
    description:
      "Le Free Cash Flow doit progresser de plus de 10 % chaque année.",
    threshold: "> 10 % / an",
  },

  {
    id: 5,
    name: "Croissance du chiffre d'affaires",
    description:
      "Le chiffre d'affaires doit progresser de plus de 10 % chaque année.",
    threshold: "> 10 % / an",
  },

  {
    id: 6,
    name: "Nombre d'actions",
    description:
      "Le nombre moyen d'actions diluées doit rester stable ou diminuer chaque année.",
    threshold: "≤ 0 % / an",
  },

  {
    id: 7,
    name: "Cash Conversion Rate",
    description:
      "Le Free Cash Flow / bénéfice net doit être supérieur à 1 chaque année.",
    threshold: "> 1",
  },

  {
    id: 8,
    name: "Marge FCF",
    description:
      "La marge FCF moyenne sur les 5 derniers exercices doit être supérieure à 10 %.",
    threshold: "> 10 %",
  },
];