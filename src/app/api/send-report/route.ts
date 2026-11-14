import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Este endpoint foi desativado. Envie relatórios através do fluxo autenticado de relatórios da escola." },
    { status: 410 },
  );
}