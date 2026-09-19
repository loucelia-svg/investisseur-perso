import { NextResponse } from "next/server";
import { getFundamentals } from "@/lib/fundamentals";

export async function GET() {
  try {
    const [lvmh, hermes] = await Promise.all([
      getFundamentals("MC.PA"),
      getFundamentals("RMS.PA"),
    ]);

    return NextResponse.json({
      LVMH: lvmh,
      Hermès: hermes,
    });
  } catch (error) {
    console.error("Erreur test fundamentals :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les fondamentaux" },
      { status: 500 }
    );
  }
}