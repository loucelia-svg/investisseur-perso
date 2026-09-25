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
   * - Dette nette / FCF
   * - la croissance du FCF
   * - la marge FCF
   */
  freeCashFlow?: number | null;

  /**
   * Nombre moyen d'actions diluées.
   */
  dilutedAverageShares?: number | null;

  /**
   * Résultat opérationnel.
   *
   * Conservé pour les autres calculs
   * financiers de l'application.
   */
  operatingIncome?: number | null;

  /**
   * Charge d'impôt.
   */
  taxProvision?: number | null;

  /**
   * Résultat avant impôt.
   */
  pretaxIncome?: number | null;

  /**
   * Capitaux propres attribuables
   * aux actionnaires.
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
 * Dette nette / Free Cash Flow
 */
export type NetDebtToFCFData = {
  /**
   * Dette nette du dernier bilan disponible.
   *
   * Dette totale - Cash & Short-Term Investments
   */
  netDebt: number | null;

  /**
   * Free Cash Flow annuel utilisé
   * pour le ratio.
   */
  freeCashFlow: number | null;

  /**
   * Année du FCF utilisé.
   */
  freeCashFlowYear?: number | null;
};

export type FinancialCriteriaResult = {
  /**
   * Critère 1 :
   * CAGR du chiffre d'affaires.
   */
  revenueGrowthCagr: number | null;

  /**
   * Critère 2 :
   * Dette nette / Free Cash Flow.
   */
  netDebtToFCF: number | null;

  /**
   * Critère 3 :
   * CAGR du Free Cash Flow.
   */
  freeCashFlowGrowthCagr: number | null;

  /**
   * Critère 4 :
   * évolution du nombre d'actions diluées.
   */
  dilutedSharesChange: number | null;

  /**
   * Critère 6 :
   * moyenne des marges FCF.
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
 * CAGR :
 *
 * (CA fin / CA début) ^ (1 / nombre d'années) - 1
 */
export function calculateRevenueGrowthCagr(
  data: AnnualFinancialData[],
  startYear = 2020,
  endYear = 2025
): number | null {
  const start =
    getYearData(
      data,
      startYear
    )?.revenue;

  const end =
    getYearData(
      data,
      endYear
    )?.revenue;

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
    (
      Math.pow(
        end / start,
        1 / years
      ) - 1
    ) *
    100
  );
}

/**
 * ============================================================
 * 2. DETTE NETTE / FREE CASH FLOW
 * ============================================================
 *
 * Dette nette :
 *
 * Dette totale
 * - Cash & Short-Term Investments
 *
 * Puis :
 *
 * Dette nette / FCF
 */
export function calculateNetDebtToFCF(
  data: NetDebtToFCFData
): number | null {
  const {
    netDebt,
    freeCashFlow,
  } = data;

  if (
    netDebt == null ||
    freeCashFlow == null ||
    freeCashFlow === 0
  ) {
    return null;
  }

  return (
    netDebt /
    freeCashFlow
  );
}

/**
 * ============================================================
 * 3. CROISSANCE DU FREE CASH FLOW
 * ============================================================
 *
 * CAGR :
 *
 * (FCF fin / FCF début) ^ (1 / nombre d'années) - 1
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
    )?.freeCashFlow;

  const end =
    getYearData(
      data,
      endYear
    )?.freeCashFlow;

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
    (
      Math.pow(
        end / start,
        1 / years
      ) - 1
    ) *
    100
  );
}

/**
 * ============================================================
 * 4. ACTIONS DILUÉES
 * ============================================================
 *
 * (Actions fin / Actions début) - 1
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
    (
      end / start -
      1
    ) *
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
 * Puis moyenne sur la période.
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
      (
        row.freeCashFlow /
        row.revenue
      ) *
      100;

    margins.push(
      margin
    );
  }

  if (
    margins.length === 0
  ) {
    return null;
  }

  return (
    margins.reduce(
      (
        sum,
        margin
      ) =>
        sum + margin,
      0
    ) /
    margins.length
  );
}

/**
 * ============================================================
 * CALCUL DES CRITÈRES
 * ============================================================
 */
export function calculateFinancialCriteria(
  data: AnnualFinancialData[],
  netDebtToFCFData?: NetDebtToFCFData,
  startYear = 2020,
  endYear = 2025
): FinancialCriteriaResult {
  return {
    revenueGrowthCagr:
      calculateRevenueGrowthCagr(
        data,
        startYear,
        endYear
      ),

    netDebtToFCF:
      netDebtToFCFData
        ? calculateNetDebtToFCF(
            netDebtToFCFData
          )
        : null,

    freeCashFlowGrowthCagr:
      calculateFreeCashFlowGrowthCagr(
        data,
        startYear,
        endYear
      ),

    dilutedSharesChange:
      calculateDilutedSharesChange(
        data,
        startYear,
        endYear
      ),

    averageFcfMargin:
      calculateAverageFreeCashFlowMargin(
        data,
        startYear,
        endYear
      ),
  };
}