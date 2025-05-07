import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import { translate } from './translate';

// 接口定义
interface TranslationConfig {
    apiKey: string;
    endpointId: string;
    sourceLanguage: string;
    targetLanguages: string[];
}

interface FileContext {
    filePath: string;
    fileName: string;
    dirPath: string;
    fileExt: string;
    isJsonFile: boolean;
    isTsFile: boolean;
    sourceLanguage: string;
}

// 内容处理器
class ContentProcessor {
    // 处理TypeScript内容
    static processTypeScriptContent(text: string): string {
        const tsContent = text.trim();

        // 检查是否是export default { ... } 格式
        if (!tsContent.startsWith('export default') && !tsContent.includes('=')) {
            throw new Error('请选择有效的TypeScript对象定义');
        }

        // 尝试提取键值对
        const keyValuePairs: Record<string, string> = {};
        const regex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
        let match;
        let hasMatches = false;

        while ((match = regex.exec(tsContent)) !== null) {
            hasMatches = true;
            const key = match[1];
            const value = match[2];
            keyValuePairs[key] = value;
        }

        if (!hasMatches) {
            throw new Error('未能在TypeScript文件中找到有效的键值对');
        }

        return JSON.stringify(keyValuePairs);
    }

    // 处理JSON内容
    static processJsonContent(text: string): string {
        // 策略1: 尝试作为完整JSON对象解析
        try {
            const parsedJson = JSON.parse(text);
            return JSON.stringify(parsedJson);
        } catch (fullJsonError) {
            // 策略2: 尝试解析为带有某个根键的对象，例如 "key": { ... }
            return ContentProcessor.processPartialJsonContent(text);
        }
    }

    // 处理部分JSON内容
    private static processPartialJsonContent(text: string): string {
        // 先尝试解析为根键对象
        const rootKeyMatch = text.trim().match(/^"([^"]+)"\s*:\s*(\{[\s\S]*\})$/);

        if (rootKeyMatch) {
            return ContentProcessor.processRootKeyObject(rootKeyMatch[1], rootKeyMatch[2]);
        }

        // 尝试包装内容
        return ContentProcessor.processWrappedContent(text);
    }

    // 处理根键对象
    private static processRootKeyObject(rootKey: string, valueContent: string): string {
        try {
            // 尝试解析值部分
            const parsedValue = JSON.parse(valueContent);
            // 构建完整的对象
            const result: Record<string, any> = {};
            result[rootKey] = parsedValue;
            return JSON.stringify(result);
        } catch (valueParseError: any) {
            throw new Error(`嵌套JSON值解析失败: ${valueParseError.message}`);
        }
    }

    // 处理包装内容
    private static processWrappedContent(text: string): string {
        const content = text.trim();

        // 如果内容看起来像是键值对列表而不是完整的JSON对象
        if ((content.startsWith('"') || content.includes('":')) &&
            !content.startsWith('{') && !content.endsWith('}')) {

            // 尝试包装
            try {
                const wrappedText = `{${content}}`;
                const parsedWrapped = JSON.parse(wrappedText);
                return JSON.stringify(parsedWrapped);
            } catch (wrappedError) {
                return ContentProcessor.extractSimpleKeyValuePairs(text);
            }
        }

        throw new Error('所选内容不是有效的JSON对象或键值对');
    }

    // 提取简单键值对
    private static extractSimpleKeyValuePairs(text: string): string {
        const keyValueRegex = /"([^"]+)":\s*"([^"]+)"/g;
        let match;
        const keyValuePairs: Record<string, string> = {};
        let hasMatches = false;

        while ((match = keyValueRegex.exec(text)) !== null) {
            hasMatches = true;
            const key = match[1];
            const value = match[2];
            keyValuePairs[key] = value;
        }

        if (hasMatches) {
            return JSON.stringify(keyValuePairs);
        }

        throw new Error('所选文本不是有效的JSON或键值对');
    }
}

