import { NextRequest, NextResponse } from "next/server";
import { getProfile, upsertProfile } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

  const profile = await getProfile(deviceId);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

  const body = await request.json();
  const profile = await upsertProfile(deviceId, body);

  if (!profile) {
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
