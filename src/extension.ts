// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { exec } from 'child_process';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let leftPath = "";

	console.log('Congratulations, your extension "beyondcompareintegration" is now active!');

	let selectLeft = vscode.commands.registerCommand('beyondcompareintegration.selectLeft', (a) => 
	{
		let success = false;
		if(a)
		{
			if(a.scheme == 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage("Error: Can not compare to " + a.fsPath + " until it is saved")
			}else
			{
				if(a.scheme != "file")
				{
					//Error not a file
					vscode.window.showErrorMessage("Error: Can not compare that")
				}else
				{
					leftPath = a.fsPath;
					success = true;
				}
			}
			
		}else
		{
			if(!vscode.window.activeTextEditor)
			{
				//Error no active text editor
				vscode.window.showErrorMessage("Error: No active text editor found")
			}else
			{
				if(vscode.window.activeTextEditor.document.isUntitled)
				{
					//Error untitled
					vscode.window.showErrorMessage("Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved")
				}else
				{
					leftPath = vscode.window.activeTextEditor.document.fileName;
					success = true;
				}
			}
		}
		
		if(success)
		{
			let splitName = leftPath.split("\\");
			vscode.commands.executeCommand('setContext', 'beyondcompareintegration.leftSelected', true);
			vscode.commands.executeCommand('setContext', 'beyondcompareintegration.leftFolderSelected', false);
			vscode.window.showInformationMessage("Marked \"" + splitName[splitName.length - 1] + "\" as left file");
		}
	});
	context.subscriptions.push(selectLeft);

	let compareWithLeft = vscode.commands.registerCommand('beyondcompareintegration.compareWithLeft', (b) =>
	{
		//Note: it is not possible to make this command's title "compare with [leftItemName]" as dynamic command titles are not a thing, and the developers of visual studio seem to think they have no use

		let rightPath = "";
		if(b)
		{
			if(b.scheme == 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage("Error: Can not compare to " + b.fsPath + " until it is saved")
			}else
			{
				if(b.scheme != "file")
				{
					//Error not a file
					vscode.window.showErrorMessage("Error: Can not compare that")
				}else
				{
					rightPath = b.fsPath;
				}
			}
			
		}else
		{
			if(!vscode.window.activeTextEditor)
			{
				//Error no active text editor
				vscode.window.showErrorMessage("Error: No active text editor found")
			}else
			{
				if(vscode.window.activeTextEditor.document.isUntitled)
				{
					//Error untitled
					vscode.window.showErrorMessage("Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved")
				}else
				{
					rightPath = vscode.window.activeTextEditor.document.fileName;
				}
			}
		}

		if(rightPath != "")
		{
			exec('"C:\\Program Files\\Beyond Compare 4\\BComp.exe" \"' + leftPath + "\" \"" + rightPath + "\"", (error,strStdOut,strStdError) => 
			{
				if (error != null)
				{
					vscode.window.showErrorMessage(strStdError);
				}else
				{
					vscode.window.showInformationMessage(strStdOut);
				}
			});
		}
	});
	context.subscriptions.push(compareWithLeft);

	let selectLeftFolder = vscode.commands.registerCommand('beyondcompareintegration.selectLeftFolder', (a) => 
	{
		if(a)
		{
			leftPath = a.fsPath;
		}else
		{
			//Error-no folder
			vscode.window.showErrorMessage("Error: No folder selected");
		}

		let splitName = leftPath.split("\\");
		vscode.commands.executeCommand('setContext', 'beyondcompareintegration.leftSelected', false);
		vscode.commands.executeCommand('setContext', 'beyondcompareintegration.leftFolderSelected', true);
		vscode.window.showInformationMessage("Marked \"" + splitName[splitName.length - 1] + "\" as left folder");
	});
	context.subscriptions.push(selectLeftFolder);

	let compareWithLeftFolder = vscode.commands.registerCommand('beyondcompareintegration.compareWithLeftFolder', (b) =>
	{
		let rightPath = "";
		if(b)
		{
			rightPath = b.fsPath;
		}else
		{
			//Error-no folder
			vscode.window.showErrorMessage("Error: No folder selected");
		}

		if(rightPath != "")
		{
			exec('"C:\\Program Files\\Beyond Compare 4\\BComp.exe" \"' + leftPath + "\" \"" + rightPath + "\"", (error,strStdOut,strStdError) => 
		{
			if (error != null)
			{
				vscode.window.showErrorMessage(strStdError);
			}else
			{
				vscode.window.showInformationMessage(strStdOut);
			}
		});
		}
	});
	context.subscriptions.push(compareWithLeftFolder);

	let compareWithFile = vscode.commands.registerCommand('beyondcompareintegration.compareWithFile', (a) =>
	{
		let options = 
		{
			canSelectFolders: false,
			canSelectFiles: true,
			openLabel: "Compare",
			title: "Compare"
		}

		let promise = vscode.window.showOpenDialog(options);
		promise.then((file) =>
		{
			if(file == undefined)
			{
				return;
			}

			exec('"C:\\Program Files\\Beyond Compare 4\\BComp.exe" \"' + a.fsPath + "\" \"" + file[0].fsPath + "\"", (error,strStdOut,strStdError) => {});
		});
	});
	context.subscriptions.push(compareWithFile);

	let compareWithFolder = vscode.commands.registerCommand('beyondcompareintegration.compareWithFolder', (a) =>
	{
		let options = 
		{
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: "Compare",
			title: "Compare"
		}

		let promise = vscode.window.showOpenDialog(options);
		promise.then((folder) =>
		{
			if(folder == undefined)
			{
				return;
			}

			exec('"C:\\Program Files\\Beyond Compare 4\\BComp.exe" \"' + a.fsPath + "\" \"" + folder[0].fsPath + "\"", (error,strStdOut,strStdError) => {});
		});
	});
	context.subscriptions.push(compareWithFolder);

	let launchBC = vscode.commands.registerCommand('beyondcompareintegration.launchBC', () => 
	{
		exec('"C:\\Program Files\\Beyond Compare 4\\BComp.exe"', (error,strStdOut,strStdError) => 
		{
			if (error != null)
			{
				vscode.window.showErrorMessage(strStdError);
			}else
			{
				vscode.window.showInformationMessage(strStdOut);
			}
		});
	});
	context.subscriptions.push(launchBC);

}


// This method is called when your extension is deactivated
export function deactivate() {}
