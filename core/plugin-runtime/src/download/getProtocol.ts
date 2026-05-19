import { ProtocolHandler } from "@roster-lock/types";

export function getURLProtocol(
  url: string, availableProtocols: Array<ProtocolHandler>
){
  for(const protocol of availableProtocols){
    try {
      if(protocol.validateURL(url)) return protocol
    }catch(e){
    }
  }
}

