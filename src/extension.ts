import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// 获取Sftp的配置
function getSftpConfig() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace is open.");
        return null;
    }

    const sftpConfigPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'sftp.json');

    if (!fs.existsSync(sftpConfigPath)) {
        vscode.window.showErrorMessage("sftp.json not found in .vscode folder.");
        return null;
    }

    try {
        const configContent = fs.readFileSync(sftpConfigPath, 'utf-8');
        return JSON.parse(configContent);
    } catch (error) {
        vscode.window.showErrorMessage("Failed to read sftp.json: " + String(error));
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
export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('extension.syncProject',  (): void => {
    const config = getSftpConfig();
    const localPath = vscode.workspace.rootPath || "";
    syncProjectWithRsync(localPath, config);
  });

  context.subscriptions.push(disposable);
}

// 插件反激活
export function deactivate() {}