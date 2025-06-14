import { EchelonProtocol } from "./echelon";
import { JouleProtocol } from "./joule";
import { AriesProtocol } from "./aries";
import { BaseProtocol } from "./BaseProtocol";
import { ProtocolKey } from "../transactions/types";

export const protocols: Record<ProtocolKey, BaseProtocol> = {
  echelon: new EchelonProtocol(),
  joule: new JouleProtocol(),
  aries: new AriesProtocol(),
}; 