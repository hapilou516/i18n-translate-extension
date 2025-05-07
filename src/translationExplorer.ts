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
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isLanguageDirectory: boolean = false
    ) {
        super(label, collapsibleState);
        this.tooltip = this.directoryPath;

        if (isLanguageDirectory) {
            // 语言目录使用特殊图标
            this.iconPath = new vscode.ThemeIcon('globe');
            this.description = '语言目录';
        } else {
            this.iconPath = new vscode.ThemeIcon('folder');
        }

        this.contextValue = isLanguageDirectory ? 'languageDirectory' : 'translationDirectory';
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
            case 'en-US':
                this.iconPath = new vscode.ThemeIcon('symbol-text');
                break;
            case 'zh-CN':
                this.iconPath = new vscode.ThemeIcon('symbol-string');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('file-code');
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
            return this.getLocalesDirectories();
        } else if (element instanceof TranslationDirectory) {
            if (this.isLanguageDirectory(element.label)) {
                return this.getLanguageTranslationFiles(element.directoryPath, element.label);
            } else {
                return this.getLanguageDirectories(element.directoryPath);
            }
        } else {
            return Promise.resolve([]);
        }
    }

    /**
     * 判断是否是语言目录
     */
    private isLanguageDirectory(dirName: string): boolean {
        // 根据图片，语言目录包括：en-US, ja, zh-CN, zh-TW 等
        // 扩展正则表达式以匹配更多语言格式
        return /^[a-z]{2}(-[A-Z]{2})?$/.test(dirName) || dirName === 'ja' || dirName === 'en' || dirName === 'zh';
    }

    /**
     * 获取所有locales目录
     */
    private async getLocalesDirectories(): Promise<TranslationNode[]> {
        // 添加更多的搜索模式来匹配目录结构
        const patterns = [
            '**/locales', // 原始模式
            '**/src/locales', // 添加src/locales模式
            '**/src/*/locales', // 添加src下子目录中的locales
            '**/src' // 直接查找src目录
        ];

        let localesDirs: vscode.Uri[] = [];

        // 尝试所有模式
        for (const pattern of patterns) {
            const results = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
            console.log(`使用模式 ${pattern} 找到目录数量:`, results.length);

            if (results.length > 0) {
                localesDirs = results;
                break;
            }
        }

        console.log('查找到的可能的locales目录数量:', localesDirs.length);

        // 如果没有找到locales目录，但找到了src目录
        if (localesDirs.length > 0 && localesDirs[0].fsPath.endsWith('src')) {
            console.log('找到src目录，尝试直接查找src下的语言目录');
            // 返回从src直接获取语言目录
            return this.getLanguageDirectories(localesDirs[0].fsPath);
        }

        if (localesDirs.length === 0) {
            console.log('尝试查找整个项目中的语言目录');
            // 根据图片显示，直接查找src目录
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const srcPath = path.join(workspaceFolders[0].uri.fsPath, 'src');
                if (fs.existsSync(srcPath)) {
                    console.log('直接使用src目录:', srcPath);
                    return [
                        new TranslationDirectory(
                            'src',
                            srcPath,
                            vscode.TreeItemCollapsibleState.Expanded
                        )
                    ];
                }
            }

            // 如果仍然找不到，显示提示
            return [
                new TranslationDirectory(
                    '未找到翻译文件目录',
                    '',
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }

        const result: TranslationNode[] = [];

        for (const localesDir of localesDirs) {
            const dirName = path.basename(localesDir.fsPath);
            console.log('找到目录:', localesDir.fsPath);
            result.push(
                new TranslationDirectory(
                    dirName,
                    localesDir.fsPath,
                    vscode.TreeItemCollapsibleState.Expanded
                )
            );
        }

        return result;
    }

    /**
     * 获取语言目录
     */
    private async getLanguageDirectories(localesPath: string): Promise<TranslationNode[]> {
        try {
            console.log('扫描目录内容:', localesPath);
            const result: TranslationNode[] = [];

            // 检查目录是否存在
            if (!fs.existsSync(localesPath)) {
                console.error('目录不存在:', localesPath);
                return [];
            }

            const entries = fs.readdirSync(localesPath, { withFileTypes: true });
            console.log('目录内容数量:', entries.length);
            console.log('目录内容:', entries.map(e => e.name));

            // 先处理语言目录
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // 尝试确定这是否是语言目录
                    const isLangDir = this.isLanguageDirectory(entry.name);
                    console.log(`检查目录 ${entry.name} 是否为语言目录:`, isLangDir);

                    if (isLangDir) {
                        const dirPath = path.join(localesPath, entry.name);
                        result.push(
                            new TranslationDirectory(
                                entry.name,
                                dirPath,
                                vscode.TreeItemCollapsibleState.Expanded,
                                true // 这是语言目录
                            )
                        );
                    }
                }
            }

            // 如果没有找到任何语言目录，显示一个占位节点
            if (result.length === 0) {
                console.log('未找到任何语言目录');
                return [
                    new TranslationDirectory(
                        '未找到语言目录',
                        '',
                        vscode.TreeItemCollapsibleState.None
                    )
                ];
            }

            return result;
        } catch (error) {
            console.error('获取语言目录时出错', error);
            return [];
        }
    }

    /**
     * 获取语言目录下的所有翻译文件
     */
    private async getLanguageTranslationFiles(languageDirPath: string, language: string): Promise<TranslationFile[]> {
        try {
            const result: TranslationFile[] = [];
            const entries = fs.readdirSync(languageDirPath, { withFileTypes: true });

            for (const entry of entries) {
                // 对于文件
                if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.json'))) {
                    // 移除扩展名，获取模块名
                    const moduleName = path.parse(entry.name).name;
                    const filePath = path.join(languageDirPath, entry.name);

                    result.push(
                        new TranslationFile(
                            entry.name,
                            vscode.TreeItemCollapsibleState.None,
                            filePath,
                            language
                        )
                    );
                }
                // 对于子目录，递归处理
                else if (entry.isDirectory()) {
                    const subDirPath = path.join(languageDirPath, entry.name);
                    const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });

                    for (const subEntry of subEntries) {
                        if (subEntry.isFile() && (subEntry.name.endsWith('.ts') || subEntry.name.endsWith('.json'))) {
                            const filePath = path.join(subDirPath, subEntry.name);
                            result.push(
                                new TranslationFile(
                                    `${entry.name}/${subEntry.name}`, // 显示相对路径
                                    vscode.TreeItemCollapsibleState.None,
                                    filePath,
                                    language
                                )
                            );
                        }
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('Error getting translation files', error);
            return [];
        }
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

    // 添加调试信息，检查视图容器是否正确注册
    checkViewRegistration();

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
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/locales/**/*.{json,ts}');
    fileWatcher.onDidCreate(() => translationExplorerProvider.refresh());
    fileWatcher.onDidChange(() => translationExplorerProvider.refresh());
    fileWatcher.onDidDelete(() => translationExplorerProvider.refresh());

    context.subscriptions.push(fileWatcher);
}

