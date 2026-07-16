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
