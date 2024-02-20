# Change Log

## 1.0.6

- Comparing files in a remote workspace will now open temporary files in BC on the computer you're using rather than opening the files on the one you're accessing
- Virtual files will now be copied into temporary files and should be compared properly
- When comparing a staged file on the source control window, you are now given a choice between comparing it to the head or the current version
- When comparing a staged file to the git head, the modified version now appears on the right rather than the left
- In most cases, when opening a temp file, BC will now display a more appropriate name (ex. when comparing to clipboard, the contents of the clipboard will be labeled "Clipboard Contents" instead of the randomly generated file name)
- Invoking "Compare with last save" by right clicking a tab no longer cycles through all open tabs unless the tab isn't active
- Temporary files created by the extension are now deleted as soon as they are done being used rather than when VSCode is closed
- The extension will now work in untrusted workspaces

## 1.0.5

- Fixed an error that broke the README file when viewed on the marketplace

## 1.0.4

- The Open Compare button found in VS Code's default compare tool now properly opens more types of files

## 1.0.3

- Removed the setting to automatically open Beyond Compare instead of VS Code's default compare tool. The button to open a comparison in BC is still available.

## 1.0.2

- Added options to compare files or highlighted text to your clipboard
- Added a setting to use always Beyond Compare instead of VS Code's default compare tool
- Selecting a left file/folder will now select it for all your instances of VScode, and it will be remembered even after VScode is closed
- Comparing a file/folder to a selected left file/folder will now deselect the left one afterwards
- An error message is now properly displayed when trying to compare folders to files in the explorer
- Updated the README
- Removed the ability to compare 3 files/folders from the explorer

## 1.0.1

- Fixed an issue that sometimes prevented the extension from opening Beyond Compare on Windows
- Fixed some minor typos in the README

## 1.0.0

- Initial release