// 检查视图是否正确注册
function checkViewRegistration(): void {
    const extensionId = 'i18n-translate-extension';
    const packageJson = vscode.extensions.getExtension(extensionId)?.packageJSON;

    if (!packageJson) {
        console.error('无法找到扩展的package.json');
        vscode.window.showErrorMessage('无法初始化翻译浏览器，请检查扩展安装情况');
        return;
    }

    console.log('扩展package.json中的视图配置:', JSON.stringify({
        views: packageJson.contributes?.views,
        viewsContainers: packageJson.contributes?.viewsContainers
    }, null, 2));

    // 显示当前视图状态的通知
    vscode.window.showInformationMessage('翻译浏览器状态: 正在初始化...');

    // 查找视图容器和视图是否存在
    const hasViewContainer = packageJson.contributes?.viewsContainers?.activitybar?.some(
        (container: any) => container.id === 'i18nTranslate'
    );

    const hasView = packageJson.contributes?.views?.i18nTranslate?.some(
        (view: any) => view.id === 'translationExplorer'
    );

    console.log('视图容器存在:', hasViewContainer);
    console.log('视图存在:', hasView);

    if (!hasViewContainer) {
        vscode.window.showErrorMessage('翻译管理器视图容器未正确配置');
    }

    if (!hasView) {
        vscode.window.showErrorMessage('翻译列表视图未正确配置');
    }
} 