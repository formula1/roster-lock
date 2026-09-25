import { Pool } from "pg";
import { Matchmaker, IMatchmakersModel } from "../types/matchmakers";

function toMatchmaker(row: any): Matchmaker {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    registeredAt: row.registered_at,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export class PostgresMatchmakersModel implements IMatchmakersModel {
  constructor(private pool: Pool) {}

  async create(input: { name: string, publicKey: string }): Promise<Matchmaker> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO matchmakers (id, name, public_key, registered_at, status, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $4)
       RETURNING *`,
      [crypto.randomUUID(), input.name, input.publicKey, now]
    );
    return toMatchmaker(rows[0]);
  }

  async getById(id: string): Promise<Matchmaker | null> {
    const { rows } = await this.pool.query(`SELECT * FROM matchmakers WHERE id = $1`, [id]);
    return rows[0] ? toMatchmaker(rows[0]) : null;
  }

  async getByPublicKey(publicKey: string): Promise<Matchmaker | null> {
    const { rows } = await this.pool.query(`SELECT * FROM matchmakers WHERE public_key = $1`, [publicKey]);
    return rows[0] ? toMatchmaker(rows[0]) : null;
  }

  async list(): Promise<Array<Matchmaker>> {
    const { rows } = await this.pool.query(`SELECT * FROM matchmakers ORDER BY registered_at`);
    return rows.map(toMatchmaker);
  }

  async update(id: string, input: { name: string, publicKey: string }): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE matchmakers SET name = $2, public_key = $3, updated_at = $4 WHERE id = $1`,
      [id, input.name, input.publicKey, new Date().toISOString()]
    );
    return (rowCount ?? 0) > 0;
  }

  async setStatus(id: string, status: Matchmaker["status"]): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE matchmakers SET status = $2, updated_at = $3 WHERE id = $1`,
      [id, status, new Date().toISOString()]
    );
    return (rowCount ?? 0) > 0;
  }
}
