// lib/CalculsFinancialData.ts

export type AnnualFinancialData = {
  year: number;

  /**
   * Chiffre d'affaires annuel.
   */
  revenue?: number | null;

  /**
   * Free Cash Flow classique.
   *
   * Utilisé pour :
   * - la marge FCF
   */
  freeCashFlow?: number | null;

  /**
   * Unlevered Free Cash Flow.
   *
   * Utilisé pour :
   * - la croissance de l'UFCF
   * - Dette nette / Unlevered FCF
   */
  unleveredFreeCashFlow?: number | null;

  /**
   * Nombre moyen d'actions diluées.
   */
  dilutedAverageShares?: number | null;

  /**
   * Résultat opérationnel.
   *
   * Sera utilisé pour les futurs calculs
   * de rendement du capital.
   */
  operatingIncome?: number | null;

  /**
   * Charge d'impôt.
   *
   * Utilisée avec le résultat avant impôt
   * pour déterminer le taux d'imposition effectif.
   */
  taxProvision?: number | null;

  /**
   * Résultat avant impôt.
   *
   * Utilisé avec la charge d'impôt
   * pour déterminer le taux d'imposition effectif.
   */
  pretaxIncome?: number | null;

  /**
   * Capitaux propres attribuables aux actionnaires.
   *
   * Sera utilisé pour les futurs calculs
   * de rendement du capital.
   */
  stockholdersEquity?: number | null;

  /**
   * Dette totale.
   *
   * Utilisée avec le cash pour déterminer
   * la dette nette.
   */
  totalDebt?: number | null;

  /**
   * Cash + investissements court terme.
   *
   * Utilisé avec la dette totale pour déterminer
   * la dette nette.
   */
  cashAndShortTermInvestments?: number | null;
};

/**
 * Données nécessaires au critère :
 *
 * Dette nette / Unlevered FCF
 */
export type NetDebtToUnleveredFCFData = {
  /**
   * Dette nette du dernier bilan disponible.
   *
   * Dette totale - Cash & Short-Term Investments
   */
  netDebt: number | null;

  /**
   * Unlevered Free Cash Flow annuel.
   */
  unleveredFreeCashFlow: number | null;

  /**
   * Année de l'Unlevered FCF utilisé.
   */
  unleveredFreeCashFlowYear?: number | null;
};

export type FinancialCriteriaResult = {
  /**
   * Critère 1 :
   * CAGR du chiffre d'affaires 2020 → 2025.
   */
  revenueGrowthCagr: number | null;

  /**
   * Critère 2 :
   * Dette nette / Unlevered FCF.
   */
  netDebtToUnleveredFCF: number | null;

  /**
   * Critère 3 :
   * CAGR de l'Unlevered FCF 2020 → 2025.
   */
  freeCashFlowGrowthCagr: number | null;

  /**
   * Critère 4 :
   * évolution des actions diluées 2020 → 2025.
   */
  dilutedSharesChange: number | null;

  /**
   * Critère 6 :
   * moyenne des marges FCF 2020 → 2025.
   */
  averageFcfMargin: number | null;
};

/**
 * Recherche les données d'une année donnée.
 */
function getYearData(
  data: AnnualFinancialData[],
  year: number
): AnnualFinancialData | undefined {
  return data.find(
    (item) => item.year === year
  );
}

/**
 * ============================================================
 * 1. CROISSANCE DU CHIFFRE D'AFFAIRES
 * ============================================================
 *
 * CAGR 2020 → 2025
 *
 * (CA2025 / CA2020) ^ (1 / 5) - 1
 */
export function calculateRevenueGrowthCagr(
  data: AnnualFinancialData[],
  startYear = 2020,
  endYear = 2025
): number | null {
  const start =
    getYearData(data, startYear)?.revenue;

  const end =
    getYearData(data, endYear)?.revenue;

  if (
    start == null ||
    end == null ||
    start <= 0 ||
    end <= 0 ||
    endYear <= startYear
  ) {
    return null;
  }

  const years =
    endYear - startYear;

  return (
    (Math.pow(
      end / start,
      1 / years
    ) - 1) *
    100
  );
}

