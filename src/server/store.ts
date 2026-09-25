import { workshopSettings } from "../shared/workshop.js";
import { secretJsonReplacer } from "./secrets.js";
import Database from "better-sqlite3";
import { workshopDate } from "./time.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  Booking,
  Conversation,
  Handoff,
  Service,
  Slot,
  Vehicle,
} from "../shared/domain.js";
export const workshop = {
  ...workshopSettings,
  address: "Hedehusene, Denmark — fictional workshop",
  hours: "Monday–Friday, 08:00–16:00. Closed weekends.",
  phone: "No live phone service — demonstration only",
  policy:
    "Appointments reserve assessment time. Completion times and warranty coverage require a workshop adviser.",
  simulated: true,
};
export const services: Service[] = [
  {
    id: "routine",
    name: "Routine service",
    minutes: 90,
    currency: workshopSettings.currency,
    price: 2490,
    description:
      "Scheduled maintenance assessment. Parts and additional work quoted separately.",
    skill: "general",
  },
  {
    id: "tyres",
    name: "Seasonal tyre change",
    minutes: 30,
    currency: workshopSettings.currency,
    price: 690,
    description: "Change a complete set of wheels supplied with the vehicle.",
    skill: "general",
  },
  {
    id: "brakes",
    name: "Brake inspection",
    minutes: 60,
    currency: workshopSettings.currency,
    price: 990,
    description:
      "Inspect reported brake concerns. Repair is quoted after assessment.",
    skill: "general",
  },
  {
    id: "diagnostic",
    name: "Fault diagnosis",
    minutes: 60,
    currency: workshopSettings.currency,
    price: 1290,
    description:
      "Initial investigation of warning lights, noises or driveability concerns.",
    skill: "diagnostics",
  },
  {
    id: "battery",
    name: "12V battery & charging check",
    minutes: 45,
    currency: workshopSettings.currency,
    price: 790,
    description: "Check the low-voltage battery and charging system.",
    skill: "diagnostics",
  },
  {
    id: "ev",
    name: "EV assessment",
    minutes: 90,
    currency: workshopSettings.currency,
    price: 1490,
    description:
      "Initial EV charging and electrical assessment. No high-voltage battery rebuilds.",
    skill: "ev",
  },
];
export const vehicles: Vehicle[] = [
  {
    id: "v-nora-1",
    customerId: "c-nora",
    make: "Tesla",
    model: "Model 3",
    year: 2021,
    registration: "EV 48261",
    powertrain: "electric",
    history: [
      "2026-03-12: seasonal wheel change. No diagnostic inspection recorded.",
    ],
  },
  {
    id: "v-nora-2",
    customerId: "c-nora",
    make: "Volkswagen",
    model: "Golf",
    year: 2018,
    registration: "BT 73102",
    powertrain: "petrol",
    history: ["2026-01-20: routine service completed."],
  },
  {
    id: "v-erik-1",
    customerId: "c-erik",
    make: "Volvo",
    model: "V60",
    year: 2020,
    registration: "DR 59183",
    powertrain: "hybrid",
    history: ["2026-02-11: 12V battery replaced."],
  },
];
export class Store {
  db: Database.Database;
  constructor(
    path: string | Buffer = ":memory:",
    public now: () => Date = () => new Date(),
  ) {
    if (typeof path === "string" && path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS vehicles(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS technicians(id TEXT PRIMARY KEY,name TEXT NOT NULL,skills TEXT NOT NULL); CREATE TABLE IF NOT EXISTS slots(id TEXT PRIMARY KEY,service_id TEXT NOT NULL REFERENCES services(id),date TEXT NOT NULL,time TEXT NOT NULL,technician_id TEXT NOT NULL REFERENCES technicians(id)); CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),vehicle_id TEXT NOT NULL REFERENCES vehicles(id),service_id TEXT NOT NULL REFERENCES services(id),slot_id TEXT NOT NULL REFERENCES slots(id),status TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1); CREATE UNIQUE INDEX IF NOT EXISTS active_slot ON bookings(slot_id) WHERE status='confirmed'; CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS handoffs(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS model_usage(day TEXT PRIMARY KEY,calls INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,expires_at INTEGER NOT NULL);`,
    );
    this.seed();
  }
  seed() {
    this.db.transaction(() => {
      for (const [id, name] of [
        ["c-nora", "Nora Berg"],
        ["c-erik", "Erik Lund"],
        ["c-new", "Alex Strand"],
      ])
        this.db
          .prepare("INSERT OR IGNORE INTO customers VALUES (?,?)")
          .run(id, name);
      for (const v of vehicles)
        this.db
          .prepare("INSERT OR IGNORE INTO vehicles VALUES (?,?,?)")
          .run(v.id, v.customerId, JSON.stringify(v));
      for (const s of services)
        this.db
          .prepare("INSERT INTO services VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
          .run(s.id, JSON.stringify(s));
      for (const [id, name, skills] of [
        ["t-1", "Ingrid Solheim", "general,diagnostics"],
        ["t-2", "Jonas Dahl", "general,ev"],
        ["t-3", "Sara Vik", "diagnostics,ev"],
      ])
        this.db
          .prepare("INSERT OR IGNORE INTO technicians VALUES (?,?,?)")
          .run(id, name, skills);
      // Separate 90-minute blocks ensure a technician cannot be double-booked across services.
      for (let d = 1; d <= 21; d++) {
        const date = new Date(`${workshopDate(this.now(), d)}T12:00:00Z`);
        if ([0, 6].includes(date.getUTCDay())) continue;
        const day = date.toISOString().slice(0, 10);
        for (const [i, time] of [
          "08:00",
          "09:30",
          "11:00",
          "13:00",
          "14:30",
        ].entries())
          for (const [j, s] of services.entries()) {
            const technicianId =
              s.skill === "general"
                ? j % 2
                  ? "t-2"
                  : "t-1"
                : s.skill === "ev"
                  ? "t-3"
                  : "t-1";
            const id = `${day}_${time}_${s.id}`;
            if ((d + i + j) % 7 === 0) continue;
            this.db
              .prepare("INSERT OR IGNORE INTO slots VALUES (?,?,?,?,?)")
              .run(id, s.id, day, time, technicianId);
          }
      }
      if (!this.db.prepare("SELECT id FROM bookings LIMIT 1").get()) {
        const slot = this.slots("routine")[0];
        if (slot)
          this.db
            .prepare("INSERT INTO bookings VALUES (?,?,?,?,?,?,?)")
            .run(
              "BK-DEMO-NORA",
              "c-nora",
              "v-nora-2",
              "routine",
              slot.id,
              "confirmed",
              1,
            );
        const other = this.slots("tyres")[0];
        if (other)
          this.db
            .prepare("INSERT INTO bookings VALUES (?,?,?,?,?,?,?)")
            .run(
              "BK-DEMO-ERIK",
              "c-erik",
              "v-erik-1",
              "tyres",
              other.id,
              "confirmed",
              1,
            );
      }
    })();
  }
  vehicle(id: string, customerId: string) {
    const row = this.db
      .prepare("SELECT data FROM vehicles WHERE id=? AND customer_id=?")
      .get(id, customerId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Vehicle) : undefined;
  }
  customerVehicles(customerId: string) {
    return (
      this.db
        .prepare("SELECT data FROM vehicles WHERE customer_id=?")
        .all(customerId) as { data: string }[]
    ).map((r) => JSON.parse(r.data) as Vehicle);
  }
  slot(id: string) {
    return this.db
      .prepare(
        "SELECT id,service_id AS serviceId,date,time,technician_id AS technicianId FROM slots WHERE id=?",
      )
      .get(id) as Slot | undefined;
  }
  slots(serviceId: string, date?: string) {
    return this.db
      .prepare(
        `SELECT s.id,s.service_id AS serviceId,s.date,s.time,s.technician_id AS technicianId FROM slots s WHERE s.service_id=? AND s.date>? AND (? IS NULL OR s.date=?) AND NOT EXISTS(SELECT 1 FROM bookings b JOIN slots occupied ON b.slot_id=occupied.id WHERE b.status='confirmed' AND occupied.date=s.date AND occupied.time=s.time AND occupied.technician_id=s.technician_id) ORDER BY s.date,s.time LIMIT 12`,
      )
      .all(
        serviceId,
        workshopDate(this.now()),
        date ?? null,
        date ?? null,
      ) as Slot[];
  }
  booking(id: string, customerId: string) {
    return this.db
      .prepare(
        "SELECT id,customer_id AS customerId,vehicle_id AS vehicleId,service_id AS serviceId,slot_id AS slotId,status,version FROM bookings WHERE id=? AND customer_id=?",
      )
      .get(id, customerId) as Booking | undefined;
  }
  bookings(customerId?: string) {
    return this.db
      .prepare(
        `SELECT id,customer_id AS customerId,vehicle_id AS vehicleId,service_id AS serviceId,slot_id AS slotId,status,version FROM bookings ${customerId ? "WHERE customer_id=?" : ""}`,
      )
      .all(...(customerId ? [customerId] : [])) as Booking[];
  }
  save(c: Conversation) {
    this.db
      .prepare(
        "INSERT INTO conversations VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(c.id, c.customerId, JSON.stringify(c, secretJsonReplacer));
  }
  conversation(id: string, customerId: string) {
    const r = this.db
      .prepare("SELECT data FROM conversations WHERE id=? AND customer_id=?")
      .get(id, customerId) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as Conversation) : undefined;
  }
  all<T>(table: "conversations" | "handoffs" | "requests") {
    return (
      this.db
        .prepare(`SELECT data FROM ${table} ORDER BY rowid DESC LIMIT 100`)
        .all() as { data: string }[]
    ).map((r) => JSON.parse(r.data) as T);
  }
  getHandoff(id: string, customerId: string) {
    const row = this.db
      .prepare("SELECT data FROM handoffs WHERE id=? AND customer_id=?")
      .get(id, customerId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Handoff) : undefined;
  }
  handoff(h: Handoff) {
    this.db
      .prepare(
        "INSERT INTO handoffs VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(h.id, h.customerId, JSON.stringify(h, secretJsonReplacer));
  }
  consumeModelBudget(limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 0) return false;
    return this.db.transaction(() => {
      const day = this.now().toISOString().slice(0, 10);
      const row = this.db
        .prepare("SELECT calls FROM model_usage WHERE day=?")
        .get(day) as { calls: number } | undefined;
      if ((row?.calls ?? 0) >= limit) return false;
      this.db
        .prepare(
          "INSERT INTO model_usage VALUES (?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1",
        )
        .run(day);
      return true;
    })();
  }
  close() {
    this.db.close();
  }
}
