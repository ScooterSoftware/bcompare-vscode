// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { File } from 'buffer';
import { exec } from 'child_process';
import { ReadableStreamDefaultController } from 'stream/web';
import * as vscode from 'vscode';
import fs, { open } from 'fs';
import { simpleGit, SimpleGit, CleanOptions } from 'simple-git';
import * as path from 'path';
import * as vsWinReg from '@vscode/windows-registry';
import * as os from 'node:os';

let temporaryFiles: string[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed 
export function activate(context: vscode.ExtensionContext) {

	let leftPath = "";
	let blnLeftReadOnly = false;
	let BCPath: string | undefined = 'bcompare';
	const strOS = os.platform();
	let threeWayCompareAllowed: boolean = true;
	const BCLoadErrorMessage = "Error: Could not open Beyond Compare";
	const extensionName = "bcompare-vscode";

	if(strOS === 'win32')
	{
		let topFolders: any[] = ['HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE'];
		let versionNumbers = ['', ' 5', ' 4',' 3'];
		for(var folder in topFolders)
		{
			if(BCPath !== 'bcompare')
			{
				break;
			}
			for(var version in versionNumbers)
			{
				if(BCPath === 'bcompare')
				{
					try
					{
						const bcRegistryFolder = "SOFTWARE\\Scooter Software\\Beyond Compare";
						BCPath = vsWinReg.GetStringRegKey(
							topFolders[folder], bcRegistryFolder + versionNumbers[version], 'ExePath');
						if(BCPath === undefined)
						{
							BCPath = 'bcompare';
							throw exec;
						}
						let strThreeWayCompareAllowed = vsWinReg.GetStringRegKey(
							topFolders[folder], bcRegistryFolder + versionNumbers[version], 'SupportsMerge');
						threeWayCompareAllowed = strThreeWayCompareAllowed !== "";
					}catch
					{
						threeWayCompareAllowed = false;
					}
				}else
				{
					break;
				}
			}
		}
	}



	registerCommand('.selectLeft', (a) => 
	{
		let success = false;
		if(a)
		{
			if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage(
					"Error: Can not compare to " + a.fsPath + " until it is saved");
			}else if(a.scheme !== "file")
			{
				//Error not a file
				vscode.window.showErrorMessage("Error: Can not compare that");
			}else
			{
				leftPath = a.fsPath;
				success = true;
			}
			
		}else if(!vscode.window.activeTextEditor)
		{
			//Error no active text editor
			vscode.window.showErrorMessage("Error: No active text editor found");
		}else if(vscode.window.activeTextEditor.document.isUntitled)
		{
			//Error untitled
			vscode.window.showErrorMessage(
				"Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved");
		}else
		{
			leftPath = vscode.window.activeTextEditor.document.fileName;
			success = true;
		}
		
		if(success)
		{
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
			blnLeftReadOnly = false;
			vscode.window.showInformationMessage("Marked \"" + path.basename(leftPath) + "\" as left file");
		}
	});

	registerCommand('.compareWithLeft', (a) =>
	{
		let rightPath = "";
		if(a)
		{
			if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage(
					"Error: Can not compare to " + a.fsPath + " until it is saved");
			}else if(a.scheme !== "file")
			{
				//Error not a file
				vscode.window.showErrorMessage("Error: Can not compare that");
			}else
			{
				rightPath = a.fsPath;
			}
			
		}else if(!vscode.window.activeTextEditor)
		{
			//Error no active text editor
			vscode.window.showErrorMessage("Error: No active text editor found");
		}else if(vscode.window.activeTextEditor.document.isUntitled)
		{
			//Error untitled
			vscode.window.showErrorMessage(
				"Error: Can not compare to " + 
				vscode.window.activeTextEditor.document.fileName + 
				" until it is saved");
		}else
		{
			rightPath = vscode.window.activeTextEditor.document.fileName;
		}

		if(rightPath !== "")
		{
			let option = "";
			if(blnLeftReadOnly)
			{
				option = "-lro";
			}
			openBC(option, leftPath, rightPath);
		}
	});

	registerCommand('.selectLeftFolder', (a) => 
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
		vscode.window.showInformationMessage(
			"Marked \"" + splitName[splitName.length - 1] + "\" as left folder");
	});

	registerCommand('.compareWithLeftFolder', (a) =>
	{
		let rightPath = "";
		if(a)
		{
			rightPath = a.fsPath;
		}else
		{
			//Error-no folder
			vscode.window.showErrorMessage("Error: No folder selected");
		}

		if(rightPath !== "")
		{
			openBC("", leftPath, rightPath);
		}
	});

	registerCommand('.compareWithFile', (a) =>
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
			openBC("", a.fsPath, file[0].fsPath);
		});
	});

	registerCommand('.compareWithFolder', (a) =>
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
			openBC("", a.fsPath, folder[0].fsPath);
		});
	});

	registerCommand('.compareParent', (a) =>
	{
		
		let success = false;
		var fullPath: String;
		if(a)
		{
			if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage(
					"Error: Can not compare to the parent of \"" + a.fsPath + "\" until it is saved");
			}else
			{
				fullPath = a.fsPath;
				success = true;
			}
		}else if(!vscode.window.activeTextEditor)
		{
			//Error no active text editor
			vscode.window.showErrorMessage("Error: No active text editor found");
		}else if(vscode.window.activeTextEditor.document.isUntitled)
		{
			//Error untitled
			vscode.window.showErrorMessage(
				"Error: Can not compare to " + 
				vscode.window.activeTextEditor.document.fileName + 
				" until it is saved");
		}else
		{
			fullPath = vscode.window.activeTextEditor.document.fileName;
			success = true;
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

			openBC("", folderPath ,folder[0].fsPath);
		});
	});

	registerCommand('.compareWithSave', async (a) =>
	{
		if(!a)//If not run by right clicking on an editor tab (when run from command pallate or keybinding)
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
					vscode.window.showErrorMessage(
						"Error: \"" + splitPath[splitPath.length - 1] + "\" has no saved version to compare to");
					return;
				}else //and it has a saved version
				{
					if(!vscode.window.activeTextEditor.document.isDirty)//If it hasn't changed, ask for confirmation
					{
						vscode.window.showWarningMessage(
							"\"" + splitPath[splitPath.length - 1] + 
							'\" has not been changed since last save. Compare anyway?', "Yes", "No")
							.then((answer, docPath = fileName, document = vscode.window.activeTextEditor?.document) => 
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
		}else if(!fs.existsSync(a.fsPath))
		{
			vscode.window.showErrorMessage("Error: \"" + path.basename(a.path) + "\" has no saved version to compare to");
			return;
		}else //If it is run by right clicking an editor tab
		{
			let aEditor: vscode.TextDocument | undefined;
			let startingTab = vscode.window.tabGroups.activeTabGroup.activeTab;

			let firstLoop: boolean = true;
			while(vscode.window.tabGroups.activeTabGroup.activeTab !== startingTab || firstLoop)//Loop through all editors to return to the starting one
			{
				let editorFilePath = vscode.window?.activeTextEditor?.document?.uri?.fsPath;
				if(editorFilePath !== undefined)
				{//Known bug: if another tab has the same file open as the one clicked on, that tab may be compared to save instead, depending on what tab is active
					if(editorFilePath === a.fsPath && vscode.window.activeTextEditor !== undefined)//and look for the one that is opening "a"
					{
						aEditor = vscode.window.activeTextEditor.document;
					}
				}
				await vscode.commands.executeCommand("workbench.action.nextEditor");
				firstLoop = false;
			}

			if(aEditor === undefined)//If unsuccessful, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message, or a bug occours)
			{
				vscode.window.showErrorMessage("Error: couldn't find that file");
				return;
			}

			if(aEditor.isDirty)
			{
				compareWithSaveHelper(a.fsPath, aEditor);
			}else
			{
				vscode.window.showWarningMessage("\"" + path.basename(a.path) + 
				'\" has not been changed since last save. Compare anyway?', "Yes", "No").then(answer => 
				{
					if(answer === "Yes" && aEditor !== undefined)
					{
						compareWithSaveHelper(a.fsPath, aEditor);
					}
				});
				return;
			}
		}
	});

	registerCommand('.selectLeftText', async () =>
	{
		if(vscode.window.activeTextEditor === undefined)
		{
			return;//This should be impossible, as this command requires an active text editor to be enabled
		}

		let selection = vscode.window.activeTextEditor.selection;
		let selectedText = vscode.window.activeTextEditor.document.getText(selection);

		let promise = await createRandomFile(selectedText);

		let tempPath = promise.fsPath;

		vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
		vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
		temporaryFiles.push(tempPath);
		leftPath = fs.realpathSync(tempPath);
		blnLeftReadOnly = true;
		vscode.window.showInformationMessage("Highlighted section selected as left file");
	});

	registerCommand('.compareWithLeftText', async () =>
	{
		if(vscode.window.activeTextEditor === undefined)
		{
			return;//This should be impossible, as this command requires an active text editor to be enabled
		}

		let selection = vscode.window.activeTextEditor.selection;
		let selectedText = vscode.window.activeTextEditor.document.getText(selection);

		let promise = await createRandomFile(selectedText);

		let tempPath = promise.fsPath;

		temporaryFiles.push(tempPath);

		let rightPath = fs.realpathSync(tempPath);

		let options = "-rro";
		if(blnLeftReadOnly)
		{
			options += " -lro";
		}

		openBC(options, leftPath, rightPath);
	});

	registerCommand('.gitCompare', async (a) => 
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
				//Modified, compare current to version on git (head)
				let case5Head: string | false = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./");

				if(fs.existsSync(a.resourceUri.fsPath) && case5Head)
				{
					openBC("-lro", case5Head, a.resourceUri.fsPath);
				}else
				{
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
				}
				break;
			case 0:
				//Modified and staged, compare staged to verison on git (head)
				let case0Staged: string | false = await gitCompareHelper(a.resourceUri.fsPath, ":./");
				let case0Head: string | false = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./");

				if(case0Head && case0Staged)
				{
					openBC("-ro", case0Staged, case0Head);
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

	registerCommand('.openFromDiff', async () =>
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
			
			if(tab.input.original.scheme === "git")
			{
				let gitFilePath = await gitCompareHelper(leftFilePath, "HEAD:./");

				if(gitFilePath)
				{
					leftFilePath = gitFilePath;
					options += " -lro";
				}else
				{
					//Error
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
					return;
				}
			}

			if(tab.input.modified.scheme === "git")
			{
				let gitFilePath = await gitCompareHelper(rightFilePath, ":./");

				if(gitFilePath)
				{
					rightFilePath = gitFilePath;
					options += " -rro";
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


		openBC(options, leftFilePath, rightFilePath);
	});

	registerCommand('.compareSelected', (...a) =>
	{
		const items = a[1];
		if(items.length === 2)
		{
			//Two objects for compare - make sure both are files or both are folders
			let fileLeft = items[0].fsPath;
			let fileRight = items[1].fsPath;

			if(fs.statSync(fileLeft).isFile === fs.statSync(fileRight).isFile)
			{
				openBC("", fileLeft, fileRight);
			}else
			{
				//Error: Can't compare files to directories
				vscode.window.showErrorMessage("Error: Can't compare files to directories");
			}
		}else if(items.length === 3 && threeWayCompareAllowed)
		{
			if(strOS !== "win32")
			{
				if(!isPro())
				{
					threeWayCompareAllowed = false;
					vscode.window.showErrorMessage("Error: Can't compare that many things");
					return;
				}
			}

			let fileLeft = items[0].fsPath;
			let fileRight = items[2].fsPath;
			let fileCenter = items[1].fsPath;

			if(fs.statSync(fileLeft).isFile === fs.statSync(fileRight).isFile && fs.statSync(fileLeft).isFile === fs.statSync(fileCenter).isFile)
			{
				openBC("", fileLeft, fileRight, fileCenter);
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

	registerCommand('.launchBC', () => 
	{
		openBC("");
	});

	async function compareWithSaveHelper(filePath: string, editor: vscode.TextDocument)
	{
		let textContent = editor.getText();

		let promise = await createRandomFile(textContent, path.extname(filePath));

		let editPath = promise.fsPath;

		openBC("-rro", filePath, editPath);

		temporaryFiles.push(editPath);
	}

	async function gitCompareHelper(strPath: string, command: string) : Promise<string | false>
	{
		let directory = path.dirname(strPath);
		let fileName = path.basename(strPath);
		let filePath: string | false = false;

		await simpleGit(directory).outputHandler((_comand: any, standardOut: any) => 
		{
			filePath = path.join(os.tmpdir(), rndName() + path.extname(strPath));
			const writeStream = fs.createWriteStream(filePath);
			standardOut.pipe(writeStream).on('close', () =>
			{
				if(filePath)
				{
					temporaryFiles.push(filePath);
				}
			});
		}).raw(["show", command + fileName]).catch((_error) =>
		{
			if(filePath)
			{
				fs.promises.unlink(filePath);
			}
			filePath = false;
		});

		return filePath;
	}

	function bcPath() : string
	{
		if(BCPath === "bcompare")
		{
			return BCPath;
		}else
		{
			return "\"" + BCPath + "\"";
		}
	}

	async function openBC(options: string = "", ...files: string[])
	{
		if(files.length > 4)//Shouldn't ever be true
		{
			//Error: too many files
			vscode.window.showErrorMessage("Error: Can't open that many files in a comparison");
			return;
		}

		let cmd = bcPath() + " ";

		for(var file in files)
		{
			cmd += "\"" + files[file] + "\" ";
		}

		// if(strOS !== 'win32')
		// {
		// 	options = options.replaceAll("/","-");
		// }
		
		cmd += options;

		exec(cmd, (error,stdout,stderr) => 
		{
			if(error !== null)
			{
				if(error.code !== undefined)
				{
					if ((error.code >= 100 && error.code !== 101) || stderr !== '')
					{
						vscode.window.showErrorMessage(BCLoadErrorMessage);
					}
				}
			}
		});
	}

	function rndName() {
		let name = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 10; i++) {
			name += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return name;
	}
	
	function createRandomFile(contents = '', fileExtension = '.txt'): Thenable<vscode.Uri> {
		return new Promise((resolve, reject) => {
			const tmpFile = path.join(os.tmpdir(), rndName() + fileExtension);
			fs.writeFile(tmpFile, contents, (error) => {
				if (error) {
					return reject(error);
				}
	
				resolve(vscode.Uri.file(tmpFile));
			});
		});
	}

	function delay(ms: number) {
		return new Promise( resolve => setTimeout(resolve, ms) );
	}

	function registerCommand(commandName: string, fctn: (...args: any[]) => any)
	{
		let command = vscode.commands.registerCommand(extensionName + commandName, fctn);
		context.subscriptions.push(command);
	}

	function isPro(): boolean
	{
		let possiblePaths: string[] = [];
		

		if(strOS === "darwin")
		{
			const basePath = os.homedir() + "/Library/Application Support/Beyond Compare";
			const isProName = "/IsPro";
			possiblePaths.push(basePath + " 5" + isProName);
			possiblePaths.push(basePath + " 4" + isProName);
			possiblePaths.push(basePath + isProName);
		}else if(strOS === "linux")
		{
			const isProName = "/IsPro";
			let versions: string[] = ["5", "4", ""];
			for(version in versions)
			{
				possiblePaths.push(os.homedir() + "/.beyondcompare" + versions[version] + isProName);
				possiblePaths.push(os.homedir() +  "/" + process.env.XDG_CONFIG_HOME + "/bcompare" + versions[version] + isProName);
				possiblePaths.push(os.homedir() + "/.config/bcompare" + versions[version] + isProName);
			}
		}


		for(var path in possiblePaths)
		{
			let pathExists = fs.existsSync(possiblePaths[path]);
			if(pathExists)
			{
				let bfrReturn = fs.readFileSync(possiblePaths[path]);
				if(bfrReturn[0] === 1)
				{
					return true;
				}
			}
		}

		return false;

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
