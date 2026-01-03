import * as vscode from 'vscode';

// Cette méthode est appelée quand l'extension est activée
export function activate(context: vscode.ExtensionContext) {
	console.log('L\'extension "n8n-as-code" est active !');

	// La commande définie dans le package.json
	let disposable = vscode.commands.registerCommand('n8n-as-code.helloWorld', () => {
		vscode.window.showInformationMessage('Hello from n8n-as-code!');
	});

	context.subscriptions.push(disposable);
}

// Cette méthode est appelée quand l'extension est désactivée
export function deactivate() {}