import {
  createDecipheriv,
  createHash,
} from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Company = {
  name: "LVMH" | "Hermès";
  isin: string;
  instrument: string;
};

type EncryptedPayload = {
  ct: string;
  iv?: string;
  s: string;
};

type StockResult = {
  name: Company["name"];
  isin: string;
  price: number | null;
  tradingDateTime: string | null;
  error?: string;
};

const BASE_URL =
  "https://live.euronext.com";

const COMPANIES: Company[] = [
  {
    name: "LVMH",
    isin: "FR0000121014",
    instrument: "FR0000121014-XPAR",
  },
  {
    name: "Hermès",
    isin: "FR0000052292",
    instrument: "FR0000052292-XPAR",
  },
];

const DEFAULT_AJAX_SECURE_KEY =
  "24ayqVo7yJma";

function evpBytesToKey(
  password: Buffer,
  salt: Buffer,
  keyLength: number,
  ivLength: number
): {
  key: Buffer;
  iv: Buffer;
} {
  const totalLength =
    keyLength + ivLength;

  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let currentLength = 0;

  while (
    currentLength < totalLength
  ) {
    const hash = createHash("md5");

    hash.update(previous);
    hash.update(password);
    hash.update(salt);

    previous = hash.digest();

    chunks.push(previous);

    currentLength +=
      previous.length;
  }

  const material =
    Buffer.concat(chunks);

  return {
    key: material.subarray(
      0,
      keyLength
    ),
    iv: material.subarray(
      keyLength,
      keyLength + ivLength
    ),
  };
}

function decryptCryptoJsPayload(
  payload: EncryptedPayload,
  password: string
): unknown {
  const salt = Buffer.from(
    payload.s,
    "hex"
  );

  const ciphertext =
    Buffer.from(
      payload.ct,
      "base64"
    );

  const {
    key,
    iv,
  } = evpBytesToKey(
    Buffer.from(
      password,
      "utf8"
    ),
    salt,
    32,
    16
  );

  const decipher =
    createDecipheriv(
      "aes-256-cbc",
      key,
      iv
    );

  const decrypted =
    Buffer.concat([
      decipher.update(
        ciphertext
      ),
      decipher.final(),
    ]).toString("utf8");

  try {
    return JSON.parse(
      decrypted
    );
  } catch {
    return decrypted;
  }
}

function extractAjaxSecureKey(
  html: string
): string | null {
  const patterns = [
    /"ajax_secure"\s*:\s*\{[\s\S]{0,1000}?"kye"\s*:\s*"([^"]+)"/i,
    /ajax_secure[\s\S]{0,1000}?kye["']?\s*[:=]\s*["']([^"']+)["']/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      html.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function decodeHtml(
  value: string
): string {
  return value
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    );
}

