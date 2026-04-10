"""Verify smoke-test.sh exists, is executable, and has valid bash syntax."""
import os
import subprocess

SMOKE_SCRIPT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '../../scripts/smoke-test.sh')
)


def _to_bash_path(path: str) -> str:
    """Return a path that the subprocess bash can resolve.

    On POSIX the path is already valid.
    On Windows, Python's os.path uses backslashes and a drive letter
    (e.g. C:\\foo\\bar).  The bash that subprocess.run finds may be either:
      - Git Bash / MSYS2: mounts C: as /c  → /c/foo/bar
      - WSL:              mounts C: as /mnt/c → /mnt/c/foo/bar

    We probe once which prefix actually resolves, then apply it.
    """
    drive, rest = os.path.splitdrive(path)
    if not drive:
        return path  # already a POSIX path

    letter = drive[0].lower()
    posix_rest = rest.replace('\\', '/')

    # Probe WSL-style first (/mnt/c/…), then Git-Bash-style (/c/…).
    for prefix in (f'/mnt/{letter}', f'/{letter}'):
        candidate = prefix + posix_rest
        probe = subprocess.run(
            ['bash', '-c', f'test -e "{candidate}"'],
            capture_output=True,
        )
        if probe.returncode == 0:
            return candidate

    # Fallback: forward-slash Windows path (works in many environments)
    return drive[0].upper() + ':' + posix_rest


def test_smoke_script_exists():
    assert os.path.isfile(SMOKE_SCRIPT), f"smoke-test.sh not found at {SMOKE_SCRIPT}"


def test_smoke_script_executable():
    """smoke-test.sh must have the executable bit set.

    Uses 'bash -c test -x' so the check works on POSIX and Windows
    (where Python's os.stat does not reflect chmod +x on NTFS).
    """
    bash_path = _to_bash_path(SMOKE_SCRIPT)
    r = subprocess.run(
        ['bash', '-c', f'test -x "{bash_path}"'],
        capture_output=True,
    )
    assert r.returncode == 0, "smoke-test.sh is not executable (bash test -x failed)"


def test_smoke_script_bash_syntax():
    bash_path = _to_bash_path(SMOKE_SCRIPT)
    r = subprocess.run(['bash', '-n', bash_path], capture_output=True, text=True)
    assert r.returncode == 0, f"bash syntax error: {r.stderr}"
