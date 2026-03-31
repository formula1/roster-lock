import { RoomEventHandler } from "./RoomEvent";
import { encryptJSON, EncryptedJSONValue, decryptJSON } from "../utils/crypto";
import { z, ZodType } from "zod";
import { Room } from "./types";
import { createSimpleEmitter } from "../utils/SimpleEvent";

export class CommitReveal<T> {
  public onPhaseUpdate = createSimpleEmitter<[state: "begin" | "commit" | "reveal" | "verify" | "end"]>()
  private beginHandler: RoomEventHandler<boolean>;
  private commitHandler: RoomEventHandler<EncryptedJSONValue>;
  private revealHandler: RoomEventHandler<string>;
  constructor(
    private room: Room,
    private prefix: string,
    private retrieveValue: ()=>Promise<T>,
    private finalValueSchema: ZodType<T>
  ){
    this.beginHandler = new RoomEventHandler(
      this.room, this.prefix + "-begin", z.boolean()
    );
    this.commitHandler = new RoomEventHandler(
      this.room, this.prefix + "-commit", z.object({ iv: z.string(), ciphertext: z.string() })
    );
    this.revealHandler = new RoomEventHandler(
      this.room, this.prefix + "-reveal", z.string()
    );
  }
  async waitForValues(){
    this.onPhaseUpdate.emit("begin");
    const beginTurnPromise = this.beginHandler.waitForAllFinished();
    this.beginHandler.sendValue(true);
    await beginTurnPromise;

    this.onPhaseUpdate.emit("commit");
    const commitPromise = this.commitHandler.waitForAllFinished();
    const ownValue = await this.retrieveValue();
    const encryptedOwnValue = await encryptJSON(ownValue);
    this.commitHandler.sendValue(encryptedOwnValue.encrypted);
    const commits = await commitPromise;

    this.onPhaseUpdate.emit("reveal");
    const revealPromise = this.revealHandler.waitForAllFinished();
    this.revealHandler.sendValue(encryptedOwnValue.key);
    const reveals = await revealPromise;

    this.onPhaseUpdate.emit("verify");
    const values: Record<string, T> = {};
    await Promise.all(Object.keys(commits).map(async (userId)=>{
      const committedValue = commits[userId];
      const revealKey = reveals[userId];
      const decryptedMove = await decryptJSON({ key: revealKey, encrypted: committedValue });
      const parsedMove = this.finalValueSchema.safeParse(decryptedMove);
      if(!parsedMove.success) throw new Error(`Invalid value from ${userId}`);
      values[userId] = parsedMove.data;
    }))

    this.onPhaseUpdate.emit("end");
    return values;
  }
  destroy(){
    this.beginHandler.destroy();
    this.commitHandler.destroy();
    this.revealHandler.destroy();
  }
}
