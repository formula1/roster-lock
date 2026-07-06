
import { z, ZodType } from "zod";
import { ScriptStarterCaster } from "./script-caster";
import { runUntrustedScript } from "../../run-script";

const runUntrustedSchema: ZodType<{ pluginDir: string, input: any }> = z.object({
  pluginDir: z.string(),
  input: z.any()
})

export function bindRunUntrustedToProcess(){
  if(!process.send){
    throw new Error("Cannot communicate");
  }
  const send = process.send.bind(process);
  let running = false;
  process.on("message", async (message)=>{
    try {
      if(running){
        throw new Error("Already Running");
      }
      running = true;
      console.log("Recieved Message", message);
      const { pluginDir, input: inputRaw } = runUntrustedSchema.parse(message);
      const input = ScriptStarterCaster.cast(inputRaw, true);
      const result = await runUntrustedScript(pluginDir, input);
      send({
        type: "result",
        data: result
      })
      process.exit(0);
    }catch(e: any){
      send({
        type: "error",
        data: { message: e.message }
      })
      process.exit(1)
    }
  });

  process.on('uncaughtException', (error) => {
    send({
      type: "error",
      data: { 
        message: error.message,
        uncaught: true 
      }
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    send({
      type: "error",
      data: { 
        message: "Unhandled Rejection: " + reason,
        uncaught: true 
      }
    });
    process.exit(1);
  });

  
  send({
    type: "ready"
  })
}
