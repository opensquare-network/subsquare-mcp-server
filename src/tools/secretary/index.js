import { registerSecretaryCyclesTools } from "./cycles.js";
import { registerSecretaryMembersTools } from "./members.js";
import { registerSecretaryStatisticsTools } from "./statistics.js";

export function registerSecretaryTools(server) {
  registerSecretaryCyclesTools(server);
  registerSecretaryMembersTools(server);
  registerSecretaryStatisticsTools(server);
}
