<div align="center">
  <img src="https://img.icons8.com/color/96/000000/ipa.png" alt="IPA Compilor Logo">
  <h1>IPA Compilor (Cloud Edition)</h1>
  <p><b>A Windows-native solution to compile iOS Swift projects into signed IPA files via Cloud</b></p>

  [![Python](https://img.shields.io/badge/Python-3.13-blue.svg?style=flat-square&logo=python)](https://www.python.org/)
  [![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg?style=flat-square&logo=windows)](#)
  [![License](https://img.shields.io/badge/License-MIT-orange.svg?style=flat-square)](LICENSE)
</div>

<br/>

## 🌟 What is this project?
Developing iOS applications historically requires owning an Apple Mac computer to run Xcode. 
**IPA Compilor** breaks this barrier by allowing you to compile your Swift code into an `.ipa` file directly from a Windows machine.

### How it works (Architecture)
1. **The GUI (This Repository):** A lightweight Windows application (`IPA_Compilor.exe`) where you configure your project settings.
2. **The Cloud Worker:** When you click "Start", the underlying CLI securely pushes your local Swift code to a private GitHub repository.
3. **GitHub Actions:** GitHub's cloud servers (which run macOS) compile your code using Xcode, sign the `.ipa`, and send it back to your Windows PC.
4. **Appetize Emulator:** (Optional) The GUI can automatically upload the compiled `.ipa` to Appetize.io so you can interact with your iOS app inside a web browser!

---

## 🛠️ Prerequisites & Required Tools
Before using the compiler, you must have the following set up:

1. **A GitHub Account:** You need a standard (free) GitHub account to host the cloud worker.
2. **GitHub Personal Access Token (PAT):** 
   - Generate a token at `GitHub Settings > Developer settings > Personal access tokens (classic)`.
   - It must have the `repo` and `workflow` scopes checked.
3. **The Worker Repository:**
   - You must fork or create a remote repository (e.g., `your-username/ipa-compilor-worker`) that contains the GitHub Actions workflow file to receive and compile the code.
4. *(Optional)* **Appetize.io API Token:** Required only if you want to use the web emulator.

---

## 🚀 Installation

We provide a **ready-to-use Standalone Executable** so you don't have to install Python or any dependencies on your computer!

### Option 1: Standalone `.exe` (Recommended)
1. Go to the `releases/` folder in this repository.
2. Download the **`IPA_Compilor.exe`** file.
3. Double-click to launch it (No installation required).

### Option 2: Run from Source (For Developers)
If you prefer to run the Python source code yourself:
1. Ensure you have **Python 3.10+** and **Node.js** installed.
2. Clone this repository:
   ```bash
   git clone https://github.com/yeuxcouleurazur/ipa-compilor.git
   cd ipa-compilor/python-gui
   ```
3. Install the dependencies and run:
   ```bash
   pip install -r requirements.txt
   python app.py
   ```

---

## ⚙️ How to Use the GUI

1. **Launch the Application**: Open `IPA_Compilor.exe`.
2. **Project Name**: Enter the name of your app.
3. **GitHub Owner**: Enter your GitHub username.
4. **GitHub Repo**: Enter the name of your worker repository (e.g., `ipa-compilor-worker`).
5. **GitHub Token**: Paste your Personal Access Token.
6. **Project Folder**: Click "Browse..." and select the local Windows folder containing your Swift code.
7. **Simulation Mode**: Check the box and enter your Appetize token if you want to preview the app after compilation.
8. **Start Compilation**: Click the big start button and watch the cloud console build your app live!

---

## 💻 Advanced: The Node.js CLI
The GUI is powered by a robust Node.js Command Line Interface. If you prefer scripting or terminal usage, you can run the CLI directly from the root of this repository:

```bash
npm install
npx tsx cli/src/index.ts build "C:\Path\To\Your\SwiftProject" --cloud
```

| Command | Description |
|---------|-------------|
| `shell` | Opens the interactive IPA Compilor terminal dashboard |
| `build` | Compiles your Swift project into an `.ipa` |
| `sign` | Signs and packages an existing `.ipa` or `.app` |
| `emulate` | Uploads and runs your `.ipa` in the Appetize web emulator |
| `ota` | Generates Over-The-Air web installation assets |
| `diag` | Runs full environment diagnostics |

---
*Developed to bridge the gap between Windows developers and the Apple ecosystem.*
