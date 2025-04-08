import {
    elizaLogger,
    IAgentRuntime,
    Service,
    ServiceType,
} from "@elizaos/core";
import { Indexer, getFlowContract, KvClient } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import { promises as fs } from "fs";
import path from "path";
import * as crypto from "crypto";
import os from "os";
import { ZgFile } from "@0glabs/0g-ts-sdk";

// IndustryKnowledgeFolder合约ABI
const IndustryKnowledgeFolderABI = [
    "function files(string) view returns (bytes32 hash, uint256 size, address owner, uint256 timestamp, uint8 status, string category, string metadata)",
    "function fileList(uint256) view returns (string)",
    "function getFileCount() view returns (uint256)",
    "function getFilesByStatus(uint8) view returns (string[])",
    "function approveFile(string memory filename, uint256 rewardAmount)",
];

// 文件条目接口
interface FileEntry {
    hash: string;
    size: number;
    owner: string;
    timestamp: number;
    status: number;
    category: string;
    metadata: string;
    filename: string; // 额外添加文件名字段，方便查询
}

// 本地文件元数据接口
interface LocalFileMetadata {
    hash: string;
    size: number;
    owner: string;
    timestamp: number;
    category: string;
    metadata: string;
}

export class KnowledgeService extends Service {
    static serviceType: ServiceType = ServiceType.TRANSCRIPTION;

    private provider: ethers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private indexer: Indexer;
    private flowContract: any;
    private contractAddress: string;
    private contract: ethers.Contract;
    private syncInterval: NodeJS.Timeout | null = null;
    private knowledgeDir: string = path.join(
        path.dirname(process.cwd()),
        "characters",
        "knowledge",
        "shared",
        "industry_fields"
    );
    private runtime: IAgentRuntime;

