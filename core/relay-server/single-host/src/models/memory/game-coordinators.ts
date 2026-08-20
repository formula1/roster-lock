import { GameCoordinator, IGameCoordinatorsModel } from "../types/game-coordinators";

export class InMemoryGameCoordinatorsModel implements IGameCoordinatorsModel {
  private byId = new Map<string, GameCoordinator>();

  async create(input: {
    id: string,
    name: string,
    successWebhookUrl: string,
    failureWebhookUrl: string | null,
    apiKeyEncrypted: string,
    apiKeyPreview: string,
  }): Promise<GameCoordinator> {
    const now = new Date().toISOString();
    const coordinator: GameCoordinator = {
      id: input.id,
      name: input.name,
      successWebhookUrl: input.successWebhookUrl,
      failureWebhookUrl: input.failureWebhookUrl,
      apiKeyEncrypted: input.apiKeyEncrypted,
      apiKeyPreview: input.apiKeyPreview,
      registeredAt: now,
      status: "active",
      updatedAt: now,
    };
    this.byId.set(coordinator.id, coordinator);
    return coordinator;
  }

  async getById(id: string): Promise<GameCoordinator | null> {
    return this.byId.get(id) || null;
  }

  async list(): Promise<Array<GameCoordinator>> {
    return Array.from(this.byId.values());
  }

  async update(id: string, input: Partial<{
    name: string,
    successWebhookUrl: string,
    failureWebhookUrl: string | null,
    apiKeyEncrypted: string,
    apiKeyPreview: string,
  }>): Promise<boolean> {
    const coordinator = this.byId.get(id);
    if (!coordinator) return false;
    Object.assign(coordinator, input, { updatedAt: new Date().toISOString() });
    return true;
  }

  async setStatus(id: string, status: GameCoordinator["status"]): Promise<boolean> {
    const coordinator = this.byId.get(id);
    if (!coordinator) return false;
    coordinator.status = status;
    coordinator.updatedAt = new Date().toISOString();
    return true;
  }
}
