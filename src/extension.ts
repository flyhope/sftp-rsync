import * as vscode from 'vscode';

// 定义remote配置类型
type RemoteConfig = {
  scheme: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  rootPath: string;
};

// 新增辅助函数：获取settings.json中的remotefs.remote配置
async function getRemoteConfigs(): Promise<Record<string, RemoteConfig> | null> {
    const settings = vscode.workspace.getConfiguration();
    const remoteConfigs = settings.get<Record<string, RemoteConfig>>('remotefs.remote');
    if (!remoteConfigs) {
        vscode.window.showErrorMessage("No remote configurations found in settings.json");
        return null;
    }
    return remoteConfigs as Record<string, RemoteConfig>;
}

// 新增辅助函数：获取当前文件夹路径
async function getCurrentFolderPath(): Promise<vscode.Uri | null> {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (workspaceFolder) {
            return workspaceFolder.uri;
        }
    }

    vscode.window.showErrorMessage("Please open a folder first.");
    return null;
}

async function getSftpConfig(): Promise<config | config[] | null> {
    const currentFolderPath = await getCurrentFolderPath();
    if (!currentFolderPath) {
        vscode.window.showErrorMessage("No folder is open.");
        return null;
    }

    // 修改: 使用 vscode.Uri.joinPath 拼接路径
    const sftpConfigUri = vscode.Uri.joinPath(currentFolderPath, '.vscode', 'sftp.json');
    
    const remoteConfigs = await getRemoteConfigs();
    if (!remoteConfigs) {
        return null;
    }

    try {
        const doc = await vscode.workspace.openTextDocument(sftpConfigUri);
        const configContent = doc.getText();
        const sftpConfig = JSON.parse(configContent);

        // 合并配置
        const configs = [];
        for (const [name, remoteConfig] of Object.entries(remoteConfigs)) {
            if (remoteConfig.scheme === 'sftp') {
                const mergedConfig = {
                    name,
                    host: remoteConfig.host,
                    port: remoteConfig.port,
                    username: remoteConfig.username,
                    privateKeyPath: remoteConfig.privateKeyPath,
                    remotePath: sftpConfig.remotePath,
                    ignore: sftpConfig.ignore || [] // 新增 ignore 字段
                };
                configs.push(mergedConfig);
            }
        }

        if (configs.length === 0) {
            vscode.window.showErrorMessage("No valid SFTP configurations found in settings.json");
            return null;
        }

        return configs.length === 1 ? configs[0] : configs;
    } catch (error) {
        // 断言 error 为 Error 类型
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to read sftp.json in the selected folder's .vscode folder: ${error.message}\nStack Trace:\n${error.stack}`);
        } else {
            vscode.window.showErrorMessage(`Failed to read sftp.json in the selected folder's .vscode folder: An unknown error occurred.`);
        }
        return null;
    }
}

// 提前定义sftp config类型
type config = {
  name: string | undefined; // 添加 name 属性
  host: string | undefined;
  port: number | undefined;
  username: string | undefined;
  remotePath: string | undefined;
  privateKeyPath: string | undefined;
  ignore: string[]; // 新增 ignore 字段
}

// 新增一个模块级别的终端实例
let terminal: vscode.Terminal | null = null;

// 新增全局常量定义终端名称
const TERMINAL_NAME = 'SFTP-RSync';

function syncProjectWithRsync(localPath: string, c: config) {
    // 拼接SSH命令
    let sshCommand = `ssh -o StrictHostKeyChecking=no`;
    if (c.privateKeyPath) {
        sshCommand += ` -i ${c.privateKeyPath}`;
    }
    if (c.port) {
        sshCommand += ` -p ${c.port}`;
    }

    // 兼容windows环境，替换为cywin格式路径；同时兼容cloudide环境的\
    localPath = localPath.replace(/\\/g, '/');
    localPath = localPath.replace(/^([a-zA-Z]):\//, '/cygdrive/$1/');

    // 拼接rsync命令，添加忽略选项
    let command = `rsync -av -e "${sshCommand}" '${localPath}/' ${c.username}@${c.host}:${c.remotePath}`;
    if (c.ignore && c.ignore.length > 0) {
        const ignoreOptions = c.ignore.map((ignoreItem: string) => `--exclude '${ignoreItem}'`).join(' ');
        command += ` ${ignoreOptions}`;
    }

    // 如果终端不存在或已关闭，则查找同名终端或创建一个新的终端
    if (!terminal || terminal.exitStatus) {
        // 查找同名终端
        const existingTerminal = vscode.window.terminals.find(t => t.name === TERMINAL_NAME);
        if (existingTerminal) {
            terminal = existingTerminal;
        } else {
            terminal = vscode.window.createTerminal(TERMINAL_NAME);
        }
    }

    // 发送命令到终端并显示终端
    terminal.sendText(command);
    terminal.show();
}

// 修改 activate 函数中的同步逻辑
export async function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.syncProject', async (): Promise<void> => {
        const configs = await getSftpConfig();
        const currentFolderPath = await getCurrentFolderPath();

        if (!currentFolderPath || !configs || (Array.isArray(configs) && configs.length === 0)) {
            vscode.window.showErrorMessage("Failed to load SFTP configuration.");
            return;
        }

        // 如果是数组格式，提供选项让用户选择
        let selectedConfig: config | undefined;
        if (Array.isArray(configs) && configs.length > 1) {
            const names = (configs as config[]).map((c: config) => c.name || "Unnamed");
            const selectedName = await vscode.window.showQuickPick(names, { placeHolder: "Select a configuration to use" });
            if (!selectedName) {
                vscode.window.showErrorMessage("No configuration selected.");
                return;
            }
            selectedConfig = (configs as config[]).find((c: config) => c.name === selectedName);
        } else {
            selectedConfig = Array.isArray(configs) ? configs[0] : configs;
        }

        if (selectedConfig) {
            syncProjectWithRsync(currentFolderPath.fsPath, selectedConfig);
        } else {
            vscode.window.showErrorMessage("Failed to load SFTP configuration.");
        }
    });

    context.subscriptions.push(disposable);
}

// 插件反激活
export function deactivate() {}
