import { elizaLogger } from "@elizaos/core";
import { AgentNFTClient } from "./agentNFTClient";
import { parseArguments } from "./agent";

export const generateAgentNFT = async () => {
    elizaLogger.info("Generating NFT");
    try {
        const args = parseArguments();
        const agentNFTClient = new AgentNFTClient(args.dir);
        await agentNFTClient.generateAgentNFT();
    } catch (error) {
        throw error;
    }
};

generateAgentNFT()
    .then(() => {
        elizaLogger.success("NFT generated successfully");
        process.exit(0);
    })
    .catch((error) => {
        elizaLogger.error("Unhandled error in generateNFT:", error);
        process.exit(1);
    });