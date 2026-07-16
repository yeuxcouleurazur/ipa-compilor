document.addEventListener('DOMContentLoaded', () => {
  const btnBrowse = document.getElementById('btn-browse');
  const projectPathInput = document.getElementById('project-path');
  const btnStart = document.getElementById('btn-start');
  const btnCancel = document.getElementById('btn-cancel');
  const form = document.getElementById('build-form');
  const consoleOutput = document.getElementById('console-output');
  const targetNameInput = document.getElementById('target-name');

  // Utility to append log
  function appendLog(text, type = 'info') {
    // Basic ANSI color stripping for simple display
    const cleanText = text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    
    if (!cleanText.trim()) return;

    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = cleanText;
    consoleOutput.appendChild(line);
    
    // Auto-scroll
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // Browse Button
  btnBrowse.addEventListener('click', async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      projectPathInput.value = path;
      btnStart.disabled = false;
      appendLog(`Selected project path: ${path}`);
    }
  });

  // Form Submit (Start Build)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!projectPathInput.value) return;

    // Get options
    const buildEnv = document.querySelector('input[name="build-env"]:checked').value;
    const isCloud = buildEnv === 'cloud';
    const isSimulator = buildEnv === 'simulator';
    const targetName = targetNameInput.value.trim();

    const options = {
      projectPath: projectPathInput.value,
      cloud: isCloud,
      simulator: isSimulator,
      target: targetName || undefined
    };

    // UI state change
    btnStart.style.display = 'none';
    btnCancel.style.display = 'inline-flex';
    form.classList.add('building');

    consoleOutput.innerHTML = ''; // clear logs
    appendLog('--- Starting Compilation Process ---', 'success');
    
    window.electronAPI.startBuild(options);
  });

  // Cancel Button
  btnCancel.addEventListener('click', () => {
    window.electronAPI.cancelBuild();
  });

  // Listen for logs
  window.electronAPI.onBuildLog((log) => {
    // simple coloring logic based on keywords
    let type = 'info';
    if (log.toLowerCase().includes('error') || log.toLowerCase().includes('fail')) type = 'error';
    if (log.toLowerCase().includes('success')) type = 'success';
    if (log.toLowerCase().includes('warning')) type = 'warning';
    
    appendLog(log, type);
  });

  // Listen for finish
  window.electronAPI.onBuildFinished((success) => {
    btnCancel.style.display = 'none';
    btnStart.style.display = 'inline-flex';
    form.classList.remove('building');

    if (success) {
      appendLog('\n--- Build Completed Successfully ---', 'success');
    } else {
      appendLog('\n--- Build Failed ---', 'error');
    }
  });
});
