import { Pool } from "pg";
import { GameCoordinator, IGameCoordinatorsModel } from "../types/game-coordinators";

function toGameCoordinator(row: any): GameCoordinator {
  return {
    id: row.id,
    name: row.name,
    successWebhookUrl: row.success_webhook_url,
    failureWebhookUrl: row.failure_webhook_url,
    apiKeyEncrypted: row.api_key_encrypted,
    apiKeyPreview: row.api_key_preview,
    registeredAt: row.registered_at,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export class PostgresGameCoordinatorsModel implements IGameCoordinatorsModel {
  constructor(private pool: Pool) {}

  async create(input: {
    id: string,
    name: string,
    successWebhookUrl: string,
    failureWebhookUrl: string | null,
    apiKeyEncrypted: string,
    apiKeyPreview: string,
  }): Promise<GameCoordinator> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO game_coordinators
         (id, name, success_webhook_url, failure_webhook_url, api_key_encrypted, api_key_preview, registered_at, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $7)
       RETURNING *`,
      [input.id, input.name, input.successWebhookUrl, input.failureWebhookUrl, input.apiKeyEncrypted, input.apiKeyPreview, now]
    );
    return toGameCoordinator(rows[0]);
  }

  async getById(id: string): Promise<GameCoordinator | null> {
    const { rows } = await this.pool.query(`SELECT * FROM game_coordinators WHERE id = $1`, [id]);
    return rows[0] ? toGameCoordinator(rows[0]) : null;
  }

  async list(): Promise<Array<GameCoordinator>> {
    const { rows } = await this.pool.query(`SELECT * FROM game_coordinators ORDER BY registered_at`);
    return rows.map(toGameCoordinator);
  }

  async update(id: string, input: Partial<{
    name: string,
    successWebhookUrl: string,
    failureWebhookUrl: string | null,
    apiKeyEncrypted: string,
    apiKeyPreview: string,
  }>): Promise<boolean> {
    const columns: Record<string, string> = {
      name: "name",
      successWebhookUrl: "success_webhook_url",
      failureWebhookUrl: "failure_webhook_url",
      apiKeyEncrypted: "api_key_encrypted",
      apiKeyPreview: "api_key_preview",
    };
    const fields = (Object.keys(columns) as Array<keyof typeof columns>)
      .filter((key) => input[key as keyof typeof input] !== undefined)
      .map((key) => [columns[key], input[key as keyof typeof input]] as const);

    const values = fields.map(([, value]) => value);
    const setClauses = fields.map(([column], i) => `${column} = $${i + 2}`);
    setClauses.push(`updated_at = $${fields.length + 2}`);

    const { rowCount } = await this.pool.query(
      `UPDATE game_coordinators SET ${setClauses.join(", ")} WHERE id = $1`,
      [id, ...values, new Date().toISOString()]
    );
    return (rowCount ?? 0) > 0;
  }

  async setStatus(id: string, status: GameCoordinator["status"]): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE game_coordinators SET status = $2, updated_at = $3 WHERE id = $1`,
      [id, status, new Date().toISOString()]
    );
    return (rowCount ?? 0) > 0;
  }
}
