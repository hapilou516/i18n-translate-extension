import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 翻译目录节点
 */
class TranslationDirectory extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly directoryPath: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = this.directoryPath;
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'translationDirectory';
    }
}

/**
 * 翻译文件树节点
 */
class TranslationFile extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly filePath: string,
        public readonly language: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.language}: ${this.label}`;
        this.description = this.language;
        this.command = {
            command: 'i18n-translate.openTranslationFile',
            title: 'Open Translation File',
            arguments: [this.filePath]
        };

        // 根据语言设置不同图标
        switch (language) {
            case 'en':
                this.iconPath = new vscode.ThemeIcon('symbol-text');
                break;
            case 'zh-CN':
                this.iconPath = new vscode.ThemeIcon('symbol-string');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('globe');
                break;
        }
    }

    contextValue = 'translationFile';
}

// 树节点类型
type TranslationNode = TranslationDirectory | TranslationFile;

/**
 * 翻译文件浏览器数据提供者
 */
export class TranslationExplorerProvider implements vscode.TreeDataProvider<TranslationNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TranslationNode | undefined | null | void> = new vscode.EventEmitter<TranslationNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TranslationNode | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TranslationNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TranslationNode): Thenable<TranslationNode[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('没有发现翻译文件');
            return Promise.resolve([]);
        }

        if (!element) {
            return this.getDirectories();
        } else if (element instanceof TranslationDirectory) {
            return this.getTranslationFilesInDirectory(element.directoryPath);
        } else {
            return Promise.resolve([]);
        }
    }

    /**
     * 获取包含翻译文件的目录
     */
    private async getDirectories(): Promise<TranslationNode[]> {
        // 只扫描locales目录下的文件
        const files = await vscode.workspace.findFiles('**/locales/**/*.json', '**/node_modules/**');

        const directories = new Map<string, string[]>();

        // 查找包含语言文件的目录
        for (const file of files) {
            const fileName = path.basename(file.fsPath);
            const match = fileName.match(/^([a-z]{2}(-[A-Z]{2})?)\.json$/);

            if (match) {
                const dirPath = path.dirname(file.fsPath);
                const relativePath = path.relative(this.workspaceRoot!, dirPath);

                // 使用相对路径作为键
                if (!directories.has(relativePath)) {
                    directories.set(relativePath, []);
                }

                directories.get(relativePath)!.push(file.fsPath);
            }
        }

        // 转换为目录节点
        const result: TranslationNode[] = [];
        for (const [dirRelativePath, files] of directories.entries()) {
            if (files.length > 0) {
                const dirPath = path.join(this.workspaceRoot!, dirRelativePath);
                const dirName = path.basename(dirPath);
                result.push(
                    new TranslationDirectory(
                        dirName || '根目录',
                        dirPath,
                        vscode.TreeItemCollapsibleState.Expanded
                    )
                );
            }
        }

        return result;
    }

    /**
     * 获取目录下的翻译文件
     */
    private async getTranslationFilesInDirectory(directoryPath: string): Promise<TranslationFile[]> {
        const filePattern = path.join(directoryPath, '*.json');
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(directoryPath, '*.json'), null);

        const result: TranslationFile[] = [];

        for (const file of files) {
            const fileName = path.basename(file.fsPath);
            const match = fileName.match(/^([a-z]{2}(-[A-Z]{2})?)\.json$/);

            if (match) {
                const lang = match[1];
                result.push(
                    new TranslationFile(
                        fileName,
                        vscode.TreeItemCollapsibleState.None,
                        file.fsPath,
                        lang
                    )
                );
            }
        }

        return result;
    }
}

/**
 * 注册翻译文件浏览器
 */
export function registerTranslationExplorer(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    const translationExplorerProvider = new TranslationExplorerProvider(workspaceRoot);

    // 注册树视图
    const view = vscode.window.createTreeView('translationExplorer', {
        treeDataProvider: translationExplorerProvider,
        showCollapseAll: true
    });

    // 注册刷新命令
    const refreshCommand = vscode.commands.registerCommand('i18n-translate.refreshTranslationExplorer', () => {
        translationExplorerProvider.refresh();
    });

    // 注册打开文件命令
    const openFileCommand = vscode.commands.registerCommand('i18n-translate.openTranslationFile', (filePath: string) => {
        if (fs.existsSync(filePath)) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
        } else {
            vscode.window.showErrorMessage(`文件未找到: ${filePath}`);
        }
    });

    // 添加到订阅列表
    context.subscriptions.push(view);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(openFileCommand);

    // 监听文件系统变化，自动刷新视图
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/locales/**/*.json');
    fileWatcher.onDidCreate(() => translationExplorerProvider.refresh());
    fileWatcher.onDidChange(() => translationExplorerProvider.refresh());
    fileWatcher.onDidDelete(() => translationExplorerProvider.refresh());

    context.subscriptions.push(fileWatcher);
} 