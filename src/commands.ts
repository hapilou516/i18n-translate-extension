import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import { translate } from './translate';

// 翻译选中的文本
async function translateSelection() {
    const editor = vscode.window.activeTextEditor;
    console.log('editor', editor);
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    // 获取当前文件路径和名称
    const currentFilePath = editor.document.uri.fsPath;
    const fileName = path.basename(currentFilePath);
    const dirPath = path.dirname(currentFilePath);

    // 检查是否是源语言文件(默认为en.json)
    if (!fileName.includes('en.json')) {
        vscode.window.showErrorMessage('Please select text in the source language file (en.json)');
        return;
    }

    // 获取选中的文本
    const selection = editor.selection;
    const text = editor.document.getText(selection);
    // 尝试处理选中的文本
    try {
        let selectedJson = "";

        // 尝试将选中文本解析为JSON
        try {
            // 尝试直接解析为JSON对象
            const parsedJson = JSON.parse(text);
            selectedJson = JSON.stringify(parsedJson);
        } catch (jsonError) {
            // 如果不是有效的JSON，尝试将其转换为JSON
            // 检查是否是key-value对格式的文本（比如 "key": "value"）
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
                selectedJson = JSON.stringify(keyValuePairs);
            } else {
                // 如果找不到key-value对，则将整个文本作为一个值
                vscode.window.showErrorMessage('Selected text is not a valid JSON or key-value pairs');
                return;
            }
        }

        // 获取配置
        const config = vscode.workspace.getConfiguration('i18nTranslate');
        const apiKey = config.get('apiKey');
        const endpointId = config.get('endpointId');
        const targetLanguages = config.get('targetLanguages');

        if (!apiKey || !endpointId) {
            vscode.window.showErrorMessage('Please configure API Key and Endpoint ID first');
            return;
        }

        // 显示进度
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Translating...",
            cancellable: false
        }, async (progress) => {

            // 翻译到每种目标语言
            for (const lang of targetLanguages as string[]) {
                progress.report({ message: `Translating to ${lang}...` });

                // 构建目标文件路径
                const targetFileName = fileName.replace('en.json', `${lang}.json`);
                const targetFilePath = path.join(dirPath, targetFileName);

                // 读取目标文件，如果不存在则创建
                let targetContent = {};
                if (fs.existsSync(targetFilePath)) {
                    try {
                        const fileContent = fs.readFileSync(targetFilePath, 'utf8');
                        targetContent = JSON.parse(fileContent);
                    } catch (err: any) {
                        vscode.window.showErrorMessage(`Error reading target file ${targetFileName}: ${err.message}`);
                        continue;
                    }
                }

                // 翻译选中的内容
                const [translatedContent, error] = await translate({
                    API_KEY: apiKey as string,
                    ENDPOINT_ID: endpointId as string,
                    SystemContent: getSystemPrompt(),
                    lang,
                    translateContent: selectedJson
                });
                if (error) {
                    vscode.window.showErrorMessage(`Translation error for ${lang}: ${error}`);
                    continue;
                }

                // 合并翻译结果
                if (translatedContent) {
                    Object.assign(targetContent, translatedContent);

                    // 写入目标文件
                    fs.writeFileSync(targetFilePath, JSON.stringify(targetContent, null, 2), 'utf8');
                }
            }

            vscode.window.showInformationMessage('Translation completed!');
        });

    } catch (err: any) {
        vscode.window.showErrorMessage(`Error processing text: ${err.message}`);
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
  
  #输出格式要求
  必须只返回一个合法的JSON对象，不包含其他任何内容。例如：
  {"key1":"翻译后的值1","key2":"翻译后的值2"}
  
  #参考示例    
  示例 1：    
  输入：{"login":"Login"} zh-CN
  输出：{"login":"登录"}
      
  示例 2：    
  输入：{"login":"Login","register":"Register"} fr
  输出：{"login":"Connexion","register":"S'inscrire"}
  `;
}

export {
    translateSelection,
    setupConfiguration
};