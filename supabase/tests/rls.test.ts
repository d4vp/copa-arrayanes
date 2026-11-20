/**
 * Pruebas del esquema SQL y de las políticas RLS sobre PostgreSQL real (PGlite).
 * Simula el entorno de Supabase: esquema auth, auth.uid() y roles anon/authenticated.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const ids = {
  admin: "00000000-0000-0000-0000-000000000001",
  org: "00000000-0000-0000-0000-000000000002",
  plan: "00000000-0000-0000-0000-000000000003",
  dele: "00000000-0000-0000-0000-000000000004",
};

async function as(user: keyof typeof ids | "anon", sql: string, params: unknown[] = []) {
  await db.exec(user === "anon"
    ? `reset role; select set_config('request.jwt.sub', '', false); set role anon;`
    : `reset role; select set_config('request.jwt.sub', '${ids[user]}', false); set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const sql = readFileSync(join(__dirname, "../migrations/20261119000001_schema.sql"), "utf8");
  await db.exec(sql);
  await db.exec(readFileSync(join(__dirname, "../migrations/20261120000004_asistente.sql"), "utf8"));
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    insert into auth.users (id, email) values
      ('${ids.admin}','a@x.co'),('${ids.org}','o@x.co'),('${ids.plan}','p@x.co'),('${ids.dele}','d@x.co');
    update profiles set role='admin' where id='${ids.admin}';
    update profiles set role='organizador' where id='${ids.org}';
    update profiles set role='planillero' where id='${ids.plan}';
  `);
});

describe("esquema y RLS", () => {
  let editionId = "", catId = "", teamA = "", teamB = "", matchId = "";

  it("crea perfiles automáticamente con rol mínimo", async () => {
    const r = await db.query<{ role: string }>(`select role from profiles where id=$1`, [ids.dele]);
    expect(r.rows[0].role).toBe("delegado");
  });

  it("el público lee pero no escribe", async () => {
    const r = await as("anon", "select count(*)::int n from sports");
    expect((r.rows[0] as { n: number }).n).toBe(2);
    await expect(as("anon", "insert into editions (name, year) values ('Hack', 2026)")).rejects.toThrow();
  });

  it("el organizador crea edición, categoría, equipos y partidos", async () => {
    editionId = ((await as("org", "insert into editions (name, year, status) values ('Copa Arrayanes 2026', 2026, 'en_desarrollo') returning id")).rows[0] as { id: string }).id;
    catId = ((await as("org", `insert into categories (edition_id, sport_id, branch, name) values ($1,'microfutbol','masculino','Masculino') returning id`, [editionId])).rows[0] as { id: string }).id;
    teamA = ((await as("org", "insert into teams (name) values ('Halcones') returning id")).rows[0] as { id: string }).id;
    teamB = ((await as("org", "insert into teams (name) values ('Cóndores') returning id")).rows[0] as { id: string }).id;
    matchId = ((await as("org", `insert into matches (category_id, stage, home_team_id, away_team_id) values ($1,'liga',$2,$3) returning id`, [catId, teamA, teamB])).rows[0] as { id: string }).id;
    expect(matchId).toBeTruthy();
  });

  it("el delegado no puede crear equipos ni asignarse rol", async () => {
    await expect(as("dele", "insert into teams (name) values ('Pirata')")).rejects.toThrow();
    await expect(as("dele", `update profiles set role='admin' where id='${ids.dele}'`)).resolves.toBeDefined();
    const r = await db.query<{ role: string }>(`select role from profiles where id=$1`, [ids.dele]);
    expect(r.rows[0].role).toBe("delegado"); // la política filtra: 0 filas actualizadas
  });

  it("el delegado gestiona solo los jugadores de su equipo", async () => {
    await db.query(`update profiles set team_id=$1 where id=$2`, [teamA, ids.dele]);
    await as("dele", "insert into players (team_id, full_name, number) values ($1,'Juan Pérez',9)", [teamA]);
    await expect(as("dele", "insert into players (team_id, full_name) values ($1,'Intruso')", [teamB])).rejects.toThrow();
  });

  it("el planillero envía planilla y el organizador la aprueba", async () => {
    await expect(as("plan", "update matches set home_score=5 where id=$1 returning id", [matchId]))
      .resolves.toMatchObject({ rows: [] });
    const data = JSON.stringify({ home_score: 2, away_score: 1, events: [{ team_id: teamA, type: "gol" }, { team_id: teamA, type: "gol" }, { team_id: teamB, type: "amarilla" }] });
    const rep = await as("plan", "insert into match_reports (match_id, data) values ($1,$2) returning id", [matchId, data]);
    const repId = (rep.rows[0] as { id: string }).id;
    await expect(as("plan", "select approve_match_report($1)", [repId])).rejects.toThrow(/NO_AUTORIZADO/);
    await as("org", "select approve_match_report($1)", [repId]);
    const m = await db.query<{ home_score: number; status: string }>("select home_score, status from matches where id=$1", [matchId]);
    expect(m.rows[0]).toMatchObject({ home_score: 2, status: "finalizado" });
    const ev = await db.query<{ n: number }>("select count(*)::int n from match_events where match_id=$1", [matchId]);
    expect(ev.rows[0].n).toBe(3);
  });

  it("al finalizar un partido se encola la notificación", async () => {
    const q = await db.query<{ body: string }>("select body from notification_queue where kind='resultado'");
    expect(q.rows[0].body).toBe("Halcones 2 - 1 Cóndores");
  });

  it("encola recordatorios de partidos próximos una sola vez", async () => {
    await as("org", `insert into matches (category_id, stage, home_team_id, away_team_id, scheduled_at) values ($1,'liga',$3,$2, now() + interval '30 minutes')`, [catId, teamA, teamB]);
    expect((await db.query<{ n: number }>("select queue_match_reminders() n")).rows[0].n).toBe(1);
    expect((await db.query<{ n: number }>("select queue_match_reminders() n")).rows[0].n).toBe(0);
  });

  it("una edición finalizada queda protegida", async () => {
    await as("org", "update editions set status='finalizado' where id=$1", [editionId]);
    await expect(as("org", "update matches set home_score=9 where id=$1", [matchId])).rejects.toThrow(/EDICION_CERRADA/);
    await expect(as("org", "update editions set status='en_desarrollo' where id=$1", [editionId])).rejects.toThrow(/EDICION_CERRADA/);
    await as("admin", "update editions set status='en_desarrollo' where id=$1", [editionId]);
    await as("org", "update matches set notes='corregido' where id=$1", [matchId]);
  });

  it("suscripción push anónima solo modificable con su clave", async () => {
    await as("anon", "select save_push_subscription('https://push.example/1','k','secreto',$1::uuid[])", [[teamA]]);
    await as("anon", "select save_push_subscription('https://push.example/1','k','otra',$1::uuid[])", [[teamB]]);
    const s = await db.query<{ favorite_team_ids: string[] }>("select favorite_team_ids from push_subscriptions");
    expect(s.rows[0].favorite_team_ids).toEqual([teamA]);
    await expect(as("anon", "select * from push_subscriptions")).resolves.toMatchObject({ rows: [] });
    await expect(as("anon", "select save_push_subscription('http://inseguro','k','s')")).rejects.toThrow(/SUSCRIPCION_INVALIDA/);
  });

  it("los avisos vencidos no se muestran al público", async () => {
    await as("org", "insert into notices (title, ends_at) values ('Venta de empanadas', now() + interval '1 day'), ('Viejo aviso', now() - interval '1 day')");
    const r = await as("anon", "select title from notices");
    expect(r.rows.map((x) => (x as { title: string }).title)).toEqual(["Venta de empanadas"]);
  });

  it("el consumo del asistente IA solo lo ve el admin y nadie lo falsifica", async () => {
    await db.query(`insert into ai_requests (user_id, kind, model) values ($1, 'foto', 'gpt-4o-mini')`, [ids.plan]);
    expect((await as("plan", "select * from ai_requests")).rows).toHaveLength(0);
    expect((await as("org", "select * from ai_requests")).rows).toHaveLength(0);
    expect((await as("admin", "select * from ai_requests")).rows).toHaveLength(1);
    await expect(as("plan", `insert into ai_requests (user_id, kind, model) values ('${ids.plan}', 'foto', 'x')`)).rejects.toThrow();
  });
});
