# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
shopt -s expand_aliases
# Check for rg availability
if ! (unalias rg 2>/dev/null; command -v rg) >/dev/null 2>&1; then
  alias rg='C:\Users\admin\Desktop\restored-src\build-output\win-unpacked\resources\dist\vendor\ripgrep\x64-win32\rg.exe'
fi
export PATH=/c/Users/admin/bin:/mingw64/bin:/usr/local/bin:/usr/bin:/bin:/mingw64/bin:/usr/bin:/c/Users/admin/bin:/c/Windows/system32:/c/Windows:/c/Windows/System32/Wbem:/c/Windows/System32/WindowsPowerShell/v1.0:/c/Windows/System32/OpenSSH:/c/Program Files/dotnet:/c/Users/admin/.ollama:/cmd:/c/Program Files/PuTTY:/c/Program Files/nodejs:/c/Program Files/Go/bin:/d/python/Scripts:/d/python:/c/Users/admin/AppData/Local/Microsoft/WindowsApps:/d/code/Microsoft VS Code/bin:/c/Users/admin/AppData/Local/Programs/Ollama:/c/Users/admin/AppData/Roaming/npm:/c/Program Files (x86)/Nmap:/c/Users/admin/go/bin:/usr/bin/vendor_perl:/usr/bin/core_perl
