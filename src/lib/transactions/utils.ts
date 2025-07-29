import { protocols } from "../protocols/protocolsRegistry";
import { ProtocolKey } from "./types";

export function getProtocol(protocolKey: ProtocolKey) {
  console.log("Getting protocol for key:", protocolKey);
  console.log("Available protocols:", Object.keys(protocols));
  
  const protocol = protocols[protocolKey];
  console.log("Found protocol:", protocol);
  
  if (!protocol) {
    throw new Error(`Protocol ${protocolKey} not found`);
  }
  
  return protocol;
} 