// 文件路径生成器
class PathGenerator {
    // 为JSON文件生成目标路径
    static generateJsonTargetPath(fileContext: FileContext, targetLang: string): string {
        const { dirPath, fileName, sourceLanguage } = fileContext;

        // 优先检查目录路径中的语言代码
        if (dirPath.includes(`${sourceLanguage}-US`)) {
            // 如果在[源语言]-US目录下，替换目录名
            const targetDir = dirPath.replace(`${sourceLanguage}-US`, targetLang);
            return path.join(targetDir, fileName);
        }

        if (dirPath.includes(`/${sourceLanguage}/`)) {
            // 如果在/[源语言]/目录下，替换目录名
            const targetDir = dirPath.replace(`/${sourceLanguage}/`, `/${targetLang}/`);
            return path.join(targetDir, fileName);
        }

        // 其他情况，替换文件名中的语言代码
        const targetFileName = fileName.replace(`${sourceLanguage}.json`, `${targetLang}.json`);
        return path.join(dirPath, targetFileName);
    }

    // 为TS文件生成目标路径
    static generateTsTargetPath(fileContext: FileContext, targetLang: string): string {
        const { dirPath, fileName, fileExt, sourceLanguage } = fileContext;

        // 检查目录是否包含源语言目录
        const possibleSrcDirs = [`${sourceLanguage}-US`, sourceLanguage];

        for (const srcDir of possibleSrcDirs) {
            if (dirPath.includes(srcDir)) {
                // 替换目录名
                return path.join(
                    dirPath.replace(srcDir, targetLang),
                    fileName
                );
            }
        }

        // 如果不在语言目录下，在同一目录下创建带语言后缀的文件
        const fileNameWithoutExt = path.parse(fileName).name;
        return path.join(
            dirPath,
            `${fileNameWithoutExt}.${targetLang}${fileExt}`
        );
    }
}

// 文件内容处理器
class FileContentProcessor {
    // 读取目标文件内容
    static readTargetFile(targetFilePath: string, isTsFile: boolean): Record<string, any> {
        if (!fs.existsSync(targetFilePath)) {
            return {};
        }

        try {
            const fileContent = fs.readFileSync(targetFilePath, 'utf8');

            if (isTsFile) {
                return FileContentProcessor.parseTypeScriptContent(fileContent);
            } else {
                // JSON文件直接解析
                return JSON.parse(fileContent);
            }
        } catch (err: any) {
            throw new Error(`读取目标文件错误 ${path.basename(targetFilePath)}: ${err.message}`);
        }
    }

    // 解析TypeScript内容
    private static parseTypeScriptContent(fileContent: string): Record<string, any> {
        const regex = /export\s+default\s+(\{[\s\S]*\})/;
        const match = fileContent.match(regex);

        if (match && match[1]) {
            // 尝试将TS对象转换为JSON对象
            try {
                let objectStr = match[1]
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":');

                return JSON.parse(objectStr);
            } catch (e) {
                console.error('解析TS对象失败', e);
                return {};
            }
        }

        return {};
    }

    // 写入目标文件内容
    static writeTargetFile(targetFilePath: string, content: Record<string, any>, isTsFile: boolean): void {
        // 写入目标文件
        if (isTsFile) {
            FileContentProcessor.writeTypeScriptFile(targetFilePath, content);
        } else {
            // JSON格式
            fs.writeFileSync(targetFilePath, JSON.stringify(content, null, 2), 'utf8');
        }
    }

    // 写入TypeScript文件
    private static writeTypeScriptFile(targetFilePath: string, content: Record<string, any>): void {
        // 生成TS格式的内容
        let tsContent = 'export default {\n';
        for (const [key, value] of Object.entries(content)) {
            tsContent += `  '${key}': '${value}',\n`;
        }
        tsContent += '};\n';

        fs.writeFileSync(targetFilePath, tsContent, 'utf8');
    }
}

// 配置助手
class ConfigHelper {
    // 获取翻译配置
    static getTranslationConfig(): TranslationConfig {
        const config = vscode.workspace.getConfiguration('i18nTranslate');
        const apiKey = config.get<string>('apiKey') || '';
        const endpointId = config.get<string>('endpointId') || '';
        const sourceLanguage = config.get<string>('sourceLang') || 'en';
        const targetLanguages = config.get<string[]>('targetLanguages') || [];

        return { apiKey, endpointId, sourceLanguage, targetLanguages };
    }

    // 验证配置
    static validateConfig(config: TranslationConfig): void {
        if (!config.apiKey || !config.endpointId) {
            throw new Error('请先配置API Key和Endpoint ID');
        }

        if (!config.targetLanguages || config.targetLanguages.length === 0) {
            throw new Error('请配置目标语言');
        }
    }
}

