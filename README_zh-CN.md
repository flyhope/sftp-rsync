# Sftp-Rsync

使用 rsync 将本地文件同步到 SFTP(SSH) 服务器。

## 特色

* 使用 rsync，速度快！非常快！相当的快！
* 复用 sftp.json 项目配置文件，易于使用！
* 支持 code-server、Linux、Mac、Windows (Cygwin)！

## 安装

* 确保你的已安装`rsync` `ssh`命令，确保你的目标服务器支持ssh使用密钥对连接。
* 应用商店中搜索安装 `sftp-rsync-fast`

## 配置

在用户的`settings.json`中配置SFTP服务器，配置参考： [vscode-remote-fs](https://github.com/liximomo/vscode-remote-fs)


User Settings:

```json
"remotefs.remote": {
  "dev": {
    "scheme": "sftp",
    "host": "host",
    "username": "username",
    "rootPath": "/path/to/somewhere"
  },
  "projectX": {
    "scheme": "sftp",
    "host": "host",
    "username": "username",
    "privateKeyPath": "/Users/xx/.ssh/id_rsa",
    "rootPath": "/home/foo/some/projectx"
  }
}
```

项目目录下的 `.vscode/sftp.json` :

```json
{
  "remote": "dev",
  "remotePath": "/home/xx/",
  "ignore": [".vscode", ".git", ".DS_Store"]
}
```

## 使用

需要上传整个项目时，使用：
* 按`Ctrl+Shift+P`，输入`rsync upload project`


## 最佳实践

sftp传输单文件快，rsync传输大量文件快，配置 `Natizyskunk.sftp` 扩展一起使用体验更佳

### Natizyskunk.sftp

* 保存时上传
* 上传部分文件、目录

### flyhope.sftp-rsync-fast

* 上传整个项目

## 感谢

* Natizyskunk.sftp https://github.com/Natizyskunk/vscode-sftp
* vscode-remote-fs https://github.com/liximomo/vscode-remote-fs
* 通义灵码 https://lingma.aliyun.com/
