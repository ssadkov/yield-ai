import { EchelonProtocol } from "./echelon";
import { JouleProtocol } from "./joule";
import { AriesProtocol } from "./aries";
import { HyperionProtocol } from "./hyperion";
import { MesoProtocol } from "./meso";
import { AuroProtocol } from "./auro";
import { AmnisProtocol } from "./amnis";
import { BaseProtocol } from "./BaseProtocol";
import { ProtocolKey } from "../transactions/types";

export const protocols: Record<ProtocolKey, BaseProtocol> = {
  echelon: new EchelonProtocol(),
  joule: new JouleProtocol(),
  aries: new AriesProtocol(),
  hyperion: new HyperionProtocol(),
  meso: new MesoProtocol(),
  auro: new AuroProtocol(),
  amnis: new AmnisProtocol(),
}; 