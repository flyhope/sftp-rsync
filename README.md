# Sftp-Rsync

use rsync to sync files from local to sftp server.

## feature

* use rsync, fast! fast! fast !
* use sftp.json project config file, easy to use!
* support windows cygwin ssh & rsync!

## Installation

* Ensure that you have installed the `rsync` and `ssh` commands, and make sure your target server supports SSH key-based authentication.
* Search and install `sftp-rsync-fast` in the application store.

## configure

You can use remote to tell sftp to get the configuration from  [vscode-remote-fs](https://github.com/liximomo/vscode-remote-fs).

In User Setting:

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

In project `.vscode/sftp.json`:

```json
{
  "remote": "dev",
  "remotePath": "/home/xx/",
  "uploadOnSave": false,
  "ignore": [".vscode", ".git", ".DS_Store"]
}
```

## Usage

To upload the entire project, use:
* Press `Ctrl+Shift+P`, then type `rsync upload project`

## Best Practices

SFTP is fast for transferring single files, while rsync is fast for transferring large amounts of files. For an enhanced experience, configure the `Natizyskunk.sftp` extension to work together.

### Natizyskunk.sftp

* Upload on save
* Upload specific files or directories

### flyhope.sftp-rsync-fast

* Upload the entire project

## Acknowledgments

* Natizyskunk.sftp https://github.com/Natizyskunk/vscode-sftp
* vscode-remote-fs https://github.com/liximomo/vscode-remote-fs
* TONGYI Lingma https://lingma.aliyun.com/
