//A note on changing the order of items in a context menu:
//To have full control of the order, all items in a menu should have a defined group
//Note: the group is defined in package.json for each individual menu, not within the section where commands are defined
//Items with the same group string will show up in the same "group" with groups divided by black bars
//Groups will be added to the menu alphabetically
//Group names aren't visible to the user (as far as I can tell), so they can be anything
//By default, menu items will be ordered alphabetically by command/submenu name
//To choose the order in which items appear, add "@#" to the end of the group string with # being the command's position in the menu
//Items will still be in the same group even if they have different "@#" at the end of the group string

//For example: to have menu item "foo" appear before menu item "bar" within a group named "general",
//foo should have a group string of "general@1" and bar should have "general@2"

//In order for a command to show up as a button next to the editor tabs, it must be in the "editor/title" menu
//The associated command must have a defined icon, and its group must be "navigation"


// ,
// "configuration": {
// 	"title": "Beyond Compare",
// 	"properties": {
// 	"bcompare-vscode.skipDefaultCompareTool": {
// 		"type": "boolean",
// 		"default": false,
// 		"description": "Controls whether Beyond Compare is used instead of the built-in Diff Editor for standard comparison commands."
// 	}
// 	}
// }


import { exec } from 'child_process';
import * as vscode from 'vscode';
import fs from 'fs';
import { simpleGit} from 'simple-git';
import * as path from 'path';
import * as vsWinReg from '@vscode/windows-registry';
import * as os from 'node:os';

