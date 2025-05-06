const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { translate } = require('./translate');
const { getMissContent, setMissContent, getLanguageContent, setLanguageContent } = require('./utils');

// 翻译选中的文本
async function translateSelection() {
    const editor = vscode.window.activeTextEditor;
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

    // 尝试解析选中的JSON文本
    try {
        const selectedJson = JSON.parse(`{${text}}`);
        const keys = Object.keys(selectedJson);

        if (keys.length === 0) {
            vscode.window.showErrorMessage('No valid JSON key-value pairs selected');
            return;
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
            for (const lang of targetLanguages) {
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
                    } catch (err) {
                        vscode.window.showErrorMessage(`Error reading target file ${targetFileName}: ${err.message}`);
                        continue;
                    }
                }

                // 翻译选中的内容
                const [translatedContent, error] = await translate({
                    API_KEY: apiKey,
                    ENDPOINT_ID: endpointId,
                    SystemContent: getSystemPrompt(),
                    lang,
                    translateContent: selectedJson
                });

                if (error) {
                    vscode.window.showErrorMessage(`Translation error for ${lang}: ${error}`);
                    continue;
                }

                // 合并翻译结果
                Object.assign(targetContent, translatedContent);

                // 写入目标文件
                fs.writeFileSync(targetFilePath, JSON.stringify(targetContent, null, 2), 'utf8');
            }

            vscode.window.showInformationMessage('Translation completed!');
        });

    } catch (err) {
        vscode.window.showErrorMessage(`Invalid JSON format: ${err.message}`);
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
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
    }

    const endpointId = await vscode.window.showInputBox({
        prompt: 'Enter your Endpoint ID',
        placeHolder: 'Endpoint ID for the model'
    });

    if (endpointId) {
        const config = vscode.workspace.getConfiguration('i18nTranslate');
        await config.update('endpointId', endpointId, vscode.ConfigurationTarget.Global);
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
  5.  严格按照参考实例的格式输入与输出
  `;
}

module.exports = {
    translateSelection,
    setupConfiguration
};