    async initialize(runtime: IAgentRuntime): Promise<void> {
        try {
            elizaLogger.info("正在初始化KnowledgeService");

            // 初始化区块链连接
            this.provider = new ethers.JsonRpcProvider(
                runtime.getSetting("ZEROG_EVM_RPC")
            );

            this.signer = new ethers.Wallet(
                runtime.getSetting("ZEROG_PRIVATE_KEY"),
                this.provider
            );

            this.indexer = new Indexer(runtime.getSetting("ZEROG_INDEXER_RPC"));

            this.flowContract = getFlowContract(
                runtime.getSetting("ZEROG_FLOW_ADDRESS"),
                this.signer
            );

            // 初始化合约
            this.contractAddress = runtime.getSetting(
                "INDUSTRY_KNOWLEDGE_CONTRACT"
            );
            if (!this.contractAddress) {
                throw new Error("未配置INDUSTRY_KNOWLEDGE_CONTRACT地址");
            }

            this.contract = new ethers.Contract(
                this.contractAddress,
                IndustryKnowledgeFolderABI,
                this.signer
            );

            this.runtime = runtime;

            // 确保知识目录存在
            await this.ensureKnowledgeDir();

            // 启动定时同步
            const syncIntervalMinutes = parseInt(
                runtime.getSetting("KNOWLEDGE_SYNC_INTERVAL") || "3"
            );
            this.startSync(syncIntervalMinutes);

            elizaLogger.info("KnowledgeService初始化完成", {
                contractAddress: this.contractAddress,
                syncIntervalMinutes,
            });
        } catch (error) {
            elizaLogger.error("KnowledgeService初始化失败", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            elizaLogger.info("KnowledgeService同步已停止");
        }
    }

    private startSync(intervalMinutes: number): void {
        // 立即执行一次同步
        this.syncKnowledge().catch((error) => {
            elizaLogger.error("知识同步失败", {
                error: error instanceof Error ? error.message : String(error),
            });
        });

        // 设置定时同步
        this.syncInterval = setInterval(
            () => {
                this.syncKnowledge().catch((error) => {
                    elizaLogger.error("定时知识同步失败", {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
                });
            },
            intervalMinutes * 60 * 1000
        );

        elizaLogger.info("启动知识同步定时任务", { intervalMinutes });
    }

    private async ensureKnowledgeDir(): Promise<void> {
        try {
            await fs.mkdir(this.knowledgeDir, { recursive: true });
            elizaLogger.info("知识库目录已确认", { path: this.knowledgeDir });
        } catch (error) {
            elizaLogger.error("创建知识库目录失败", {
                path: this.knowledgeDir,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    // 同步知识库文件
    private async syncKnowledge(): Promise<void> {
        elizaLogger.info("开始同步知识库");

        try {
            // 先处理待审核的文件
            const pendingFiles = await this.getPendingFiles();
            elizaLogger.info(`获取到${pendingFiles.length}个待审核文件`);

            for (const file of pendingFiles) {
                await this.approveFile(file);
            }

            // 获取所有已审核的文件
            const approvedFiles = await this.getApprovedFiles();
            elizaLogger.info(`获取到${approvedFiles.length}个已审核文件`);

            for (const file of approvedFiles) {
                await this.processFile(file);
            }

            elizaLogger.info("知识库同步完成");
        } catch (error) {
            elizaLogger.error("知识库同步过程中出错", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    // 获取待审核的文件
    private async getPendingFiles(): Promise<FileEntry[]> {
        try {
            // 获取状态为0(待审核)的文件列表
            const pendingFileNames: string[] =
                await this.contract.getFilesByStatus(0);

            // 获取每个文件的详细信息
            const fileEntries: FileEntry[] = [];
            for (const filename of pendingFileNames) {
                const fileData = await this.contract.files(filename);

                // 提取文件信息
                fileEntries.push({
                    hash: fileData[0],
                    size: Number(fileData[1]),
                    owner: fileData[2],
                    timestamp: Number(fileData[3]),
                    status: Number(fileData[4]),
                    category: fileData[5],
                    metadata: fileData[6],
                    filename: filename,
                });
            }

            return fileEntries;
        } catch (error) {
            elizaLogger.error("获取待审核文件列表失败", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    // 审批单个文件
    private async approveFile(file: FileEntry): Promise<void> {
        try {
            // 计算奖励金额 - 这里使用一个基础值,可以根据文件大小或其他因素调整
            const baseReward = 100; // 基础奖励代币数量 //todo使用大模型动态生成baseReward

            const rewardAmount = Math.floor(
                baseReward * (1 + file.size / (1024 * 1024))
            ); // 根据文件大小增加奖励

            elizaLogger.info(`正在审批文件 ${file.filename}`, {
                hash: file.hash,
                size: file.size,
                reward: rewardAmount,
            });

            // 调用合约的approveFile方法
            const tx = await this.contract.approveFile(
                file.filename,
                rewardAmount
            );
            await tx.wait(); // 等待交易确认

            elizaLogger.info(`文件 ${file.filename} 审批成功`, {
                transactionHash: tx.hash,
                reward: rewardAmount,
            });
        } catch (error) {
            elizaLogger.error(`审批文件 ${file.filename} 失败`, {
                error: error instanceof Error ? error.message : String(error),
                filename: file.filename,
                hash: file.hash,
            });
            // 这里我们不抛出错误,让流程继续处理其他文件
        }
    }

    // 获取所有已审核的文件
    private async getApprovedFiles(): Promise<FileEntry[]> {
        try {
            // 获取状态为1(已审核)的文件列表
            const approvedFileNames: string[] =
                await this.contract.getFilesByStatus(1);

            // 获取每个文件的详细信息
            const fileEntries: FileEntry[] = [];
            for (const filename of approvedFileNames) {
                const fileData = await this.contract.files(filename);

                // 提取文件信息
                fileEntries.push({
                    hash: fileData[0],
                    size: Number(fileData[1]),
                    owner: fileData[2],
                    timestamp: Number(fileData[3]),
                    status: Number(fileData[4]),
                    category: fileData[5],
                    metadata: fileData[6],
                    filename: filename,
                });
            }

            return fileEntries;
        } catch (error) {
            elizaLogger.error("获取已审核文件列表失败", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    // 处理单个文件
    private async processFile(file: FileEntry): Promise<void> {
        const localFilePath = path.join(this.knowledgeDir, file.filename);
        let tempFile: ZgFile | undefined;

        console.log("@@@ localFilePath", localFilePath);
        try {
            // 检查文件是否存在
            let fileExists = false;
            try {
                await fs.access(localFilePath);
                fileExists = true;
            } catch {
                fileExists = false;
            }

            // 如果文件存在，检查元数据
            if (fileExists) {
                const metadataPath = `${localFilePath}.meta.json`;
                let metadataExists = false;

                try {
                    await fs.access(metadataPath);
                    metadataExists = true;
                } catch {
                    metadataExists = false;
                }

                // 如果元数据存在，比较hash决定是否更新
                if (metadataExists) {
                    const metadataContent = await fs.readFile(
                        metadataPath,
                        "utf8"
                    );
                    const metadata: LocalFileMetadata =
                        JSON.parse(metadataContent);

                    if (metadata.hash === file.hash) {
                        elizaLogger.info(
                            `文件 ${file.filename} 哈希一致，无需更新`
                        );
                        return;
                    }

                    elizaLogger.info(
                        `文件 ${file.filename} 哈希不一致，需要更新`,
                        {
                            oldHash: metadata.hash,
                            newHash: file.hash,
                        }
                    );
                }
            }

            // 从metadata中获取rootHash
            let rootHash: string;
            try {
                const metadataObj = JSON.parse(file.metadata);
                if (!metadataObj.rootHash) {
                    throw new Error("metadata中未找到rootHash");
                }
                rootHash = metadataObj.rootHash;
            } catch (error) {
                elizaLogger.error(`解析文件 ${file.filename} 的metadata失败`, {
                    metadata: file.metadata,
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                return;
            }

            // 创建临时下载目录
            const tempDir = path.join(os.tmpdir(), "zerog-downloads");
            await fs.mkdir(tempDir, { recursive: true });
            const tempPath = path.join(tempDir, `${file.filename}.temp`);

            elizaLogger.info(`正在从0g下载文件 ${file.filename}`, {
                rootHash,
                tempPath,
            });

            // 下载文件
            const downloadError = await this.indexer.download(
                rootHash,
                tempPath,
                true // 启用Merkle证明验证
            );

            if (downloadError !== null) {
                throw new Error(`下载文件失败: ${downloadError}`);
            }

            // 创建ZgFile对象并验证
            // tempFile = await ZgFile.fromFilePath(tempPath);
            // const [merkleTree, merkleError] = await tempFile.merkleTree();

            // if (merkleError !== null) {
            //     throw new Error(`生成Merkle树失败: ${merkleError}`);
            // }

            // // 验证rootHash
            // if (merkleTree.rootHash() !== rootHash) {
            //     throw new Error("文件rootHash验证失败");
            // }

            // 读取文件内容
            const fileContent = await fs.readFile(tempPath, "utf8");

            // 验证文件hash
            // const calculatedHash = ethers.keccak256(
            //     ethers.toUtf8Bytes(fileContent)
            // );
            // if (calculatedHash !== file.hash) {
            //     throw new Error(
            //         `文件hash验证失败: ${calculatedHash} !== ${file.hash}`
            //     );
            // }

            // 写入文件
            await fs.writeFile(localFilePath, fileContent);

            // 保存元数据
            const metadata: LocalFileMetadata = {
                hash: file.hash,
                size: file.size,
                owner: file.owner,
                timestamp: file.timestamp,
                category: file.category,
                metadata: file.metadata,
            };

            await fs.writeFile(
                `${localFilePath}.meta.json`,
                JSON.stringify(metadata, null, 2)
            );

            elizaLogger.info(`文件 ${file.filename} 已成功保存`, {
                path: localFilePath,
                size: fileContent.length,
                rootHash,
            });
        } catch (error) {
            elizaLogger.error(`处理文件 ${file.filename} 失败`, {
                error: error instanceof Error ? error.message : String(error),
                path: localFilePath,
            });
        } finally {
            // 清理临时文件
            if (tempFile) {
                try {
                    await tempFile.close();
                } catch (error) {
                    elizaLogger.warn(
                        `关闭临时文件失败: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        }
    }

    // 计算文件hash
    private calculateFileHash(content: string | Buffer): string {
        if (typeof content === "string") {
            return ethers.keccak256(ethers.toUtf8Bytes(content));
        } else {
            return ethers.keccak256(
                ethers.toUtf8Bytes(content.toString("utf8"))
            );
        }
    }
}