let temporaryFiles: string[] = [];
let leftPath = "";
let globalState : vscode.Memento;

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {

	let blnLeftReadOnly = false;
	let strLeftLabel = "";
	let BCPath: string | undefined = 'bcompare';
	const strOS = os.platform();
	const BCLoadErrorMessage = "Error: Could not open Beyond Compare";
	const extensionName = "bcompare-vscode";
	globalState = context.globalState;

	readLeftPath();
	
	vscode.window.onDidChangeWindowState(state => { 

		if (state.focused) 
		{ 
			readLeftPath();
		}
	}); 

	// vscode.window.tabGroups.onDidChangeTabs(event => {
	// 	if(event.opened.length >= 1 && vscode.workspace.getConfiguration("bcompare-vscode").skipDefaultCompareTool)
	// 	{
	// 		event.opened.forEach((tab) => {
	// 			try //Try-catch in case another extension messes with things first
	// 			{
	// 				if(tab.input instanceof vscode.TabInputTextDiff)
	// 				{	
	// 					openFromDiffHelper(tab.input);
	// 					vscode.window.tabGroups.close(tab);
	// 				}
	// 			}catch(e){}
	// 		});
	// 	}
	// });


	registerCommand('.selectLeft', async (a) =>
	{
		let success = false;
		let leftFileName : string = "";
		if(a)
		{
			//vscode.window.showInformationMessage(a.scheme);
			if(a.scheme === "file")
			{
				writeLeftPath(a.fsPath);
				success = true;
				leftFileName = a.fsPath;
			}else if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage(
					"Error: Can not compare to " + a.fsPath + " until it is saved");
			}else
			{
				let filePath = await copyRemoteFileAsTemp(a);
				if(!filePath)
				{
					return;
				}
				writeLeftPath(filePath, true, a.fsPath);
				success = true;
				leftFileName = a.fsPath;
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
		}else if(vscode.window.activeTextEditor.document.uri.scheme === "file")
		{
			writeLeftPath(vscode.window.activeTextEditor.document.fileName);
			success = true;
			leftFileName = vscode.window.activeTextEditor.document.fileName;
		}else
		{
			let filePath = await copyRemoteFileAsTemp(vscode.window.activeTextEditor.document.uri);
			if(!filePath)
			{
				return;
			}
			writeLeftPath(filePath, true, vscode.window.activeTextEditor.document.uri.fsPath);
			success = true;
			leftFileName = vscode.window.activeTextEditor.document.fileName;
		}
		
		if(success)
		{
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
			
			vscode.window.showInformationMessage("Marked \"" + leftFileName + "\" as left file");
		}
	});

	registerCommand('.compareWithLeft', async (a) =>
	{
		let rightPath : string | false = "";
		let blnRRO : boolean = false;
		let rightLabel = "";
		if(a)
		{
			if(a.scheme === "file")
			{
				rightPath = a.fsPath;
			}else if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage(
					"Error: Can not compare to " + a.fsPath + " until it is saved");
			}else
			{
				rightPath = await copyRemoteFileAsTemp(a);
				if(!rightPath)
				{
					return;
				}
				rightLabel = a.fsPath;
				blnRRO = true;
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
		}else if(vscode.window.activeTextEditor.document.uri.scheme === "file")
		{
			rightPath = vscode.window.activeTextEditor.document.fileName;
		}else
		{
			rightPath = await copyRemoteFileAsTemp(vscode.window.activeTextEditor.document.uri);
			rightLabel = vscode.window.activeTextEditor.document.uri.fsPath;
			blnRRO = true;
		}

		if(rightPath !== "" && rightPath)//Check that rightPath isn't an empty string or false
		{
			let option = "";
			if(blnLeftReadOnly)
			{
				option = "-lro";
			}
			if(blnRRO)
			{
				option += " -rro";
			}
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
			openBC(option, [strLeftLabel, rightLabel], leftPath, rightPath);
			clearLeftPath();
		}
	});

	registerCommand('.selectLeftFolder', (a) => 
	{
		if(a)
		{
			writeLeftPath(a.fsPath);
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
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
			openBC("", ["",""], leftPath, rightPath);
			clearLeftPath();
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
		promise.then( async (file) =>
		{
			if(file === undefined)
			{
				return;//Cancel selected
			}

			let options = "";
			let aFile : string | false;
			if(a.scheme === "file")
			{
				//openBC("", a.fsPath, file[0].fsPath);
				aFile = a.fsPath;
			}else
			{
				aFile = await copyRemoteFileAsTemp(a);
				options += "-lro";
			}

			let compFile : string | false;
			if(file[0].scheme === "file")
			{
				compFile = file[0].fsPath;
			}else
			{
				compFile = await copyRemoteFileAsTemp(file[0]);
				options += " -rro";
			}

			if(compFile && aFile)
			{
				openBC(options, [a.fsPath, file[0].fsPath], aFile, compFile);
			}
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

			openBC("", ["",""], folderPath ,folder[0].fsPath);
		});
	});

	registerCommand('.compareWithSave', async (a) =>
	{
		if(!a)//If not run by right clicking on an editor tab (when run from command palette or keybinding)
		{
			if(!vscode.window.activeTextEditor)
			{
				vscode.window.showErrorMessage("Error: No active text editor");
				return;
			}else //but there is a text editor active
			{
				let fileName : string | false = vscode.window.activeTextEditor.document.fileName;
				let splitPath = fileName.split('\\');
				if(vscode.window.activeTextEditor.document.isUntitled)
				{//No saved version version
					vscode.window.showErrorMessage(
						"Error: \"" + splitPath[splitPath.length - 1] + "\" has no saved version to compare to");
					return;
				}else //and it has a saved version
				{
					if(vscode.window.activeTextEditor.document.uri.scheme !== "file")
					{
						fileName = await copyRemoteFileAsTemp(vscode.window.activeTextEditor.document.uri);
						if(!fileName)
						{
							return;
						}
					}

					if(!vscode.window.activeTextEditor.document.isDirty)//If it hasn't changed, ask for confirmation
					{
						let doc = vscode.window.activeTextEditor?.document;
						if(!fileName)//Shouldn't happen, should always be caught earlier
						{
							return;
						}
						vscode.window.showWarningMessage(
							"\"" + splitPath[splitPath.length - 1] + 
							'\" has not been changed since last save. Compare anyway?', "Yes", "No")
							.then((answer, docPath : string = verifyIsString(fileName), document = doc) => 
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
				if(!firstLoop || aEditor === undefined){await vscode.commands.executeCommand("workbench.action.nextEditor");}
				firstLoop = false;
			}

			if(aEditor === undefined)//If unsuccessful, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message, or a bug occurs)
			{
				vscode.window.showErrorMessage("Error: couldn't find that file");
				return;
			}

			let aPath : string | false = "";

			if(a.scheme === "file")
			{
				aPath = a.fsPath;
			}else
			{
				aPath = await copyRemoteFileAsTemp(a);
			}

			if(!aPath)
			{
				return;
			}

			if(aEditor.isDirty)
			{
				compareWithSaveHelper(aPath, aEditor);
			}else
			{
				vscode.window.showWarningMessage("\"" + path.basename(a.path) + 
				'\" has not been changed since last save. Compare anyway?', "Yes", "No").then(answer => 
				{
					if(answer === "Yes" && aEditor !== undefined)
					{
						if(aPath)
						{
							compareWithSaveHelper(aPath, aEditor);
						}
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
		writeLeftPath(fs.realpathSync(tempPath), true, "Left Text");
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

		vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
		openBC(options, [strLeftLabel, "Right Text"], leftPath, rightPath);
		clearLeftPath();
	});

	registerCommand('.gitCompare', async (a) => 
	{
		if(a.type === undefined)
		{
			//Error: git compare doesn't work when remote
			vscode.window.showErrorMessage("Error: unable to read from git");
		}

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
					openBC("-lro", ["Head","Current Version"], case5Head, a.resourceUri.fsPath);
				}else
				{
					vscode.window.showErrorMessage("Error: an error occurred while reading from git");
				}
				break;
			case 0:
				//Modified and staged, compare staged to version on git (head)
				let case0Staged: string | false = await gitCompareHelper(a.resourceUri.fsPath, ":./");
				let case0Head: string | false = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./");

				
				let compareTarget = await vscode.window.showQuickPick(["Compare to head","Compare to current version"], {placeHolder: 'Compare to what?'});

				if(compareTarget === undefined)
				{
					return;
				}else if(compareTarget === "Compare to head")
				{
					if(case0Head && case0Staged)
					{
						openBC("-ro", ["Head","Staged"], case0Head, case0Staged);
					}else
					{
						vscode.window.showErrorMessage("Error: an error occurred while reading from git");
					}
				}else
				{
					if(fs.existsSync(a.resourceUri.fsPath) && case0Staged)
					{
						openBC("-lro", ["Staged","Current Version"], case0Staged, a.resourceUri.fsPath);
					}else
					{
						vscode.window.showErrorMessage("Error: an error occurred while reading from git");
					}
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

		if(tab === undefined)
		{
			//Error: no tab active
			vscode.window.showErrorMessage("Error: No active tab");
			return;
		}

		if(tab.input instanceof vscode.TabInputTextDiff)
		{
			openFromDiffHelper(tab.input);
		}else
		{
			//Error-not a diff tab
			vscode.window.showErrorMessage("Error: Current tab is not a text comparison");
			return;
		}
	});

	registerCommand('.compareSelected', (...a) =>
	{
		compareSelected(a);
	});

	registerCommand('.mergeSelected', (...a) =>
	{
		compareSelected(a);
	});

	registerCommand('.compareFileToClipboard', async (a) =>
	{
		let options = "-rro";
		let comparePath : string | false = "";
		let fileLabel : string = "";
		if(a)
		{
			if(a.scheme === 'untitled')
			{
				//Error untitled
				vscode.window.showErrorMessage(
					"Error: Can not compare to " + a.fsPath + " until it is saved");
			}else if(a.scheme === "file")
			{
				comparePath = a.fsPath;
			}else
			{
				comparePath = await copyRemoteFileAsTemp(a);
				options += " -lro";
				fileLabel = verifyIsString(a.fsPath);
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
		}else if(vscode.window.activeTextEditor.document.uri.scheme === "file")
		{
			comparePath = vscode.window.activeTextEditor.document.fileName;
		}else
		{
			comparePath = await copyRemoteFileAsTemp(vscode.window.activeTextEditor.document.uri);
			options += " -lro";
			fileLabel = verifyIsString(vscode.window.activeTextEditor?.document?.fileName);
		}

		if(comparePath !== "" && comparePath)
		{
			let clipboardPath = await saveClipboardToFile();
			if(clipboardPath === false)
			{
				vscode.window.showErrorMessage("Error: Clipboard does not contain readable text");
			}else
			{
				openBC(options, [fileLabel, "Clipboard Contents"], comparePath, clipboardPath);
			}
		}
	});

	registerCommand('.compareTextToClipboard', async () =>
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
		let comparePath = fs.realpathSync(tempPath);

		if(comparePath !== "")
		{
			let clipboardPath = await saveClipboardToFile();
			if(clipboardPath === false)
			{
				vscode.window.showErrorMessage("Error: Clipboard does not contain readable text");
			}else
			{
				openBC("-ro", ["Highlighted Text", "Clipboard Contents"], comparePath, clipboardPath);
			}
		}else
		{//Should never happen
			vscode.window.showErrorMessage("Error: No text selected");
		}
	});

	registerCommand('.launchBC', () => 
	{
		openBC("",[]);
	});

	async function compareSelected(a: any[])
	{
		const items = a[1];
		if(items.length === 2)
		{
			//Two objects for compare - make sure both are files or both are folders
			let fileLeft = items[0].fsPath;
			let fileRight = items[1].fsPath;
			let leftIsFile : boolean;
			let rightIsFile : boolean;

			try//Vscode does not provide a method to check if a resource is a file, so this is what I have to do
			{
				await vscode.workspace.fs.readFile(items[0]);
				leftIsFile = true;
			}catch
			{
				leftIsFile = false;
			}
			try
			{
				await vscode.workspace.fs.readFile(items[1]);
				rightIsFile = true;
			}catch
			{
				rightIsFile = false;
			}

			if(leftIsFile === rightIsFile)
			{
				let options = "";
				if((items[0].scheme !== "file" || items[1].scheme !== "file"))//If an item is not a regular file
				{	
					if(!leftIsFile)//No folders
					{
						vscode.window.showErrorMessage("The comparison of non-local folders is not currently supported");
						return;
					}else
					{
						if(items[0].scheme !== "file")
						{
							fileLeft = await copyRemoteFileAsTemp(items[0]);
							options += "-lro";
						}

						if(items[1].scheme !== "file")
						{
							fileRight = await copyRemoteFileAsTemp(items[1]);
							options += " -rro";
						}
					}
				}
				
				openBC(options, fileLeft, fileRight);
				
			}else
			{
				//Error: Can't compare files to directories
				vscode.window.showErrorMessage("Error: Can't compare files to directories");
			}
		}else if(items.length === 3)//Unused (not updated with virtual file support)
		{
			if(!isPro())
			{
				vscode.window.showErrorMessage("Error: Can't compare that many things");
				return;
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
	}

	async function compareWithSaveHelper(filePath: string, editor: vscode.TextDocument)
	{
		let textContent = editor.getText();

		let promise = await createRandomFile(textContent, path.extname(filePath));

		let editPath = promise.fsPath;

		openBC("-ro", ["Saved Version", "Edited Version"], filePath, editPath);

		temporaryFiles.push(editPath);
	}

	async function gitCompareHelper(strPath: string, command: string) : Promise<string | false>
	{
		let directory = path.dirname(strPath);
		let fileName = path.basename(strPath);
		let filePath: string | false = false;

		await simpleGit(directory).outputHandler((_command: any, standardOut: any) => 
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

	async function saveClipboardToFile() : Promise<string | false>
	{
		let contents = await vscode.env.clipboard.readText();

		if(contents === '')
		{
			return false;
		}

		let promise = await createRandomFile(contents);
		let returnPath = promise.fsPath;
		temporaryFiles.push(returnPath);

		return returnPath;
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

	function readRegistry() : void
	{
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
					const bcRegistryFolder = "SOFTWARE\\Scooter Software\\Beyond Compare";
					if(BCPath === 'bcompare')
					{
						try
						{
							BCPath = vsWinReg.GetStringRegKey(
								topFolders[folder], bcRegistryFolder + versionNumbers[version], 'ExePath');
							if(BCPath === undefined || BCPath === '')//if not found, reset to default
							{
								BCPath = 'bcompare';
							}
							
						}catch
						{
							BCPath = 'bcompare';
						}
					}
				}
			}
		}
	}

	async function openBC(options: string = "", names : string[], ...files: string[])
	{
		readRegistry();//Update path to BC (if on windows)

		if(files.length > 4 || files.length > names.length)//Shouldn't ever be true
		{
			//Error: too many files or not enough names
			vscode.window.showErrorMessage("Error: Can't open that many files in a comparison");
			return;
		}

		let cmd = bcPath() + " ";

		for(var file in files)
		{
			cmd += "\"" + files[file] + "\" ";
		}

		for(let i = 0; i < files.length; i++)
		{
			if(names[i] !== "")
			{
				options += " -title" + (i + 1) + "=\"" + names[i] + "\"";
			}
		}

		cmd += options;

		//Clear left file/folder

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
		if(strOS === "win32")
		{
			let versionNumbers = ['', ' 5', ' 4',' 3'];
			for(var version in versionNumbers)
			{
				const bcRegistryFolder = "SOFTWARE\\Scooter Software\\Beyond Compare";
				try
				{
					let strThreeWayCompareAllowed = vsWinReg.GetStringRegKey(
						'HKEY_CURRENT_USER', bcRegistryFolder + versionNumbers[version], 'SupportsMerge');
				
					if(strThreeWayCompareAllowed === '\u0000')
					{
						return false;
					}else if(strThreeWayCompareAllowed === '\u0001')
					{
						return true;
					}
				}catch{}
			}
			
			return true;
		}

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
			for(var version in versions)
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
				}else if(bfrReturn[0] === 0)
				{
					return false;
				}
			}
		}

		return true;
	}

	function writeLeftPath(strPath : string, blnTempFile : boolean = false, strNewLeftName : string = "")
	{
		leftPath = strPath;
		
		if(globalState.get("leftIsPreserved"))//If the current left path is a temp file
		{
			let globalLeft = verifyIsString(globalState.get("leftPath"));
			if(!temporaryFiles.includes(globalLeft))//And it isn't already in temp files
			{
				temporaryFiles.push(globalLeft);//Add it
			}
		}

		blnLeftReadOnly = blnTempFile;
		strLeftLabel = strNewLeftName;

		globalState.update("leftPath", strPath);
		globalState.update("leftIsPreserved", blnTempFile);
		globalState.update("leftName", strLeftLabel);
	}

	function readLeftPath()
	{
		//Read path
		let readFilePath : string = verifyIsString(globalState.get("leftPath"));
		let leftPreserved = globalState.get("leftIsPreserved");
		let leftName : string = verifyIsString(globalState.get("leftName"));

		if(leftPreserved) //Check if path was a temp file that was preserved
		{
			temporaryFiles.push(readFilePath);//Add it to temp files
			blnLeftReadOnly = true;
		}


		if(readFilePath === '' || !fs.existsSync(readFilePath))//No left item or left item was deleted/is inaccessible
		{
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
			readFilePath = '';
		}else if(fs.statSync(readFilePath).isFile())//Left item is file
		{
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
		}else//Left item is folder
		{
			vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
			vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', true);
		}

		leftPath = readFilePath;
		strLeftLabel = leftName;
	}

	function clearLeftPath()
	{
		vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
		vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);

		writeLeftPath("");
		globalState.update("leftIsPreserved", false);
	}

	async function openFromDiffHelper(tabInput : vscode.TabInputTextDiff)
	{
		let rightFilePath : string;
		let leftFilePath : string;
		let options = "";
		let leftLabel = "";
		let rightLabel = "";


		if(tabInput.original.scheme !== "file")
		{
			let extension : string;
			try
			{
				extension = path.extname(tabInput.original.path);
			}catch
			{
				extension = ".txt";
			}

			leftFilePath = path.join(os.tmpdir(), rndName() + extension);

			try
			{
				let leftFileContent = await vscode.workspace.fs.readFile(tabInput.original);
				await vscode.workspace.fs.writeFile(vscode.Uri.file(leftFilePath), leftFileContent);
			}catch
			{
				let visibleEditors = vscode.window.visibleTextEditors;
				for(let i = 0; i < visibleEditors.length; i++)
				{
					if(visibleEditors[i].document.uri.query === tabInput.original.query)
					{
						let text = visibleEditors[i].document.getText();
						if(typeof text === "string")
						{
							fs.writeFileSync(leftFilePath, text);
						}else
						{
							//Error can't read left file
							vscode.window.showErrorMessage("Error: Can't open these files in Beyond Compare");
							return;
						}
						break;
					}
				}
			}
			
			temporaryFiles.push(leftFilePath);
			options += " -lro";
			leftLabel = tabInput.original.fsPath;
		}else
		{
			leftFilePath = tabInput.original.fsPath;
		}

		if(tabInput.modified.scheme !== "file")
		{
			let extension : string;
			try
			{
				extension = path.extname(tabInput.modified.path);
			}catch
			{
				extension = ".txt";
			}

			rightFilePath = path.join(os.tmpdir(), rndName() + extension);

			try
			{
				let rightFileContent = await vscode.workspace.fs.readFile(tabInput.modified);
				await vscode.workspace.fs.writeFile(vscode.Uri.file(rightFilePath), rightFileContent);
			}catch
			{
				let visibleEditors = vscode.window.visibleTextEditors;
				for(let i = 0; i < visibleEditors.length; i++)
				{
					if(visibleEditors[i].document.uri.query === tabInput.modified.query)
					{
						let text = visibleEditors[i].document.getText();
						if(typeof text === "string")
						{
							fs.writeFileSync(rightFilePath, text);
						}else
						{
							//Error can't read right file
							vscode.window.showErrorMessage("Error: Can't open these files in Beyond Compare");
							return;
						}
						break;
					}
				}
			}
			
			temporaryFiles.push(rightFilePath);
			options += " -rro";
			rightLabel = tabInput.modified.fsPath;
		}else
		{
			rightFilePath = tabInput.modified.fsPath;
		}

		openBC(options, [leftLabel, rightLabel], leftFilePath, rightFilePath);
	}

	async function copyRemoteFileAsTemp(a : any) : Promise<string | false>
	{
		try
		{
			let fileContent = await vscode.workspace.fs.readFile(a);
			let extension = path.extname(a.fsPath);
			let filePath = path.join(os.tmpdir(), rndName() + extension);
			await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), fileContent);
			temporaryFiles.push(filePath);
			return filePath;
		}catch
		{
			vscode.window.showErrorMessage("Error: An error occurred while copying a file for use in Beyond Compare\nThe file you are trying to use may be incompatible");
			return false;
		}
	}
}

function verifyIsString(strInput : any, strDefault : string = "") : string
{
	if(typeof strInput === "string")
	{
		return strInput;
	}else
	{
		return strDefault;
	}
}


// This method is called when the extension is deactivated
export function deactivate() 
{
	leftPath = verifyIsString(globalState.get("leftPath"));//Make sure that leftPath is updated

	temporaryFiles.forEach((file) =>//Delete all temporary files created by this extension
	{
		if(fs.existsSync(file) && file !== leftPath) //but not the left file
		{
			fs.promises.unlink(file);
		}
	});
}