/**
 * ============================================================
 * 2. DETTE NETTE / UNLEVERED FCF
 * ============================================================
 */
export function calculateNetDebtToUnleveredFCF(
  data: NetDebtToUnleveredFCFData
): number | null {
  const {
    netDebt,
    unleveredFreeCashFlow,
  } = data;

  if (
    netDebt == null ||
    unleveredFreeCashFlow == null ||
    unleveredFreeCashFlow === 0
  ) {
    return null;
  }

  return (
    netDebt /
    unleveredFreeCashFlow
  );
}

/**
 * ============================================================
 * 3. CROISSANCE DE L'UNLEVERED FCF
 * ============================================================
 *
 * CAGR 2020 → 2025
 *
 * (UFCF2025 / UFCF2020) ^ (1 / 5) - 1
 */
export function calculateFreeCashFlowGrowthCagr(
  data: AnnualFinancialData[],
  startYear = 2020,
  endYear = 2025
): number | null {
  const start =
    getYearData(
      data,
      startYear
    )?.unleveredFreeCashFlow;

  const end =
    getYearData(
      data,
      endYear
    )?.unleveredFreeCashFlow;

  if (
    start == null ||
    end == null ||
    start <= 0 ||
    end <= 0 ||
    endYear <= startYear
  ) {
    return null;
  }

  const years =
    endYear - startYear;

  return (
    (Math.pow(
      end / start,
      1 / years
    ) - 1) *
    100
  );
}

/**
 * ============================================================
 * 4. ACTIONS DILUÉES
 * ============================================================
 *
 * (Actions2025 / Actions2020) - 1
 */
export function calculateDilutedSharesChange(
  data: AnnualFinancialData[],
  startYear = 2020,
  endYear = 2025
): number | null {
  const start =
    getYearData(
      data,
      startYear
    )?.dilutedAverageShares;

  const end =
    getYearData(
      data,
      endYear
    )?.dilutedAverageShares;

  if (
    start == null ||
    end == null ||
    start <= 0 ||
    end <= 0
  ) {
    return null;
  }

  return (
    (end / start - 1) *
    100
  );
}

/**
 * ============================================================
 * 6. MARGE FCF MOYENNE
 * ============================================================
 *
 * Pour chaque année :
 *
 * FCF / CA × 100
 *
 * Puis moyenne 2020 → 2025.
 */
export function calculateAverageFreeCashFlowMargin(
  data: AnnualFinancialData[],
  startYear = 2020,
  endYear = 2025
): number | null {
  const margins: number[] = [];

  for (
    let year = startYear;
    year <= endYear;
    year++
  ) {
    const row =
      getYearData(
        data,
        year
      );

    if (
      row?.revenue == null ||
      row?.freeCashFlow == null ||
      row.revenue <= 0
    ) {
      continue;
    }

    const margin =
      (row.freeCashFlow /
        row.revenue) *
      100;

    margins.push(margin);
  }

  if (
    margins.length === 0
  ) {
    return null;
  }

  return (
    margins.reduce(
      (sum, margin) =>
        sum + margin,
      0
    ) / margins.length
  );
}

/**
 * ============================================================
 * CALCUL DES CRITÈRES
 * ============================================================
 */
export function calculateFinancialCriteria(
  data: AnnualFinancialData[],
  netDebtToUnleveredFCFData?: NetDebtToUnleveredFCFData
): FinancialCriteriaResult {
  return {
    revenueGrowthCagr:
      calculateRevenueGrowthCagr(
        data
      ),

    netDebtToUnleveredFCF:
      netDebtToUnleveredFCFData
        ? calculateNetDebtToUnleveredFCF(
            netDebtToUnleveredFCFData
          )
        : null,

    freeCashFlowGrowthCagr:
      calculateFreeCashFlowGrowthCagr(
        data
      ),

    dilutedSharesChange:
      calculateDilutedSharesChange(
        data
      ),

    averageFcfMargin:
      calculateAverageFreeCashFlowMargin(
        data
      ),
  };
}