// 翻译选中的文本
async function translateSelection() {
    try {
        // 1. 获取编辑器和文件信息
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('没有找到活动编辑器');
            return;
        }

        // 2. 加载配置信息
        const config = ConfigHelper.getTranslationConfig();
        ConfigHelper.validateConfig(config);

        // 3. 准备文件上下文
        const fileContext = prepareFileContext(editor, config.sourceLanguage);

        // 4. 检查文件是否符合要求
        if (!isValidSourceFile(fileContext)) {
            vscode.window.showErrorMessage(`请在${config.sourceLanguage}源语言文件上进行操作 (.json 或 .ts)`);
            return;
        }

        // 5. 获取并处理选中文本
        const text = editor.document.getText(editor.selection);
        const selectedJson = processSelectedText(text, fileContext.isTsFile);

        // 6. 执行翻译
        await performTranslation(selectedJson, fileContext, config);

    } catch (err: any) {
        vscode.window.showErrorMessage(`错误: ${err.message}`);
    }
}

// 准备文件上下文
function prepareFileContext(editor: vscode.TextEditor, sourceLanguage: string): FileContext {
    const currentFilePath = editor.document.uri.fsPath;
    const fileName = path.basename(currentFilePath);
    const dirPath = path.dirname(currentFilePath);
    const fileExt = path.extname(fileName).toLowerCase();

    return {
        filePath: currentFilePath,
        fileName,
        dirPath,
        fileExt,
        isJsonFile: fileExt === '.json',
        isTsFile: fileExt === '.ts',
        sourceLanguage
    };
}

// 检查是否是有效的源语言文件
function isValidSourceFile(fileContext: FileContext): boolean {
    const { fileName, dirPath, isJsonFile, isTsFile, sourceLanguage } = fileContext;

    // 判断是否是源语言文件
    const isSourceLanguageFile =
        // 文件名包含源语言代码
        fileName.includes(sourceLanguage) ||
        // 或在源语言目录下
        dirPath.includes(`${sourceLanguage}-US`) ||
        dirPath.includes(`/${sourceLanguage}/`);

    return isSourceLanguageFile && (isJsonFile || isTsFile);
}

// 处理选中的文本
function processSelectedText(text: string, isTypeScript: boolean): string {
    try {
        if (isTypeScript) {
            return ContentProcessor.processTypeScriptContent(text);
        } else {
            return ContentProcessor.processJsonContent(text);
        }
    } catch (err: any) {
        throw new Error(`处理选中文本失败: ${err.message}`);
    }
}

// 执行翻译
async function performTranslation(
    selectedJson: string,
    fileContext: FileContext,
    config: TranslationConfig
): Promise<void> {
    // 显示进度
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在翻译...",
        cancellable: true  // 允许取消操作
    }, async (progress, token) => {
        // 监听取消事件
        token.onCancellationRequested(() => {
            vscode.window.showInformationMessage('翻译已取消');
            throw new Error('用户取消了翻译');
        });

        // 保存已完成的语言，用于显示进度
        const totalLanguages = config.targetLanguages.length;
        let completedLanguages = 0;

        // 翻译到每种目标语言
        for (const targetLang of config.targetLanguages) {
            // 检查是否被取消
            if (token.isCancellationRequested) {
                break;
            }

            try {
                // 更新进度百分比
                const incrementPerLang = 100 / totalLanguages;
                progress.report({
                    message: `正在翻译到 ${targetLang}... (${++completedLanguages}/${totalLanguages})`,
                    increment: incrementPerLang
                });

                await translateToLanguage(selectedJson, targetLang, fileContext, config, progress, token);
            } catch (err: any) {
                if (err.message === '用户取消了翻译') {
                    // 用户取消了操作，直接中断
                    break;
                }
                vscode.window.showErrorMessage(`翻译到 ${targetLang} 失败: ${err.message}`);
                // 继续处理其他语言
                continue;
            }
        }

        if (!token.isCancellationRequested) {
            vscode.window.showInformationMessage('翻译完成!');
        }
    });
}

