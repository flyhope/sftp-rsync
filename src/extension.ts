import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

// 获取Sftp的配置
async function getSftpConfig(): Promise<config | null> { // 修改: 将函数改为 async
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace is open.");
        return Promise.resolve(null);
    }

    const sftpConfigPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'sftp.json');

    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(sftpConfigPath)); // 修改: 使用 await
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(sftpConfigPath)); // 修改: 使用 await
        const configContent = data.toString(); // 修改: 删除: data.toString('utf-8');
        return JSON.parse(configContent);
    } catch (error) { // 修改: 使用 try/catch
        vscode.window.showErrorMessage("sftp.json not found in .vscode folder.");
        return null;
    }
}

// 定义sftp config类型 
type config = {
  host: string|undefined;
  port: number|undefined;
  username: string|undefined;
  remotePath: string|undefined;
  privateKeyPath: string|undefined;
}

// 使用rsync执行命令
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
  const command = `rsync -av --delete -e "${sshCommand}" ${localPath} ${c.username}@${c.host}:${c.remotePath}`;
  console.log(command);
  
  // 执行命令
  exec(command, (error, stdout, stderr) => {
    if (error) {
      vscode.window.showErrorMessage(`Error during sync: ${stderr}`);
    } else {
      vscode.window.showInformationMessage(`Sync complete: ${stdout}`);
    }
  });
}

// 插件插活操作
export async function activate(context: vscode.ExtensionContext) { // 修改: async
    let disposable = vscode.commands.registerCommand('extension.syncProject', async (): Promise<void> => { // 修改: async
        const config = await getSftpConfig(); // 修改: await
        const localPath = vscode.workspace.rootPath || "";
        if (config) { // 修改: 添加检查
            syncProjectWithRsync(localPath, config);
        } else {
            vscode.window.showErrorMessage("Failed to load SFTP configuration.");
        }
    });

    context.subscriptions.push(disposable);
}

// 插件反激活
export function deactivate() {}

