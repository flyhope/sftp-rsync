import * as vscode from 'vscode';

// 获取Sftp的配置
async function getSftpConfig(): Promise<config | config[] | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace is open.");
        return Promise.resolve(null);
    }

    const sftpConfigPath = `${workspaceFolders[0].uri.fsPath}/.vscode/sftp.json`;

    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(sftpConfigPath));
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(sftpConfigPath));
        const configContent = data.toString();
        const config = JSON.parse(configContent);

        // 检查是否为数组或单个对象
        if (Array.isArray(config)) {
            return config; // 返回数组格式
        } else {
            return [config]; // 转换为数组格式统一处理
        }
    } catch (error) {
        vscode.window.showErrorMessage("sftp.json not found in .vscode folder.");
        return null;
    }
}

// 定义sftp config类型 
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

// 插件插活操作
export async function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.syncProject', async (): Promise<void> => {
        const configs = await getSftpConfig();
        const localPath = vscode.workspace.rootPath || "";

        if (!configs || (Array.isArray(configs) && configs.length === 0)) {
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
            syncProjectWithRsync(localPath, selectedConfig);
        } else {
            vscode.window.showErrorMessage("Failed to load SFTP configuration.");
        }
    });

    context.subscriptions.push(disposable);
}

// 插件反激活
export function deactivate() {}





