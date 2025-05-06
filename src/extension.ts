// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const path = require('path');
const commands = require('./src/commands');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "i18n-translate-extension" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	// 注册翻译选择区域的命令
	let translateDisposable = vscode.commands.registerCommand(
		'i18n-translate.translateSelection',
		commands.translateSelection
	);

	// 注册设置命令
	let setupDisposable = vscode.commands.registerCommand(
		'i18n-translate.setup',
		commands.setupConfiguration
	);

	context.subscriptions.push(translateDisposable);
	context.subscriptions.push(setupDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
