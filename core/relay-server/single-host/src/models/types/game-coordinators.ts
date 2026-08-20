export type GameCoordinator = {
  id: string;
  name: string;
  successWebhookUrl: string;
  failureWebhookUrl: string | null;
  apiKeyEncrypted: string;
  apiKeyPreview: string;
  registeredAt: string;
  status: "active" | "suspended";
  updatedAt: string;
};

export interface IGameCoordinatorsModel {
  create(input: {
    id: string,
    name: string,
    successWebhookUrl: string,
    failureWebhookUrl: string | null,
    apiKeyEncrypted: string,
    apiKeyPreview: string,
  }): Promise<GameCoordinator>;
  getById(id: string): Promise<GameCoordinator | null>;
  list(): Promise<Array<GameCoordinator>>;
  update(id: string, input: Partial<{
    name: string,
    successWebhookUrl: string,
    failureWebhookUrl: string | null,
    apiKeyEncrypted: string,
    apiKeyPreview: string,
  }>): Promise<boolean>;
  setStatus(id: string, status: GameCoordinator["status"]): Promise<boolean>;
}
