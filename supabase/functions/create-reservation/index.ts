import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const out = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

const digits = (x: string) =>
  String(x)
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

const phone = (x: string) => digits(x).replace(/[\s()-]/g, "");
const code = () => "Mafia-" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return out({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const b = await req.json();
    const mode = String(b.mode || "INDIVIDUAL").toUpperCase();
    const event_id = String(b.event_id || "");

    if (!/^[0-9a-f-]{36}$/i.test(event_id))
      return out({ error: "INVALID_REQUEST" }, 400);

    if (mode === "TEAM") {
      const team_name = String(b.team_name || "").trim();
      const captain_name = String(b.captain_name || "").trim();
      const captain_phone = phone(String(b.captain_phone || ""));
      const members = Array.isArray(b.members) ? b.members.map((x: unknown) => String(x || "").trim()) : [];

      if (
        team_name.length < 2 ||
        team_name.length > 80 ||
        captain_name.length < 2 ||
        captain_name.length > 120 ||
        !/^\+?\d{7,15}$/.test(captain_phone) ||
        !members.length
      ) return out({ error: "INVALID_REQUEST" }, 400);

      const { data, error } = await sb.rpc("create_team_reservation", {
        p_event_id: event_id,
        p_team_name: team_name,
        p_captain_name: captain_name,
        p_captain_phone: captain_phone,
        p_members: members
      });

      if (error) {
        const known = [
          "EVENT_NOT_AVAILABLE",
          "REGISTRATION_MODE_MISMATCH",
          "INVALID_TEAM_NAME",
          "INVALID_CAPTAIN_NAME",
          "INVALID_PHONE",
          "INVALID_TEAM_MEMBERS",
          "INVALID_MEMBER_NAME",
          "DUPLICATE_MEMBER_NAMES",
          "EVENT_FULL",
          "TEAM_NAME_ALREADY_USED"
        ];
        const msg = String(error.message || "");
        const found = known.find(x => msg.includes(x));
        return out({ error: found || "RESERVATION_FAILED" }, found === "EVENT_FULL" ? 409 : 400);
      }

      return out(data, 201);
    }

    const seat_id = String(b.seat_id || "");
    const full_name = String(b.full_name || "").trim().replace(/\s+/g, " ");
    const p = phone(String(b.phone || ""));
    const guest_count = Number(b.guest_count || 1);
    const notes = String(b.notes || "").trim();

    if (
      !/^[0-9a-f-]{36}$/i.test(seat_id) ||
      full_name.length < 2 ||
      full_name.length > 120 ||
      !/^\+?\d{7,15}$/.test(p) ||
      !Number.isInteger(guest_count) ||
      guest_count < 1 ||
      guest_count > 20 ||
      notes.length > 1000
    ) return out({ error: "INVALID_REQUEST" }, 400);

    const e = await sb.from("events")
      .select("id,title,persian_title,event_date,start_time,location,price,status")
      .eq("id", event_id)
      .eq("status", "PUBLISHED")
      .maybeSingle();

    if (e.error || !e.data) return out({ error: "EVENT_NOT_AVAILABLE" }, 409);

    if (e.data.registration_mode && e.data.registration_mode !== "INDIVIDUAL")
      return out({ error: "REGISTRATION_MODE_MISMATCH" }, 409);

    const s = await sb.from("seats")
      .select("id,event_id,seat_number,status")
      .eq("id", seat_id)
      .eq("event_id", event_id)
      .maybeSingle();

    if (s.error || !s.data) return out({ error: "SEAT_NOT_FOUND" }, 404);
    if (s.data.status === "DISABLED") return out({ error: "SEAT_DISABLED" }, 409);

    const u = await sb.from("users")
      .upsert({ full_name, phone: p }, { onConflict: "phone" })
      .select("id")
      .single();

    if (u.error) return out({ error: "RESERVATION_FAILED" }, 500);

    let r;
    for (let i = 0; i < 3; i++) {
      r = await sb.from("reservations").insert({
        reservation_code: code(),
        event_id,
        seat_id,
        user_id: u.data.id,
        full_name,
        phone: p,
        guest_count,
        notes,
        status: "PENDING"
      }).select("id,reservation_code,event_id,seat_id,full_name,phone,guest_count,notes,status,created_at").single();

      if (!r.error || r.error.code !== "23505") break;
    }

    if (r.error)
      return out(
        { error: r.error.code === "23505" ? "SEAT_ALREADY_RESERVED" : "RESERVATION_FAILED" },
        r.error.code === "23505" ? 409 : 500
      );

    return out({ reservation: r.data, event: e.data }, 201);
  } catch (_) {
    return out({ error: "INVALID_REQUEST" }, 400);
  }
});