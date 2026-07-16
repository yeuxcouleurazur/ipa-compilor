<div align="center">
  <img src="https://img.icons8.com/color/96/000000/ipa.png" alt="IPA Compilor Logo">
  <h1>IPA Compilor (Cloud Edition)</h1>
  <p><b>Compile Swift projects into signed IPA files easily via GitHub Actions & Appetize Emulator</b></p>

  [![Python](https://img.shields.io/badge/Python-3.13-blue.svg?style=flat-square&logo=python)](https://www.python.org/)
  [![CustomTkinter](https://img.shields.io/badge/CustomTkinter-UI-green.svg?style=flat-square)](#)
  [![License](https://img.shields.io/badge/License-MIT-orange.svg?style=flat-square)](LICENSE)
</div>

<br/>

## 🌟 Overview
**IPA Compilor** is a professional desktop application designed to streamline the compilation of iOS Swift projects directly from Windows, leveraging cloud computing (GitHub Actions) and optionally running the compiled application in the Appetize.io web emulator.

It completely removes the need for a local macOS environment to build your iOS apps!

## ✨ Features
- **Clean & Simple UI**: A minimal, native-feeling Windows software interface.
- **Cloud Build System**: Push your code to a remote GitHub worker to compile it remotely.
- **Appetize.io Integration**: Instantly simulate your built `.ipa` via web emulator.
- **Standalone Executable**: Run it instantly without installing Python.

---

## 🚀 Installation

You have two options to use **IPA Compilor**: using the standalone executable (easiest) or running it from source.

### Option A: Standalone Executable (Recommended)
1. Navigate to the `Release` section of this repository.
2. Download the `IPA_Compilor.exe` file.
3. Double-click the file to launch the application immediately (No installation required).

### Option B: Run from Source (For Developers)
If you prefer to run or modify the Python source code:
1. Ensure you have **Python 3.10+** installed on your system.
2. Clone this repository:
   ```bash
   git clone https://github.com/your-username/ipa-compilor.git
   cd ipa-compilor/python-gui
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python app.py
   ```

### Option C: Command Line Interface (CLI)
You are not required to use the GUI (Executable or Python). You can also run the compiler natively in your terminal using the underlying Node.js CLI:
1. Ensure you have **Node.js** installed.
2. Clone this repository and run from the root folder:
   ```bash
   npm install
   ```
3. Run the CLI directly on your Swift project:
   ```bash
   npx tsx cli/src/index.ts build "C:\Path\To\Your\SwiftProject" --cloud --emulator
   ```

#### Available CLI Commands
The CLI tool provides a rich set of commands for advanced developers:

| Command | Description | Example Usage |
|---------|-------------|---------------|
| `shell` | Opens the interactive IPA Compilor terminal dashboard | `npx tsx cli/src/index.ts shell` |
| `build` | Compiles your Swift project into an `.ipa` | `npx tsx cli/src/index.ts build ./MyProject --cloud` |
| `sign` | Signs and packages an existing `.ipa` or `.app` | `npx tsx cli/src/index.ts sign -i myapp.app` |
| `emulate` | Uploads and runs your `.ipa` in the Appetize web emulator | `npx tsx cli/src/index.ts emulate -i app.ipa` |
| `ota` | Generates Over-The-Air web installation assets | `npx tsx cli/src/index.ts ota -i app.ipa -u https://domain.com` |
| `sync` | Syncs source code to a remote Mac build agent (if configured) | `npx tsx cli/src/index.ts sync --watch` |
| `diag` | Runs full environment diagnostics | `npx tsx cli/src/index.ts diag --fix` |
| `new` | Scaffolds a brand new iOS Swift project structure | `npx tsx cli/src/index.ts new MyApp` |
| `config` | Interactively configure platform settings and tokens | `npx tsx cli/src/index.ts config` |

---

## ⚙️ How to Use

1. **Launch the Application**: Open `IPA_Compilor.exe` (or run `app.py`).
2. **Project Info**: Enter your Project Name.
3. **GitHub Credentials**: 
   - Enter your **GitHub Owner** (username).
   - Enter your **GitHub Repo** (the worker repository name).
   - Enter your **GitHub Token** (Classic PAT with `repo` and `workflow` scopes).
4. **Select Project**: Click "Browse..." and select the local folder containing your Swift project.
5. *(Optional) Simulation Mode*: Check "Enable Appetize Simulation Mode" and enter your Appetize API Token if you want to preview the app after building.
6. **Start**: Click **Start Compilation**. The console will stream the cloud build progress live!

---

## 🛠️ Building the .exe Yourself
Want to compile the `.exe` yourself from the source code?
Simply run the included batch script:
```cmd
cd python-gui
build.bat
```
The compiled executable will be generated in `python-gui/dist/IPA_Compilor.exe`.

---
*Made with ❤️ for the iOS Development Community on Windows.*