// 翻译到指定语言
async function translateToLanguage(
    selectedJson: string,
    targetLang: string,
    fileContext: FileContext,
    config: TranslationConfig,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<void> {
    // 检查是否取消
    if (token.isCancellationRequested) {
        throw new Error('用户取消了翻译');
    }

    // 1. 生成目标文件路径
    const targetFilePath = generateTargetPath(fileContext, targetLang);

    // 2. 确保目标目录存在
    ensureDirectoryExists(path.dirname(targetFilePath));

    // 3. 读取目标文件
    let targetContent: Record<string, any>;
    try {
        targetContent = FileContentProcessor.readTargetFile(targetFilePath, fileContext.isTsFile);
    } catch (err: any) {
        vscode.window.showErrorMessage(err.message);
        return;
    }

    // 检查是否被取消
    if (token.isCancellationRequested) {
        throw new Error('用户取消了翻译');
    }

    // 4. 执行翻译
    const [translatedContent, error] = await translate({
        API_KEY: config.apiKey,
        ENDPOINT_ID: config.endpointId,
        SystemContent: getSystemPrompt(),
        lang: targetLang,
        translateContent: selectedJson
    });

    // 检查是否被取消
    if (token.isCancellationRequested) {
        throw new Error('用户取消了翻译');
    }

    if (error) {
        throw new Error(`翻译错误 (${targetLang}): ${error}`);
    }

    // 5. 合并并写入结果
    if (translatedContent) {
        Object.assign(targetContent, translatedContent);

        FileContentProcessor.writeTargetFile(
            targetFilePath,
            targetContent,
            fileContext.isTsFile
        );
    }
}

// 生成目标文件路径
function generateTargetPath(fileContext: FileContext, targetLang: string): string {
    if (fileContext.isJsonFile) {
        return PathGenerator.generateJsonTargetPath(fileContext, targetLang);
    } else if (fileContext.isTsFile) {
        return PathGenerator.generateTsTargetPath(fileContext, targetLang);
    } else {
        throw new Error('不支持的文件类型');
    }
}

// 确保目录存在
function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// 设置配置
async function setupConfiguration() {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your API Key',
        placeHolder: 'API Key for translation service'
    });

    if (apiKey) {
        const config = vscode.workspace.getConfiguration('i18nTranslate');
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Workspace);
    }

    const endpointId = await vscode.window.showInputBox({
        prompt: 'Enter your Endpoint ID',
        placeHolder: 'Endpoint ID for the model'
    });

    if (endpointId) {
        const config = vscode.workspace.getConfiguration('i18nTranslate');
        await config.update('endpointId', endpointId, vscode.ConfigurationTarget.Workspace);
    }

    vscode.window.showInformationMessage('Configuration updated!');
}

// 获取系统提示词
function getSystemPrompt() {
    return `
  #角色
  假如你是多语言翻译专家，你将根据客户的翻译需求，根据以下规则一步步执行任务。    
  #背景补充    
  EcomSend Feed 是一个同步连接器项目。主要功能是同步shopify和TikTok这两个电商平台的产品和订单。
  
  #任务描述与要求    
  1. 仔细分析客户提供的 EcomSend Feed 的 Json 源文本（英语）和语言简码（json原文本和语言简码用空格隔开）。   
  2. 将源文本中所有 value 字段准确无误地翻译为语言简码对应的语言文本
     1. 语言简码的关系如下 en->English,zh-CN->Chinese (Simplified),zh-TW->Chinese (Traditional),fr->French,de->German,it->Italian,es->Spanish,pt-PT->Portuguese (Portugal)
  3. 确保翻译的准确性和流畅性，符合翻译语言的表达习惯。    
  4. 对于一些专业术语或特定语境下的词汇，要进行恰当的翻译，不能出现歧义。   
  5. 只输出纯JSON格式，不要有任何多余的解释或文字。
  6. 输出的JSON格式必须是有效的可解析的JSON，不能包含任何非JSON内容。
  7. json 格式支持嵌套处理
  #输出格式要求
  必须只返回一个合法的JSON对象，不包含其他任何内容。例如：
  {"key1":"翻译后的值1","key2":"翻译后的值2"}
  
  #参考示例    
  示例 1：    
  输入：{"login":"Login"} zh-CN
  输出：{"login":"登录"}
  示例 2：    
  输入：{"placeholder_parameter_value": {
    "message": "hello world",
    "description": ""
  }} zh-CN
  输出：{"placeholder_parameter_value":{"message":"你好世界","description":""}}
     
  示例 3：    
  输入：{"login":"Login","register":"Register"} fr
  输出：{"login":"Connexion","register":"S'inscrire"}
  `;
}

export {
    translateSelection,
    setupConfiguration
};