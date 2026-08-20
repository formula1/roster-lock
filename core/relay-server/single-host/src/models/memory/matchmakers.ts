import { Matchmaker, IMatchmakersModel } from "../types/matchmakers";

export class InMemoryMatchmakersModel implements IMatchmakersModel {
  private byId = new Map<string, Matchmaker>();

  async create(input: { name: string, publicKey: string }): Promise<Matchmaker> {
    const now = new Date().toISOString();
    const matchmaker: Matchmaker = {
      id: crypto.randomUUID(),
      name: input.name,
      publicKey: input.publicKey,
      registeredAt: now,
      status: "active",
      updatedAt: now,
    };
    this.byId.set(matchmaker.id, matchmaker);
    return matchmaker;
  }

  async getById(id: string): Promise<Matchmaker | null> {
    return this.byId.get(id) || null;
  }

  async getByPublicKey(publicKey: string): Promise<Matchmaker | null> {
    for (const matchmaker of this.byId.values()) {
      if (matchmaker.publicKey === publicKey) return matchmaker;
    }
    return null;
  }

  async list(): Promise<Array<Matchmaker>> {
    return Array.from(this.byId.values());
  }

  async update(id: string, input: { name: string, publicKey: string }): Promise<boolean> {
    const matchmaker = this.byId.get(id);
    if (!matchmaker) return false;
    matchmaker.name = input.name;
    matchmaker.publicKey = input.publicKey;
    matchmaker.updatedAt = new Date().toISOString();
    return true;
  }

  async setStatus(id: string, status: Matchmaker["status"]): Promise<boolean> {
    const matchmaker = this.byId.get(id);
    if (!matchmaker) return false;
    matchmaker.status = status;
    matchmaker.updatedAt = new Date().toISOString();
    return true;
  }
}
