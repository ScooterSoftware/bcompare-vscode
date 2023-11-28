// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { File } from 'buffer';
import { exec } from 'child_process';
import { ReadableStreamDefaultController } from 'stream/web';
import * as vscode from 'vscode';
import fs, { open } from 'fs';
import { simpleGit, SimpleGit, CleanOptions } from 'simple-git';
import * as path from 'path';

let temporaryFiles: string[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let leftPath = "";
	let blnLeftReadOnly = false;
	var vsWinReg = require('@vscode/windows-registry');
	var os = require('node:os');
	//console.log(vsWinReg.GetStringRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion', 'ProgramFilesPath'));
	
	//let supportsMerge = vsWinReg.GetStringRegKey('HKEY_CURRENT_USER', 'SOFTWARE\\Scooter Software\\Beyond Compare', 'SupportsMerge');

	let BCPath = '';
	let topFolders = ['HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE'];
	let versionNumbers = ['', ' 5', ' 4',' 3'];
	let bcInPath = false;
	const strOS = os.platform();
	var threeWayCompareAllowed: boolean | string = false;

	if(strOS === 'win32')
	{
		for(var folder in topFolders)
		{
			for(var version in versionNumbers)
			{
				if(BCPath === '')
				{
					try
					{
						BCPath = vsWinReg.GetStringRegKey(topFolders[folder], 'SOFTWARE\\Scooter Software\\Beyond Compare' + versionNumbers[version], 'ExePath');
						// threeWayCompareAllowed = vsWinReg.GetStringRegKey(topFolders[folder], 'SOFTWARE\\Scooter Software\\Beyond Compare' + versionNumbers[version], 'SupportsMerge') as boolean;
						threeWayCompareAllowed = vsWinReg.GetStringRegKey(topFolders[folder], 'SOFTWARE\\Scooter Software\\Beyond Compare 5\\BcShellEx', 'Disabled') as boolean;

						if(threeWayCompareAllowed === "")//Note: Dispite the error message, APPARENTLY booleans CAN be empty strings. WHO KNEW!?
						{
							threeWayCompareAllowed = false;
						}else
						{
							threeWayCompareAllowed = true;
						}
					}catch
					{
						threeWayCompareAllowed = false;
					}
				}
			}
		}
	}

	if(BCPath === '')
	{
		bcInPath = true;//Assume it's in %PATH% 
	}

	const BCLoadErrorMessage = "Error: Could not open Beyond Compare";
	const extensionName = "beyondcompareintegration";

	console.log('Congratulations, your extension "beyondcompareintegration" is now active!');

	let selectLeft = vscode.commands.registerCommand(extensionName + '.selectLeft', (a) => 
	{
		let success = false;
		if(a)
		{
			if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage("Error: Can not compare to " + a.fsPath + " until it is saved");
			}else
			{
				if(a.scheme !== "file")
				{
					//Error not a file
					vscode.window.showErrorMessage("Error: Can not compare that");
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
				vscode.window.showErrorMessage("Error: No active text editor found");
			}else
			{
				if(vscode.window.activeTextEditor.document.isUntitled)
				{
					//Error untitled
					vscode.window.showErrorMessage("Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved");
				}else
				{
					leftPath = vscode.window.activeTextEditor.document.fileName;
					success = true;
				}
			}
		}
		
		if(success)
		{
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
			blnLeftReadOnly = false;
			vscode.window.showInformationMessage("Marked \"" + path.basename(leftPath) + "\" as left file");
		}
	});
	context.subscriptions.push(selectLeft);

	let compareWithLeft = vscode.commands.registerCommand(extensionName + '.compareWithLeft', (b) =>
	{
		//Note: it is not possible to make this command's title "compare with [leftItemName]" as dynamic command titles are not a thing, and the developers of visual studio seem to think they have no use

		let rightPath = "";
		if(b)
		{
			if(b.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage("Error: Can not compare to " + b.fsPath + " until it is saved");
			}else
			{
				if(b.scheme !== "file")
				{
					//Error not a file
					vscode.window.showErrorMessage("Error: Can not compare that");
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
				vscode.window.showErrorMessage("Error: No active text editor found");
			}else
			{
				if(vscode.window.activeTextEditor.document.isUntitled)
				{
					//Error untitled
					vscode.window.showErrorMessage("Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved");
				}else
				{
					rightPath = vscode.window.activeTextEditor.document.fileName;
				}
			}
		}

		if(rightPath !== "")
		{
			let option = "";
			if(blnLeftReadOnly)
			{
				option = "/lro";
			}
			openBC(bcPath() + " \"" + leftPath + "\" \"" + rightPath + "\" " + option);
		}
	});
	context.subscriptions.push(compareWithLeft);

	let selectLeftFolder = vscode.commands.registerCommand(extensionName + '.selectLeftFolder', (a) => 
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
		vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
		vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', true);
		vscode.window.showInformationMessage("Marked \"" + splitName[splitName.length - 1] + "\" as left folder");
	});
	context.subscriptions.push(selectLeftFolder);

	let compareWithLeftFolder = vscode.commands.registerCommand(extensionName + '.compareWithLeftFolder', (b) =>
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

		if(rightPath !== "")
		{
			openBC(bcPath() + " \"" + leftPath + "\" \"" + rightPath + "\"");
		}
	});
	context.subscriptions.push(compareWithLeftFolder);

	let compareWithFile = vscode.commands.registerCommand(extensionName + '.compareWithFile', (a) =>
	{
		let options = 
		{
			canSelectFolders: false,
			canSelectFiles: true,
			openLabel: "Compare",
			title: "Compare"
		};

		let promise = vscode.window.showOpenDialog(options);
		promise.then((file) =>
		{
			if(file === undefined)
			{
				return;
			}

			openBC(bcPath() + " \"" + a.fsPath + "\" \"" + file[0].fsPath + "\"");
		});
	});
	context.subscriptions.push(compareWithFile);

	let compareWithFolder = vscode.commands.registerCommand(extensionName + '.compareWithFolder', (a) =>
	{
		let options = 
		{
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: "Compare",
			title: "Compare"
		};

		let promise = vscode.window.showOpenDialog(options);
		promise.then((folder) =>
		{
			if(folder === undefined)
			{
				return;
			}

			openBC(bcPath() + " \"" + a.fsPath + "\" \"" + folder[0].fsPath + "\"");
		});
	});
	context.subscriptions.push(compareWithFolder);

	let compareParentWithFolder = vscode.commands.registerCommand(extensionName + '.compareParent', (a) =>
	{
		
		let success = false;
		var fullPath: String;
		if(a)
		{
			if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage("Error: Can not compare to the parent of \"" + a.fsPath + "\" until it is saved");
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
				vscode.window.showErrorMessage("Error: No active text editor found");
			}else
			{
				if(vscode.window.activeTextEditor.document.isUntitled)
				{
					//Error untitled
					vscode.window.showErrorMessage("Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved");
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
		};

		let promise = vscode.window.showOpenDialog(options);
		promise.then((folder, path = fullPath) =>
		{
			if(folder === undefined)
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

			openBC(bcPath() + " \"" + folderPath + "\" \"" + folder[0].fsPath + "\"");
		});
	});
	context.subscriptions.push(compareParentWithFolder);

	let compareWithSave = vscode.commands.registerCommand(extensionName + '.compareWithSave', async (a) =>
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
						vscode.window.showWarningMessage("\"" + splitPath[splitPath.length - 1] + '\" has not been changed since last save. Compare anyway?', "Yes", "No").then((answer, docPath = fileName, document = vscode.window.activeTextEditor?.document) => 
						{
							if(answer === "Yes" && document !== undefined)
							{
								compareWithSaveHelper(docPath, document);
							}
						});
						return;
					}
					compareWithSaveHelper(fileName, vscode.window.activeTextEditor.document);//If it hasn't changed, compare
				}
			}
		}else//If it is run by right clicking an editor tab
		{
			if(!fs.existsSync(a.fsPath))
			{
				vscode.window.showErrorMessage("Error: \"" + path.basename(a.path) + "\" has no saved version to compare to");
				return;
			}else
			{
				//There is no good way to get a list of all open tabs, so I have to cycle the user through all of them
				let maxCounter = 0;
				while(vscode.window.activeTextEditor === undefined && maxCounter < 100)//Look for a text editor to start
				{
					await vscode.commands.executeCommand("workbench.action.nextEditor");
					maxCounter++;
				}

				if(vscode.window.activeTextEditor === undefined)//If one can't be found, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message)
				{
					vscode.window.showErrorMessage("Error: No open text editors found");
					return;
				}

				let startingEditor = vscode.window.activeTextEditor.document.fileName;
				var aEditor: vscode.TextDocument | undefined;
				await vscode.commands.executeCommand("workbench.action.nextEditor");

				while(vscode.window.activeTextEditor.document.fileName !== startingEditor)//Loop through all editors to return to the starting one
				{
					await vscode.commands.executeCommand("workbench.action.nextEditor");
					if(vscode.window.activeTextEditor.document.uri.fsPath === a.fsPath)//and look for the one that is opening "a"
					{
						aEditor = vscode.window.activeTextEditor.document;
					}
				}
				

				if(aEditor === undefined)//If unsuccessful, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message)
				{
					vscode.window.showErrorMessage("Error: couldn't find that file");
					return;
				}

				if(aEditor.isDirty)
				{
					compareWithSaveHelper(a.fsPath, aEditor);
				}else
				{
					vscode.window.showWarningMessage("\"" + path.basename(a.path) + '\" has not been changed since last save. Compare anyway?', "Yes", "No").then(answer => 
					{
						if(answer === "Yes" && aEditor !== undefined)
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

		let time = Date.now();
		let editPath = "./" + "EDIT" + time + path.basename(filePath);

		fs.writeFileSync(editPath, textContent);

		openBC(bcPath() + " \"" + filePath + "\" \"" + fs.realpathSync(editPath) + "\" /rro");

		temporaryFiles.push(editPath);
	}

	let selectLeftText = vscode.commands.registerCommand(extensionName + '.selectLeftText', () =>
	{
		if(vscode.window.activeTextEditor === undefined)
		{
			return;//This should be impossible, as this command requires an active text editor to be enabled
		}

		let selection = vscode.window.activeTextEditor.selection;
		let selectedText = vscode.window.activeTextEditor.document.getText(selection);
		let time = Date.now();
		let newPath = "./left" + time + ".txt";

		fs.writeFileSync(newPath, selectedText);
		vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
		vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
		temporaryFiles.push(newPath);
		leftPath = fs.realpathSync(newPath);
		blnLeftReadOnly = true;
		vscode.window.showInformationMessage("Highlighted section selected as left file");
		//let x = fs.readFileSync("./left.txt", {encoding: "utf8"});

		//vscode.window.showInformationMessage(fs.realpathSync("./left.txt"));
	});
	context.subscriptions.push(selectLeftText);

	let compareTextWithLeft = vscode.commands.registerCommand(extensionName + '.compareWithLeftText', () =>
	{
		if(vscode.window.activeTextEditor === undefined)
		{
			return;//This should be impossible, as this command requires an active text editor to be enabled
		}

		let selection = vscode.window.activeTextEditor.selection;
		let selectedText = vscode.window.activeTextEditor.document.getText(selection);
		let time = Date.now();
		let newPath = "./right" + time + ".txt";

		fs.writeFileSync(newPath, selectedText);
		temporaryFiles.push(newPath);

		let rightPath = fs.realpathSync(newPath);

		let options = "/rro";
		if(blnLeftReadOnly)
		{
			options += " /lro";
		}

		openBC(bcPath() + " \"" + leftPath + "\" \"" + rightPath + "\" " + options);
	});
	context.subscriptions.push(compareTextWithLeft);

	let gitCompare = vscode.commands.registerCommand(extensionName + '.gitCompare', async (a) => 
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
				//Modified, compare to version on git (head) (and staged version if available?)

				//let case5stagedPresent = await gitCompareHelper(a.resourceUri.fsPath, ":./", "Staged");
				let timeCase5 = Date.now();
				let case5HeadPresent = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./", "Head", timeCase5);

				if(fs.existsSync(a.resourceUri.fsPath) && case5HeadPresent)
				{
					let case5file1 = fs.realpathSync("./Head" + timeCase5 + path.extname(a.resourceUri.fsPath));

					openBC(bcPath() + " \"" + case5file1 + "\" \"" + a.resourceUri.fsPath + "\" /lro");
				}else
				{
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
				}
				break;
			case 0:
				//Modified and staged, compare to verison on git (head)
				let time = Date.now();
				let case0StagedPresent = await gitCompareHelper(a.resourceUri.fsPath, ":./", "Staged", time);
				let case0HeadPresent = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./", "Head", time);

				if(case0HeadPresent && case0StagedPresent)
				{
					let case0file1 = fs.realpathSync("./Staged" + time + path.extname(a.resourceUri.fsPath));
					let case0file2 = fs.realpathSync("./Head" + time + path.extname(a.resourceUri.fsPath));

					openBC(bcPath() + " \"" + case0file1 + "\" \"" + case0file2 + "\" /ro");
				}else
				{
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
				}
				break;
			default:
				//Generic fail
				vscode.window.showErrorMessage("Error: Unable to compare to that");
		}
	});
	context.subscriptions.push(gitCompare);

	async function gitCompareHelper(strPath: string, command: string, label: string, time: number) : Promise<boolean>
	{
		let directory = path.dirname(strPath);
		let fileName = path.basename(strPath);
		let fileContents = "";
		let success = false;

		await simpleGit(directory).outputHandler((_comand: any, standardOut: any) => 
		{
			standardOut.on('data', (data: any) =>
			{
				fileContents += data.toString('utf8');
			});

			standardOut.on('end', (data: any) =>
			{
				//Write fileContents to file and return true
				let ext = path.extname(strPath);
				//let time = Date.now();
				let newPath = "./" + label + time + ext;
				fs.writeFileSync(newPath, fileContents);
				temporaryFiles.push(newPath);
				success = true;
			});
		}).raw(["show", command + fileName]).catch((_error) =>
		{
			success = false;
		});

		return success;
	}

	let openFromDiff = vscode.commands.registerCommand(extensionName + '.openFromDiff', async () =>
	{
		let tab = vscode.window.tabGroups.activeTabGroup.activeTab;

		let leftFilePath = "";
		let rightFilePath = "";

		if(tab === undefined)
		{
			//Error: no tab active
			vscode.window.showErrorMessage("Error: No active tab");
			return;
		}

		let options = "";
		if(tab.input instanceof vscode.TabInputTextDiff)
		{
			rightFilePath = tab.input.modified.fsPath;
			leftFilePath = tab.input.original.fsPath;
			

			let time = Date.now();
			if(tab.input.original.scheme === "git")
			{
				
				let blnSuccess = await gitCompareHelper(leftFilePath, "HEAD:./", "Head", time);

				if(blnSuccess)
				{
					leftFilePath = fs.realpathSync("./Head" + time + path.extname(leftFilePath));
					options += " /lro";
				}else
				{
					//Error
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
					return;
				}
			}

			if(tab.input.modified.scheme === "git")
			{
				let blnSuccess = await gitCompareHelper(rightFilePath, ":./", "Staged", time);

				if(blnSuccess)
				{
					rightFilePath = fs.realpathSync("./Staged" + time + path.extname(rightFilePath));
					options += " /rro";
				}else
				{
					//Error
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
					return;
				}
			}
		}else
		{
			//Error-not a diff tab
			vscode.window.showErrorMessage("Error: Current tab is not a text comparison");
			return;
		}


		openBC(bcPath() + " \"" + leftFilePath + "\" \"" + rightFilePath + "\"" + options);
	});
	context.subscriptions.push(openFromDiff);

	let compareTwoSelected = vscode.commands.registerCommand(extensionName + '.compareTwoSelected', (...a) =>
	{
		if(a[1].length === 2)
		{
			//Two objects for compare - make sure both are files or both are folders
			let fileLeft = a[1][0].fsPath;
			let fileRight = a[1][1].fsPath;

			if(fs.statSync(fileLeft).isFile === fs.statSync(fileRight).isFile)
			{
				openBC(bcPath() + " \"" + fileLeft + "\" \"" + fileRight + "\"");
			}else
			{
				//Error: Can't compare files to directories
				vscode.window.showErrorMessage("Error: Can't compare files to directories");
			}
		}else if(a[1].length === 3 && threeWayCompareAllowed){
			let fileLeft = a[1][0].fsPath;
			let fileRight = a[1][2].fsPath;
			let fileCenter = a[1][1].fsPath;

			if(fs.statSync(fileLeft).isFile === fs.statSync(fileRight).isFile && fs.statSync(fileLeft).isFile === fs.statSync(fileCenter).isFile)
			{
				openBC(bcPath() + " \"" + fileLeft + "\" \"" + fileRight + "\" \"" + fileCenter + "\"");
			}else
			{
				//Error: Can't compare files to directories
				vscode.window.showErrorMessage("Error: Can't compare files to directories");
			}
		}else
		{
			//Error: to many for compare
			vscode.window.showErrorMessage("Error: Can't compare that many things");
		}
	});
	context.subscriptions.push(compareTwoSelected);

	let launchBC = vscode.commands.registerCommand(extensionName + '.launchBC', () => 
	{
		openBC(bcPath());
	});
	context.subscriptions.push(launchBC);

	function bcPath() : string
	{
		if(bcInPath)
		{
			return "BComp";
		}else
		{
			return "\"" + BCPath + "\"";
		}
	}

	function openBC(cmd: string)
	{
		exec(cmd, (error,stdout,stderr) => 
		{
			if(error !== null)
			{
				if(error.code !== undefined)
				{
					if (error.code >= 100 || stderr !== '')
					{
						vscode.window.showErrorMessage(BCLoadErrorMessage);
					}
				}
			}
		});
	}

}


// This method is called when your extension is deactivated
export function deactivate() 
{
	temporaryFiles.forEach((file) =>//Delete all temporary files created by this extension
	{
		fs.promises.unlink(file);
	});
}
