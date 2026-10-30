export type Matchmaker = {
  id: string;
  name: string;
  publicKey: string;
  registeredAt: string;
  status: "active" | "suspended";
  updatedAt: string;
};

export interface IMatchmakersModel {
  create(input: { name: string, publicKey: string }): Promise<Matchmaker>;
  getById(id: string): Promise<Matchmaker | null>;
  getByPublicKey(publicKey: string): Promise<Matchmaker | null>;
  list(): Promise<Array<Matchmaker>>;
  update(id: string, input: { name: string, publicKey: string }): Promise<boolean>;
  setStatus(id: string, status: Matchmaker["status"]): Promise<boolean>;
}
