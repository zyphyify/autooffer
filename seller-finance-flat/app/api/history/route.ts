import { NextRequest, NextResponse } from "next/server";
import { getHistory, getAnalysisById, deleteAnalysis } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const analysis = await getAnalysisById(id);
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }
    return NextResponse.json({ analysis });
  }

  const history = await getHistory(deviceId);
  return NextResponse.json({ history });
}

export async function DELETE(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Analysis ID required" }, { status: 400 });
  }

  const success = await deleteAnalysis(id, deviceId);
  if (!success) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
