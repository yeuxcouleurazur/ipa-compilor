import os
import sys
import yaml
import threading
import subprocess
import customtkinter as ctk
from tkinter import filedialog, messagebox

# Simple, white, "real software" theme
ctk.set_appearance_mode("Light")
ctk.set_default_color_theme("blue")

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "default.yml")

class SimpleApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("IPA Compilor")
        self.geometry("600x650")
        self.minsize(500, 600)
        
        # Clean white background
        self.configure(fg_color="#f9f9f9")
        
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # --- Top Section ---
        self.top_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.top_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=20)
        self.top_frame.grid_columnconfigure(1, weight=1)

        # Header Title
        ctk.CTkLabel(
            self.top_frame, 
            text="Build Configuration", 
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color="#333333"
        ).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 15))

        row_idx = 1
        
        # Helper for fields
        def add_field(label_text, placeholder="", is_password=False):
            nonlocal row_idx
            ctk.CTkLabel(self.top_frame, text=label_text, text_color="#555555", font=ctk.CTkFont(size=13)).grid(row=row_idx, column=0, sticky="w", pady=(5,0))
            entry = ctk.CTkEntry(
                self.top_frame, 
                placeholder_text=placeholder, 
                fg_color="#ffffff", 
                border_color="#cccccc", 
                text_color="#000000",
                show="*" if is_password else ""
            )
            entry.grid(row=row_idx, column=1, sticky="ew", padx=(15,0), pady=(5,0))
            row_idx += 1
            return entry

        self.entry_name = add_field("Project Name:", "MyApp")
        self.entry_bundle = add_field("Bundle ID:")
        self.entry_bundle.insert(0, "com.example.myapp (Read-Only)")
        self.entry_bundle.configure(state="disabled", fg_color="#eeeeee")
        
        self.entry_gh_owner = add_field("GitHub Owner:")
        self.entry_gh_repo = add_field("GitHub Repo:")
        self.entry_gh_token = add_field("GitHub Token:", "ghp_...", is_password=True)

        # Project Path Picker
        ctk.CTkLabel(self.top_frame, text="Project Folder:", text_color="#555555", font=ctk.CTkFont(size=13)).grid(row=row_idx, column=0, sticky="w", pady=(15,0))
        
        self.path_frame = ctk.CTkFrame(self.top_frame, fg_color="transparent")
        self.path_frame.grid(row=row_idx, column=1, sticky="ew", padx=(15,0), pady=(15,0))
        self.path_frame.grid_columnconfigure(0, weight=1)

        self.path_entry = ctk.CTkEntry(self.path_frame, fg_color="#ffffff", border_color="#cccccc", text_color="#000000")
        self.path_entry.grid(row=0, column=0, sticky="ew")
        self.path_entry.configure(state="disabled")

        self.btn_browse = ctk.CTkButton(
            self.path_frame, 
            text="Browse...", 
            width=80, 
            fg_color="#e0e0e0", 
            text_color="#333333", 
            hover_color="#d0d0d0", 
            command=self.browse_path
        )
        self.btn_browse.grid(row=0, column=1, padx=(10, 0))
        row_idx += 1

        # Options
        self.options_frame = ctk.CTkFrame(self.top_frame, fg_color="transparent")
        self.options_frame.grid(row=row_idx, column=0, columnspan=2, sticky="ew", pady=(20, 0))
        
        self.sim_var = ctk.BooleanVar(value=False)
        self.chk_sim = ctk.CTkCheckBox(
            self.options_frame, 
            text="Enable Appetize Simulation Mode", 
            variable=self.sim_var, 
            command=self.toggle_sim,
            text_color="#333333"
        )
        self.chk_sim.pack(side="left")

        self.entry_appetize = ctk.CTkEntry(
            self.options_frame, 
            placeholder_text="Appetize Token", 
            fg_color="#eeeeee", 
            border_color="#cccccc", 
            text_color="#000000",
            state="disabled",
            width=180
        )
        self.entry_appetize.pack(side="right")

        self.entries = {
            "github.owner": self.entry_gh_owner,
            "github.repo": self.entry_gh_repo,
            "github.token": self.entry_gh_token,
            "project.name": self.entry_name,
            "appetize.token": self.entry_appetize
        }

        self.load_config()
        self.selected_path = ""

        # --- Middle Section: Start Button ---
        self.btn_start = ctk.CTkButton(
            self, 
            text="Start Compilation", 
            height=40,
            font=ctk.CTkFont(size=14, weight="bold"),
            command=self.start_build
        )
        self.btn_start.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 15))

        # --- Bottom Section: Console ---
        self.console_frame = ctk.CTkFrame(self, fg_color="#ffffff", border_width=1, border_color="#dddddd")
        self.console_frame.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))
        self.console_frame.grid_columnconfigure(0, weight=1)
        self.console_frame.grid_rowconfigure(0, weight=1)

        self.console_text = ctk.CTkTextbox(
            self.console_frame, 
            fg_color="transparent", 
            text_color="#333333", 
            font=ctk.CTkFont(family="Consolas", size=12),
            wrap="word"
        )
        self.console_text.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)
        self.console_text.configure(state="disabled")

        self.process = None

    def toggle_sim(self):
        if self.sim_var.get():
            self.entry_appetize.configure(state="normal", fg_color="#ffffff")
        else:
            self.entry_appetize.configure(state="disabled", fg_color="#eeeeee")

    def log(self, message):
        self.console_text.configure(state="normal")
        import re
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        clean_msg = ansi_escape.sub('', message)
        
        self.console_text.insert("end", clean_msg)
        self.console_text.see("end")
        self.console_text.configure(state="disabled")

    def browse_path(self):
        folder = filedialog.askdirectory(title="Select Swift Project Folder")
        if folder:
            self.selected_path = folder
            self.path_entry.configure(state="normal")
            self.path_entry.delete(0, "end")
            self.path_entry.insert(0, folder)
            self.path_entry.configure(state="disabled")

    def load_config(self):
        try:
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, 'r') as f:
                    config = yaml.safe_load(f) or {}
                
                def get_val(d, keys):
                    for k in keys:
                        if not isinstance(d, dict) or k not in d:
                            return ""
                        d = d[k]
                    return d

                self.entry_appetize.configure(state="normal")
                for key, entry in self.entries.items():
                    val = get_val(config, key.split('.'))
                    if val:
                        entry.delete(0, "end")
                        entry.insert(0, str(val))
                
                if self.entry_appetize.get().strip():
                    self.sim_var.set(True)
                    self.toggle_sim()
                else:
                    self.entry_appetize.configure(state="disabled")
        except Exception as e:
            self.log(f"Error loading config: {e}\n")

    def save_config(self):
        try:
            config = {}
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, 'r') as f:
                    config = yaml.safe_load(f) or {}

            def set_val(d, keys, val):
                for k in keys[:-1]:
                    d = d.setdefault(k, {})
                d[keys[-1]] = val

            for key, entry in self.entries.items():
                if key == "appetize.token" and not self.sim_var.get():
                    continue
                val = entry.get().strip()
                if val:
                    set_val(config, key.split('.'), val)

            os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
            with open(CONFIG_PATH, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
            
            return True
        except Exception as e:
            messagebox.showerror("Config Error", f"Failed to save config: {e}")
            return False

    def start_build(self):
        if self.process and self.process.poll() is None:
            messagebox.showwarning("Warning", "A build is already in progress.")
            return

        if not self.selected_path:
            messagebox.showwarning("Warning", "Please select a project path first.")
            return

        if not self.save_config():
            return

        self.btn_start.configure(state="disabled", text="Compiling...")
        self.console_text.configure(state="normal")
        self.console_text.delete("1.0", "end")
        self.console_text.configure(state="disabled")
        self.log(f"Starting Compilation...\n")
        
        threading.Thread(target=self.run_process, daemon=True).start()

    def run_process(self):
        root_dir = os.path.dirname(os.path.dirname(__file__))
        cli_dist = os.path.join(root_dir, "cli", "dist", "index.js")
        cli_src = os.path.join(root_dir, "cli", "src", "index.ts")

        cmd = []
        if os.path.exists(cli_dist):
            cmd = ["node", cli_dist, "build", self.selected_path]
        else:
            npx = "npx.cmd" if os.name == 'nt' else "npx"
            cmd = [npx, "tsx", cli_src, "build", self.selected_path]

        cmd.append("--cloud")
        if self.sim_var.get():
            cmd.append("--emulator")

        try:
            env = os.environ.copy()
            env["NO_COLOR"] = "1" 
            
            creationflags = 0
            if os.name == 'nt':
                creationflags = subprocess.CREATE_NO_WINDOW

            self.process = subprocess.Popen(
                cmd, 
                cwd=root_dir,
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT, 
                text=True,
                env=env,
                creationflags=creationflags
            )

            for line in iter(self.process.stdout.readline, ''):
                self.after(0, self.log, line)
            
            self.process.stdout.close()
            return_code = self.process.wait()
            
            if return_code == 0:
                self.after(0, self.log, "\nProcess finished successfully.\n")
            else:
                self.after(0, self.log, f"\nProcess failed with code {return_code}.\n")

        except Exception as e:
            self.after(0, self.log, f"\nError: {e}\n")
        finally:
            self.after(0, lambda: self.btn_start.configure(state="normal", text="Start Compilation"))

if __name__ == "__main__":
    app = SimpleApp()
    app.mainloop()
