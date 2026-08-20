import { Admin, IAdminsModel } from "../types/admins";

export class InMemoryAdminsModel implements IAdminsModel {
  private byUsername = new Map<string, Admin>();

  async create(input: { username: string, passwordHash: string, passwordExpiresAt: string | null }): Promise<Admin> {
    const now = new Date().toISOString();
    const admin: Admin = {
      id: crypto.randomUUID(),
      username: input.username,
      passwordHash: input.passwordHash,
      passwordExpiresAt: input.passwordExpiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.byUsername.set(admin.username, admin);
    return admin;
  }

  async getByUsername(username: string): Promise<Admin | null> {
    return this.byUsername.get(username) || null;
  }

  async list(): Promise<Array<Admin>> {
    return Array.from(this.byUsername.values());
  }

  async updatePassword(username: string, input: { passwordHash: string, passwordExpiresAt: string | null }): Promise<boolean> {
    const admin = this.byUsername.get(username);
    if (!admin) return false;
    admin.passwordHash = input.passwordHash;
    admin.passwordExpiresAt = input.passwordExpiresAt;
    admin.updatedAt = new Date().toISOString();
    return true;
  }

  async delete(username: string): Promise<boolean> {
    return this.byUsername.delete(username);
  }
}
