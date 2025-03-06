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
async function getCurrentFolderPath(): Promise<string | null> {
    // 优先使用当前工作区的根目录
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // 如果当前没有工作区，尝试获取活动文件的路径
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
    }

    // 如果以上方法都失败，提示用户打开一个文件夹
    vscode.window.showErrorMessage("Please open a folder first.");
    return null;
}

async function getSftpConfig(): Promise<config | config[] | null> {
    const currentFolderPath = await getCurrentFolderPath();
    if (!currentFolderPath) {
        vscode.window.showErrorMessage("No folder is open.");
        return null;
    }

    const sftpConfigUri = vscode.Uri.file(`${currentFolderPath}/.vscode/sftp.json`);
    
    const remoteConfigs = await getRemoteConfigs();
    if (!remoteConfigs) {
        return null;
    }

    try {
        await vscode.workspace.fs.stat(sftpConfigUri);
        const data = await vscode.workspace.fs.readFile(sftpConfigUri);
        const configContent = data.toString();
        const sftpConfig = JSON.parse(configContent);

        // 合并配置
        const configs = [];
        for (const [name, remoteConfig] of Object.entries(remoteConfigs)) {
            if (remoteConfig.scheme === 'sftp') {
                // 处理privateKeyPath中的~字符
                let privateKeyPath = remoteConfig.privateKeyPath;
                if (privateKeyPath && privateKeyPath.startsWith('~')) {
                    privateKeyPath = privateKeyPath.replace('~', process.env.HOME || process.env.USERPROFILE || '~');
                }

                const mergedConfig = {
                    name,
                    host: remoteConfig.host,
                    port: remoteConfig.port,
                    username: remoteConfig.username,
                    privateKeyPath,
                    remotePath: sftpConfig.remotePath
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
        vscode.window.showErrorMessage("sftp.json not found in the selected folder's .vscode folder.");
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
}

// 使用vscode任务系统执行rsync命令
function syncProjectWithRsync(localPath: string, c: config) {
    // 拼接SSH命令
    let sshCommand = `ssh -o StrictHostKeyChecking=no`;
    if (c.privateKeyPath) {
        sshCommand += ` -i ${c.privateKeyPath}`;
    }
    if (c.port) {
        sshCommand += ` -p ${c.port}`;
    }

    // 如果是windows，拼接rsync命令时localPath转为cygwin格式的路径
    if (process.platform === 'win32') {
        localPath = localPath.replace(/\\/g, '/');
        localPath = localPath.replace(/ /g, '\\ ');
        localPath = localPath.replace(/^([a-zA-Z]):\//, '/cygdrive/$1/');
    }

    // 拼接rsync命令
    const command = `rsync -av -e "${sshCommand}" ${localPath}/ ${c.username}@${c.host}:${c.remotePath}`;
    console.log(command);

    // 拆分命令为shell和shellArgs
    const shell = 'rsync';
    const shellArgs = ['-av', '-e', sshCommand, `${localPath}/`, `${c.username}@${c.host}:${c.remotePath}`];

    // 创建vscode任务
    const task = new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Workspace,
        'syncProject',
        'extension',
        new vscode.ShellExecution(shell, shellArgs)
    );

    // 执行任务
    vscode.tasks.executeTask(task);
}

// async function readWorkspaceFile(filePath: string) {
//     const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
//     if (!workspaceFolder) {
//         vscode.window.showErrorMessage("No workspace folder is open.");
//         return;
//     }

//     // 获取正确的文件 URI（Web 端不能用 file://）
//     const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

//     try {
//         // 检测 VSCode 运行环境（本地 VS 远程/Web）
//         if (workspaceFolder.uri.scheme === "file") {
//             // 本地 VSCode（file://），直接读取
//             const fileData = await vscode.workspace.fs.readFile(fileUri);
//             const content = new TextDecoder().decode(fileData);
//             vscode.window.showInformationMessage("File Content:"+ content);
//             return content;
//         } else {
//             // Web 端（如 cloudide://），用 openTextDocument()
//             const doc = await vscode.workspace.openTextDocument(fileUri);
//             vscode.window.showInformationMessage("Web Content:"+ doc.getText());
//             return doc.getText();
//         }
//     } catch (error) {
//         vscode.window.showErrorMessage(`Failed to read file: ${error}`);
//     }
// }

// 修改 activate 函数中的同步逻辑
export async function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.syncProject', async (): Promise<void> => {

        // readWorkspaceFile('README.md'); // 读取工作区根目录下的 test.txt 文件


        
        const configs = await getSftpConfig();
        const currentFolderPath = await getCurrentFolderPath();
        console.log("current path", currentFolderPath);

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
            syncProjectWithRsync(currentFolderPath, selectedConfig);
        } else {
            vscode.window.showErrorMessage("Failed to load SFTP configuration.");
        }
    });

    context.subscriptions.push(disposable);
}

// 插件反激活
export function deactivate() {}