function stripTags(
  value: string
): string {
  return decodeHtml(
    value.replace(
      /<[^>]*>/g,
      " "
    )
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractLastTraded(
  html: string
): {
  price: number | null;
  tradingDateTime: string | null;
} {
  const rowMatch =
    html.match(
      /<tr[^>]*>[\s\S]*?<td[^>]*>\s*Last\s+Traded\s*<\/td>([\s\S]*?)<\/tr>/i
    );

  if (!rowMatch) {
    return {
      price: null,
      tradingDateTime: null,
    };
  }

  const row =
    rowMatch[1];

  const cells =
    [
      ...row.matchAll(
        /<td[^>]*>([\s\S]*?)<\/td>/gi
      ),
    ].map(
      (match) =>
        stripTags(match[1])
    );

  const priceText =
    cells[0] ?? "";

  const dateText =
    cells[1] ?? "";

  const normalizedPrice =
    priceText
      .replace(
        /\s/g,
        ""
      )
      .replace(
        /,/g,
        ""
      );

  const price =
    normalizedPrice &&
    Number.isFinite(
      Number(
        normalizedPrice
      )
    )
      ? Number(
          normalizedPrice
        )
      : null;

  const dateMatch =
    dateText.match(
      /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
    );

  let tradingDateTime:
    | string
    | null = null;

  if (dateMatch) {
    const [
      ,
      day,
      month,
      year,
      hour,
      minute,
    ] = dateMatch;

    /*
     * Euronext affiche l'heure locale
     * Europe/Paris.
     *
     * On conserve ici une chaîne ISO
     * sans suffixe Z afin que la page
     * puisse l'afficher proprement.
     */
    tradingDateTime =
      `${year}-${month}-${day}` +
      `T${hour}:${minute}:00`;
  }

  return {
    price,
    tradingDateTime,
  };
}

async function fetchPageAndKey(
  company: Company
): Promise<{
  password: string;
  pageUrl: string;
}> {
  const pageUrl =
    `${BASE_URL}` +
    `/en/product/equities/` +
    `${company.instrument}`;

  const response =
    await fetch(
      pageUrl,
      {
        cache: "no-store",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 " +
            "(Windows NT 10.0; " +
            "Win64; x64) " +
            "AppleWebKit/537.36 " +
            "(KHTML, like Gecko) " +
            "Chrome/153.0.0.0 " +
            "Safari/537.36",
          Accept:
            "text/html," +
            "application/xhtml+xml," +
            "application/xml;q=0.9," +
            "*/*;q=0.8",
          "Accept-Language":
            "en-US,en;q=0.9," +
            "fr;q=0.8",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `Page Euronext ` +
        `${response.status}`
    );
  }

  const html =
    await response.text();

  const password =
    extractAjaxSecureKey(
      html
    ) ??
    DEFAULT_AJAX_SECURE_KEY;

  return {
    password,
    pageUrl,
  };
}

async function fetchCompanyStock(
  company: Company
): Promise<StockResult> {
  try {
    const {
      password,
      pageUrl,
    } =
      await fetchPageAndKey(
        company
      );

    const quoteUrl =
      `${BASE_URL}` +
      `/en/intraday_chart/` +
      `getDetailedQuoteAjax/` +
      `${company.instrument}` +
      `/full`;

    const response =
      await fetch(
        quoteUrl,
        {
          cache: "no-store",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 " +
              "(Windows NT 10.0; " +
              "Win64; x64) " +
              "AppleWebKit/537.36 " +
              "(KHTML, like Gecko) " +
              "Chrome/153.0.0.0 " +
              "Safari/537.36",
            Accept:
              "application/json," +
              " text/javascript," +
              " */*; q=0.01",
            "Accept-Language":
              "en-US,en;q=0.9," +
              "fr;q=0.8",
            Referer: pageUrl,
            "X-Requested-With":
              "XMLHttpRequest",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `Cotation Euronext ` +
          `${response.status}`
      );
    }

    const encrypted =
      (await response.json()) as
        EncryptedPayload;

    if (
      !encrypted ||
      typeof encrypted.ct !==
        "string" ||
      typeof encrypted.s !==
        "string"
    ) {
      throw new Error(
        "Format Euronext inattendu"
      );
    }

    const decrypted =
      decryptCryptoJsPayload(
        encrypted,
        password
      );

    if (
      typeof decrypted !==
      "string"
    ) {
      throw new Error(
        "Réponse déchiffrée " +
          "inattendue"
      );
    }

    const {
      price,
      tradingDateTime,
    } =
      extractLastTraded(
        decrypted
      );

    if (
      price === null
    ) {
      throw new Error(
        "Last Traded introuvable"
      );
    }

    return {
      name: company.name,
      isin: company.isin,
      price,
      tradingDateTime,
    };
  } catch (error) {
    console.error(
      `Erreur cours ` +
        `${company.name} :`,
      error
    );

    return {
      name: company.name,
      isin: company.isin,
      price: null,
      tradingDateTime: null,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

export async function GET() {
  const results =
    await Promise.all(
      COMPANIES.map(
        fetchCompanyStock
      )
    );

  return NextResponse.json(
    results,
    {
      headers: {
        "Cache-Control":
          "no-store, " +
          "no-cache, " +
          "must-revalidate, " +
          "max-age=0",
      },
    }
  );
}
