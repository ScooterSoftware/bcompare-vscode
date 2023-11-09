// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { File } from 'buffer';
import { exec } from 'child_process';
import { ReadableStreamDefaultController } from 'stream/web';
import * as vscode from 'vscode';
import fs from 'fs';

let temporaryFiles: string[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

		const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git').exports;
		const git = gitExtension.getAPI(1);

	let leftPath = "";
	const BCLoadErrorMessage = "Error: Could not open Beyond Compare. Make sure you have the right path set in options";

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
			exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + leftPath + "\" \"" + rightPath + "\"", (error,stdout,stderr) => 
			{
				if(error != null)
				{
					if(error.code != undefined)
					{
						if (error.code >= 100 || stderr != '')
						{
							vscode.window.showErrorMessage(BCLoadErrorMessage);
						}
					}
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
			exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + leftPath + "\" \"" + rightPath + "\"", (error,stdout,stderr) => 
			{
				if(error != null)
				{
					if(error.code != undefined)
					{
						if (error.code >= 100 || stderr != '')
						{
							vscode.window.showErrorMessage(BCLoadErrorMessage);
						}
					}
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

			exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + a.fsPath + "\" \"" + file[0].fsPath + "\"", (error,stdout,stderr) => 
			{
				if(error != null)
				{
					if(error.code != undefined)
					{
						if (error.code >= 100 || stderr != '')
						{
							vscode.window.showErrorMessage(BCLoadErrorMessage);
						}
					}
				}
			});
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

			exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + a.fsPath + "\" \"" + folder[0].fsPath + "\"", (error,stdout,stderr) => 
			{
				if(error != null)
				{
					if(error.code != undefined)
					{
						if (error.code >= 100 || stderr != '')
						{
							vscode.window.showErrorMessage(BCLoadErrorMessage);
						}
					}
				}
			});
		});
	});
	context.subscriptions.push(compareWithFolder);

	let compareParentWithFolder = vscode.commands.registerCommand('beyondcompareintegration.compareParent', (a) =>
	{
		
		let success = false;
		var fullPath: String;
		if(a)
		{
			if(a.scheme == 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage("Error: Can not compare to the parent of \"" + a.fsPath + "\" until it is saved")
			}else
			{
				fullPath = a.fsPath;
				success = true;
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
					fullPath = vscode.window.activeTextEditor.document.fileName;
					success = true;
				}
			}
		}

		if(!success)
		{
			return;
		}
		
		let options = 
		{
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: "Compare",
			title: "Compare"
		}

		let promise = vscode.window.showOpenDialog(options);
		promise.then((folder, path = fullPath) =>
		{
			if(folder == undefined)
			{
				return;
			}

			var splitPath;

			splitPath = path.split("\\");
			
			let folderPath = splitPath[0];
			for(let intI = 1; intI < splitPath.length - 1; intI++)
			{
				folderPath += "\\" + splitPath[intI];
			}

			exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + folderPath + "\" \"" + folder[0].fsPath + "\"", (error,stdout,stderr) => 
			{
				if(error != null)
				{
					if(error.code != undefined)
					{
						if (error.code >= 100 || stderr != '')
						{
							vscode.window.showErrorMessage(BCLoadErrorMessage);
						}
					}
				}
			});
		});
	});
	context.subscriptions.push(compareParentWithFolder);

	let compareWithSave = vscode.commands.registerCommand('beyondcompareintegration.compareWithSave', async (a) =>
	{
		if(!a)//If not run by right clicking on an editor tab
		{
			if(!vscode.window.activeTextEditor)
			{
				vscode.window.showErrorMessage("Error: No active text editor");
				return;
			}else //but there is a text editor active
			{
				let fileName = vscode.window.activeTextEditor.document.fileName;
				let splitPath = fileName.split('\\');
				if(!fs.existsSync(fileName))
				{
					vscode.window.showErrorMessage("Error: \"" + splitPath[splitPath.length - 1] + "\" has no saved version to compare to");
					return;
				}else //and it has a saved version
				{
					if(!vscode.window.activeTextEditor.document.isDirty)//If it hasn't changed, ask for confirmation
					{
						vscode.window.showWarningMessage("\"" + splitPath[splitPath.length - 1] + '\" has not been changed since last save. Compare anyway?', "Yes", "No").then((answer, path = fileName, document = vscode.window.activeTextEditor?.document) => 
						{
							if(answer === "Yes" && document != undefined)
							{
								compareWithSaveHelper(path, document);
							}
						});
						return;
					}
					compareWithSaveHelper(fileName, vscode.window.activeTextEditor.document);//If it hasn't changed, compare
				}
			}
		}else//If it is run by right clicking an editor tab
		{
			let splitPath = a.path.split('/');
			if(!fs.existsSync(a.fsPath))
			{
				vscode.window.showErrorMessage("Error: \"" + splitPath[splitPath.length - 1] + "\" has no saved version to compare to");
				return;
			}else
			{
				let maxCounter = 0;
				while(vscode.window.activeTextEditor == undefined && maxCounter < 100)//Look for a text editor to start
				{
					await vscode.commands.executeCommand("workbench.action.nextEditor");
					maxCounter++;
				}

				if(vscode.window.activeTextEditor == undefined)//If one can't be found, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message)
				{
					vscode.window.showErrorMessage("Error: No open text editors found");
					return;
				}

				let startingEditor = vscode.window.activeTextEditor.document.fileName;
				var aEditor: vscode.TextDocument | undefined;
				await vscode.commands.executeCommand("workbench.action.nextEditor");

				while(vscode.window.activeTextEditor.document.fileName != startingEditor)//Loop through all editors to return to the starting one
				{
					await vscode.commands.executeCommand("workbench.action.nextEditor");
					if(vscode.window.activeTextEditor.document.uri.fsPath == a.fsPath)//and look for the one that is opening "a"
					{
						aEditor = vscode.window.activeTextEditor.document;
					}
				}

				if(aEditor == undefined)//If unsuccessful, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message)
				{
					vscode.window.showErrorMessage("Error: couldn't find that file");
					return;
				}

				if(aEditor.isDirty)
				{
					compareWithSaveHelper(a.fsPath, aEditor);
				}else
				{
					vscode.window.showWarningMessage("\"" + splitPath[splitPath.length - 1] + '\" has not been changed since last save. Compare anyway?', "Yes", "No").then(answer => 
					{
						if(answer === "Yes" && aEditor != undefined)
						{
							compareWithSaveHelper(a.fsPath, aEditor);
						}
					});
					return;
				}
			}
		}
	});
	context.subscriptions.push(compareWithSave);

	function compareWithSaveHelper(filePath: string, editor: vscode.TextDocument)
	{
		let textContent = editor.getText();
		//let allDocuments = vscode.workspace.textDocuments

		// let maxCounter = 0;
		// while(vscode.window.activeTextEditor == undefined && maxCounter < 100)//Look for a text editor to start
		// {
		// 	await vscode.commands.executeCommand("workbench.action.nextEditor");
		// 	maxCounter++;
		// }

		// if(vscode.window.activeTextEditor == undefined)//If one can't be found, give up
		// {
		// 	return;
		// }

		// let startingEditor = vscode.window.activeTextEditor.document.fileName;
		// await vscode.commands.executeCommand("workbench.action.nextEditor");

		// while(vscode.window.activeTextEditor.document.fileName != startingEditor)
		// {
		// 	await vscode.commands.executeCommand("workbench.action.nextEditor");
		// 	if(vscode.window.activeTextEditor.document.uri.fsPath == filePath)
		// 	{
		// 		textContent = vscode.window.activeTextEditor.document.getText();
		// 	}
		// }

		// for(let intI = 0; intI < allDocuments.length; intI++)
		// {
		// 	if(allDocuments[intI].uri.fsPath == filePath)
		// 	{
		// 		textContent = allDocuments[intI].getText();
		// 		break;
		// 	}
		// }

		// if(textContent == "")
		// {
		// 	vscode.window.showErrorMessage("Error: could not find an open editor with that file");
		// 	return;
		// }

		let splitPath = filePath.split('\\');
		let editPath = "./" + splitPath[splitPath.length - 1] + "EDIT";

		fs.writeFileSync(editPath, textContent);

		exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + filePath + "\" \"" + fs.realpathSync(editPath) + "\"", (error,stdout,stderr) => 
		{
			if(error != null)
			{
				if(error.code != undefined)
				{
					if (error.code >= 100 || stderr != '')
					{
						vscode.window.showErrorMessage(BCLoadErrorMessage);
					}
				}
			}
		});

		temporaryFiles.push(editPath);
	}

	let selectLeftText = vscode.commands.registerCommand('beyondcompareintegration.selectLeftText', () =>
	{
		if(vscode.window.activeTextEditor == undefined)
		{
			return;//This should be impossible, as this command requires an active text editor to be enabled
		}

		let selection = vscode.window.activeTextEditor.selection;
		let selectedText = vscode.window.activeTextEditor.document.getText(selection)

		fs.writeFileSync("./left.txt", selectedText);
		vscode.commands.executeCommand('setContext', 'beyondcompareintegration.leftSelected', true);
		vscode.commands.executeCommand('setContext', 'beyondcompareintegration.leftFolderSelected', false);
		temporaryFiles.push("./left.txt");
		leftPath = fs.realpathSync("./left.txt");
		//let x = fs.readFileSync("./left.txt", {encoding: "utf8"});

		//vscode.window.showInformationMessage(fs.realpathSync("./left.txt"));
	});
	context.subscriptions.push(selectLeftText);

	let compareTextWithLeft = vscode.commands.registerCommand('beyondcompareintegration.compareWithLeftText', () =>
	{
		if(vscode.window.activeTextEditor == undefined)
		{
			return;//This should be impossible, as this command requires an active text editor to be enabled
		}

		let selection = vscode.window.activeTextEditor.selection;
		let selectedText = vscode.window.activeTextEditor.document.getText(selection)

		fs.writeFileSync("./right.txt", selectedText);
		temporaryFiles.push("./right.txt");

		let rightPath = fs.realpathSync("./right.txt");

		exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare + " \"" + leftPath + "\" \"" + rightPath + "\"", (error,stdout,stderr) => 
			{
				if(error != null)
				{
					if(error.code != undefined)
					{
						if (error.code >= 100 || stderr != '')
						{
							vscode.window.showErrorMessage(BCLoadErrorMessage);
						}
					}
				}
			});
	});
	context.subscriptions.push(compareTextWithLeft);

	let testCommand = vscode.commands.registerCommand('beyondcompareintegration.test', (a) => 
	{
		switch(a.type)
		{
			case 1:
			case 7:
				//Can't compare - no git version
				vscode.window.showErrorMessage("Error: No version of that file found in the current branch");
				break;
			case 2:
			case 6:
				//Can't compare - no version on disk
				vscode.window.showErrorMessage("Error: No version of that file found on the disk");
				break;
			case 5:
				//Modified, compare to version on disk (and staged version if available?)
				break;
			case 0:
				//Modified and staged, compare to verison on disk
			default:
				//Generic fail
				vscode.window.showErrorMessage("Error: Unable to compare to that")
		}
	});
	context.subscriptions.push(testCommand);

	let launchBC = vscode.commands.registerCommand('beyondcompareintegration.launchBC', () => 
	{
		exec(vscode.workspace.getConfiguration('beyondcompareintegration').pathToBeyondCompare, (error,strStdOut,strStdError) => 
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
export function deactivate() 
{
	temporaryFiles.forEach((file) =>//Delete all temporary files created by this extension
	{
		fs.promises.unlink(file);
	});
}
