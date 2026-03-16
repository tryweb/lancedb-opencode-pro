import { createServer } from "node:net";
import type { MemoryRecord } from "./types.js";

export interface PortServiceRequest {
  name: string;
  containerPort: number;
  preferredHostPort?: number;
}

export interface PortReservation {
  id: string;
  project: string;
  service: string;
  hostPort: number;
  containerPort: number;
  protocol: "tcp";
}

export interface PortAssignment {
  project: string;
  service: string;
  hostPort: number;
  containerPort: number;
  protocol: "tcp";
}

export interface PlanPortsInput {
  project: string;
  services: PortServiceRequest[];
  rangeStart: number;
  rangeEnd: number;
  reservations: PortReservation[];
}

type PortChecker = (port: number) => Promise<boolean>;

export function parsePortReservations(records: MemoryRecord[]): PortReservation[] {
  const parsed: PortReservation[] = [];

  for (const record of records) {
    let metadata: unknown;
    try {
      metadata = JSON.parse(record.metadataJson);
    } catch {
      continue;
    }

    if (!isPortReservationMetadata(metadata)) continue;

    parsed.push({
      id: record.id,
      project: metadata.project,
      service: metadata.service,
      hostPort: metadata.hostPort,
      containerPort: metadata.containerPort,
      protocol: "tcp",
    });
  }

  return parsed;
}

export async function planPorts(input: PlanPortsInput, checker: PortChecker = isTcpPortAvailable): Promise<PortAssignment[]> {
  const reservedByPort = new Map<number, Set<string>>();
  for (const reservation of input.reservations) {
    const key = reservationKey(reservation.project, reservation.service, reservation.protocol);
    if (!reservedByPort.has(reservation.hostPort)) {
      reservedByPort.set(reservation.hostPort, new Set());
    }
    reservedByPort.get(reservation.hostPort)?.add(key);
  }

  const occupied = new Set<number>();
  const planUsed = new Set<number>();
  const checked = new Map<number, boolean>();
  const assignments: PortAssignment[] = [];

  for (const service of input.services) {
    const serviceKey = reservationKey(input.project, service.name, "tcp");
    const preferred = Number.isInteger(service.preferredHostPort) ? Number(service.preferredHostPort) : undefined;
    const candidate = await pickCandidatePort({
      preferredHostPort: preferred,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      serviceKey,
      reservedByPort,
      occupied,
      planUsed,
      checked,
      checker,
    });

    if (candidate === null) {
      throw new Error(`No available host port for service '${service.name}' in range ${input.rangeStart}-${input.rangeEnd}.`);
    }

    planUsed.add(candidate);
    occupied.add(candidate);
    assignments.push({
      project: input.project,
      service: service.name,
      hostPort: candidate,
      containerPort: service.containerPort,
      protocol: "tcp",
    });
  }

  return assignments;
}

export function reservationKey(project: string, service: string, protocol: "tcp"): string {
  return `${project}\u0000${service}\u0000${protocol}`;
}

export async function isTcpPortAvailable(port: number): Promise<boolean> {
  if (!isValidPort(port)) return false;

  return new Promise<boolean>((resolve) => {
    const server = createServer();

    const finish = (result: boolean): void => {
      server.removeAllListeners();
      server.close(() => resolve(result));
    };

    server.once("error", () => finish(false));
    server.once("listening", () => finish(true));

    server.listen({ host: "0.0.0.0", port, exclusive: true });
  });
}

function isPortReservationMetadata(value: unknown): value is {
  type: "port-reservation";
  project: string;
  service: string;
  hostPort: number;
  containerPort: number;
  protocol?: string;
} {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.type === "port-reservation"
    && typeof data.project === "string"
    && typeof data.service === "string"
    && Number.isInteger(data.hostPort)
    && Number.isInteger(data.containerPort)
    && (data.protocol === undefined || data.protocol === "tcp");
}

async function pickCandidatePort(input: {
  preferredHostPort?: number;
  rangeStart: number;
  rangeEnd: number;
  serviceKey: string;
  reservedByPort: Map<number, Set<string>>;
  occupied: Set<number>;
  planUsed: Set<number>;
  checked: Map<number, boolean>;
  checker: PortChecker;
}): Promise<number | null> {
  const candidates: number[] = [];

  if (input.preferredHostPort !== undefined) {
    candidates.push(input.preferredHostPort);
  }

  for (let port = input.rangeStart; port <= input.rangeEnd; port += 1) {
    if (port === input.preferredHostPort) continue;
    candidates.push(port);
  }

  for (const port of candidates) {
    if (!isValidPort(port)) continue;
    if (input.planUsed.has(port) || input.occupied.has(port)) continue;

    const owners = input.reservedByPort.get(port);
    if (owners && (owners.size > 1 || !owners.has(input.serviceKey))) {
      continue;
    }

    let free = input.checked.get(port);
    if (free === undefined) {
      free = await input.checker(port);
      input.checked.set(port, free);
    }

    if (!free) {
      input.occupied.add(port);
      continue;
    }

    return port;
  }

  return null;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
