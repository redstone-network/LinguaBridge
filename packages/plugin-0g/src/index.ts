import { Plugin } from "@elizaos/core";
import { zgUpload } from "./actions/upload";
import { KnowledgeService } from "./services/knowledge";

export const zgPlugin: Plugin = {
    description: "ZeroG Plugin for Eliza",
    name: "ZeroG",
    actions: [zgUpload],
    evaluators: [],
    providers: [],
    services: [new KnowledgeService()],
};
