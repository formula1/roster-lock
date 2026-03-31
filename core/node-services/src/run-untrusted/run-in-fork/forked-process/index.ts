
import { ScriptStarterCaster } from "./script-caster";
import { runUntrustedScript } from "../../run-script";

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
      const input = ScriptStarterCaster.cast(message, true);
      const result = await runUntrustedScript(input);
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
